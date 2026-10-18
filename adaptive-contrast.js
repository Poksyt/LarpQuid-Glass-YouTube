(() => {
    'use strict';
    const SURFACE_SELECTOR = '[data-liquid-glass-chip-surface="1"][data-liquid-glass-adaptive-category="1"]';
    const CHIP_HOSTS = 'yt-chip-cloud-chip-renderer, chip-view-model, yt-chip-view-model, chip-shape';
    const CHROME_SELECTOR = [
        'ytd-feed-filter-chip-bar-renderer',
        'yt-chip-cloud-renderer',
        'yt-chip-cloud-chip-renderer',
        'ytd-chips-shelf-with-video-shelf-renderer',
        'chips-shelf-view-model',
        'chip-view-model',
        'yt-chip-view-model',
        'chip-shape',
        SURFACE_SELECTOR
    ].join(',');
    const gridCache = new Map();
    const toneState = new WeakMap();
    const pendingToneState = new WeakMap();
    const TONE_DWELL_MS = 500;
    const SCROLL_SAMPLE_MS = 24;
    let timer = 0;
    let running = false;
    let rerun = false;
    let generation = 0;
    function adaptiveEnabled() {
        return document.documentElement.getAttribute('data-liquid-glass-adaptive-chip-text') !== 'false';
    }
    function visitSurfaces(callback) {
        const seenRoots = new Set();
        const walk = (root) => {
            if (!root || seenRoots.has(root))
                return;
            seenRoots.add(root);
            root.querySelectorAll?.(SURFACE_SELECTOR).forEach(callback);
            root.querySelectorAll?.(CHIP_HOSTS).forEach((host) => {
                if (host.shadowRoot)
                    walk(host.shadowRoot);
            });
        };
        walk(document);
    }
    function collectSurfaces() {
        const set = new Set();
        const seenRoots = new Set();
        const walk = (root) => {
            if (!root || seenRoots.has(root))
                return;
            seenRoots.add(root);
            root.querySelectorAll?.(SURFACE_SELECTOR).forEach((surface) => set.add(surface));
            root.querySelectorAll?.(CHIP_HOSTS).forEach((host) => {
                if (host.shadowRoot)
                    walk(host.shadowRoot);
            });
        };
        walk(document);
        return [...set].filter((surface) => {
            if (!(surface instanceof HTMLElement) || !surface.isConnected)
                return false;
            const rect = surface.getBoundingClientRect();
            return rect.width > 18 && rect.height > 16 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        });
    }
    function rgba(value) {
        if (!value || value === 'transparent')
            return null;
        const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/i);
        if (!match)
            return null;
        const alphaRaw = match[4];
        const alpha = alphaRaw == null ? 1 : (alphaRaw.endsWith?.('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw));
        return {
            r: Math.max(0, Math.min(255, parseFloat(match[1]))),
            g: Math.max(0, Math.min(255, parseFloat(match[2]))),
            b: Math.max(0, Math.min(255, parseFloat(match[3]))),
            a: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1
        };
    }
    function perceived(rgb) {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        return Math.sqrt((0.241 * r * r) + (0.691 * g * g) + (0.068 * b * b));
    }
    function firstUrl(backgroundImage) {
        if (!backgroundImage || backgroundImage === 'none')
            return '';
        const match = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/i);
        return match?.[1] || '';
    }
    function mapImagePoint(image, x, y) {
        const rect = image.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return null;
        let nx = (x - rect.left) / rect.width;
        let ny = (y - rect.top) / rect.height;
        if (image instanceof HTMLImageElement && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const style = getComputedStyle(image);
            const fit = style.objectFit;
            if (fit === 'cover' || fit === 'contain') {
                const scale = fit === 'cover'
                    ? Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
                    : Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
                const paintedW = image.naturalWidth * scale;
                const paintedH = image.naturalHeight * scale;
                const offsetX = (rect.width - paintedW) * 0.5;
                const offsetY = (rect.height - paintedH) * 0.5;
                nx = (x - rect.left - offsetX) / paintedW;
                ny = (y - rect.top - offsetY) / paintedH;
            }
        }
        return { x: Math.max(0, Math.min(0.9999, nx)), y: Math.max(0, Math.min(0.9999, ny)) };
    }
    function sourceAtPoint(x, y) {
        const stack = document.elementsFromPoint(x, y);
        for (const el of stack) {
            if (!(el instanceof Element))
                continue;
            if (el.matches?.(SURFACE_SELECTOR) || el.closest?.(SURFACE_SELECTOR))
                continue;
            if (el.matches?.(CHROME_SELECTOR))
                continue;
            if (el instanceof HTMLImageElement && el.currentSrc) {
                const point = mapImagePoint(el, x, y);
                if (point)
                    return { type: 'image', url: el.currentSrc, ...point };
            }
            const style = getComputedStyle(el);
            const imageUrl = firstUrl(style.backgroundImage);
            if (imageUrl && /^https:\/\//i.test(imageUrl)) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    return {
                        type: 'image',
                        url: imageUrl,
                        x: Math.max(0, Math.min(0.9999, (x - rect.left) / rect.width)),
                        y: Math.max(0, Math.min(0.9999, (y - rect.top) / rect.height))
                    };
                }
            }
            const color = rgba(style.backgroundColor);
            if (color && color.a >= 0.72)
                return { type: 'color', value: perceived(color) };
        }
        return { type: 'color', value: 0.08 };
    }
    async function imageGrid(url) {
        const cached = gridCache.get(url);
        if (cached)
            return cached;
        const promise = new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ type: 'liquid-glass-image-grid', url }, (response) => {
                    if (chrome.runtime.lastError || !response?.ok || !response.grid?.luma?.length) {
                        resolve(null);
                        return;
                    }
                    resolve(response.grid);
                });
            }
            catch (_error) {
                resolve(null);
            }
        });
        gridCache.set(url, promise);
        if (gridCache.size > 96)
            gridCache.delete(gridCache.keys().next().value);
        return promise;
    }
    async function sourceBrightness(source) {
        if (!source)
            return 0.08;
        if (source.type === 'color')
            return source.value;
        const grid = await imageGrid(source.url);
        if (!grid)
            return 0.08;
        const gx = Math.max(0, Math.min(grid.width - 1, Math.floor(source.x * grid.width)));
        const gy = Math.max(0, Math.min(grid.height - 1, Math.floor(source.y * grid.height)));
        return (grid.luma[(gy * grid.width) + gx] || 0) / 255;
    }
    const SAMPLE_LAYOUT = [
        [0.07, 0.50], [0.22, 0.50], [0.39, 0.50], [0.56, 0.50], [0.73, 0.50], [0.90, 0.50],
        [0.18, 0.24], [0.50, 0.24], [0.82, 0.24],
        [0.18, 0.76], [0.50, 0.76], [0.82, 0.76]
    ];
    function setCommittedTone(surface, tone) {
        toneState.set(surface, tone);
        surface.setAttribute('data-liquid-glass-chip-tone', tone);
        surface.style.setProperty('--lg-chip-fg', tone === 'dark' ? 'rgb(18 18 20)' : 'rgb(250 250 252)');
        surface.style.setProperty('--lg-chip-muted', tone === 'dark' ? 'rgb(38 38 42 / .82)' : 'rgb(245 245 248 / .84)');
    }
    function cancelPendingTone(surface) {
        const pending = pendingToneState.get(surface);
        if (pending?.timer)
            clearTimeout(pending.timer);
        pendingToneState.delete(surface);
    }
    async function analyzeSurface(surface, runGeneration) {
        const rect = surface.getBoundingClientRect();
        if (rect.width < 18 || rect.height < 16)
            return;
        const sources = SAMPLE_LAYOUT.map(([px, py]) => sourceAtPoint(Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width * px)), Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height * py))));
        const values = await Promise.all(sources.map(sourceBrightness));
        if (runGeneration !== generation || !surface.isConnected)
            return;
        const sorted = values.slice().sort((a, b) => b - a);
        const max = sorted[0] || 0;
        const top3 = ((sorted[0] || 0) + (sorted[1] || 0) + (sorted[2] || 0)) / 3;
        const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
        const bright = values.filter((value) => value >= 0.69).length;
        const veryBright = values.filter((value) => value >= 0.80).length;
        const committedTone = toneState.get(surface) || 'light';
        const previousDark = committedTone === 'dark';
        const dark = previousDark
            ? (max >= 0.72 || top3 >= 0.62 || bright >= 2 || avg >= 0.54)
            : (max >= 0.84 || veryBright >= 1 || bright >= 2 || top3 >= 0.69 || avg >= 0.61);
        const candidateTone = dark ? 'dark' : 'light';
        if (!toneState.has(surface))
            setCommittedTone(surface, committedTone);
        if (candidateTone === committedTone) {
            cancelPendingTone(surface);
            return;
        }
        if (committedTone === 'dark' && candidateTone === 'light') {
            cancelPendingTone(surface);
            setCommittedTone(surface, 'light');
            return;
        }
        const now = performance.now();
        const pending = pendingToneState.get(surface);
        if (!pending || pending.tone !== candidateTone) {
            if (pending?.timer)
                clearTimeout(pending.timer);
            const entry = { tone: candidateTone, since: now, timer: 0 };
            entry.timer = setTimeout(() => {
                const current = pendingToneState.get(surface);
                if (!current || current !== entry || !surface.isConnected)
                    return;
                current.timer = 0;
                schedule(0);
            }, TONE_DWELL_MS + 24);
            pendingToneState.set(surface, entry);
            return;
        }
        if ((now - pending.since) < TONE_DWELL_MS)
            return;
        if (pending.timer)
            clearTimeout(pending.timer);
        pendingToneState.delete(surface);
        setCommittedTone(surface, candidateTone);
    }
    async function run() {
        timer = 0;
        if (running) {
            rerun = true;
            return;
        }
        running = true;
        const runGeneration = ++generation;
        try {
            if (!adaptiveEnabled()) {
                visitSurfaces((surface) => {
                    cancelPendingTone(surface);
                    setCommittedTone(surface, 'light');
                });
                return;
            }
            const surfaces = collectSurfaces();
            await Promise.all(surfaces.map((surface) => analyzeSurface(surface, runGeneration)));
        }
        finally {
            running = false;
            if (rerun) {
                rerun = false;
                schedule(24);
            }
        }
    }
    function schedule(delay = 48) {
        if (timer)
            return;
        timer = setTimeout(() => requestAnimationFrame(run), delay);
    }
    chrome.storage?.onChanged?.addListener((changes, area) => {
        if (area !== 'local' || !changes.adaptiveChipText)
            return;
        document.documentElement.setAttribute('data-liquid-glass-adaptive-chip-text', String(changes.adaptiveChipText.newValue !== false));
        schedule(0);
    });
    schedule(0);
    setTimeout(() => schedule(0), 160);
    setTimeout(() => schedule(0), 650);
    addEventListener('scroll', () => {
        schedule(SCROLL_SAMPLE_MS);
    }, { capture: true, passive: true });
    addEventListener('resize', () => schedule(20), { passive: true });
    document.addEventListener('yt-navigate-finish', () => {
        gridCache.clear();
        schedule(30);
        setTimeout(() => schedule(0), 260);
    }, true);
    const observer = new MutationObserver((records) => {
        let relevant = false;
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element))
                    continue;
                if (node.matches?.(SURFACE_SELECTOR + ',' + CHIP_HOSTS) || node.querySelector?.(SURFACE_SELECTOR + ',' + CHIP_HOSTS)) {
                    relevant = true;
                    break;
                }
            }
            if (relevant)
                break;
        }
        if (relevant)
            schedule(24);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
