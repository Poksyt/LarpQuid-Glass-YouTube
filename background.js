'use strict';
const GRID_W = 36;
const GRID_H = 20;
const MAX_CACHE = 72;
const imageGridCache = new Map();
function allowedImageUrl(raw) {
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:')
            return false;
        const host = url.hostname.toLowerCase();
        return host === 'youtube.com'
            || host.endsWith('.youtube.com')
            || host === 'ytimg.com'
            || host.endsWith('.ytimg.com')
            || host === 'ggpht.com'
            || host.endsWith('.ggpht.com')
            || host === 'googleusercontent.com'
            || host.endsWith('.googleusercontent.com');
    }
    catch (_error) {
        return false;
    }
}
function touchCache(key, value) {
    imageGridCache.delete(key);
    imageGridCache.set(key, value);
    while (imageGridCache.size > MAX_CACHE) {
        const oldest = imageGridCache.keys().next().value;
        imageGridCache.delete(oldest);
    }
}
async function buildLuminanceGrid(url) {
    if (!allowedImageUrl(url))
        return null;
    const cached = imageGridCache.get(url);
    if (cached) {
        touchCache(url, cached);
        return cached;
    }
    const pending = (async () => {
        try {
            const response = await fetch(url, {
                credentials: 'omit',
                cache: 'force-cache',
                referrerPolicy: 'no-referrer'
            });
            if (!response.ok)
                return null;
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(GRID_W, GRID_H);
            const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
            if (!context) {
                bitmap.close?.();
                return null;
            }
            context.drawImage(bitmap, 0, 0, GRID_W, GRID_H);
            bitmap.close?.();
            const pixels = context.getImageData(0, 0, GRID_W, GRID_H).data;
            const luma = new Array(GRID_W * GRID_H);
            for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
                const r = pixels[i] / 255;
                const g = pixels[i + 1] / 255;
                const b = pixels[i + 2] / 255;
                const perceived = Math.sqrt((0.241 * r * r) + (0.691 * g * g) + (0.068 * b * b));
                luma[p] = Math.max(0, Math.min(255, Math.round(perceived * 255)));
            }
            return { width: GRID_W, height: GRID_H, luma };
        }
        catch (_error) {
            return null;
        }
    })();
    touchCache(url, pending);
    const result = await pending;
    if (result)
        touchCache(url, Promise.resolve(result));
    else
        imageGridCache.delete(url);
    return result;
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'liquid-glass-image-grid' || typeof message.url !== 'string')
        return;
    buildLuminanceGrid(message.url)
        .then((grid) => sendResponse({ ok: Boolean(grid), grid }))
        .catch(() => sendResponse({ ok: false, grid: null }));
    return true;
});
