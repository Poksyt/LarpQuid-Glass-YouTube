(() => {
    'use strict';
    const ICON_SELECTOR = 'yt-icon, yt-icon-shape, icon-shape, .yt-icon-shape, svg';
    const POPUP_SELECTOR = [
        'ytd-menu-popup-renderer', 'ytd-multi-page-menu-renderer',
        'tp-yt-paper-dialog', 'yt-contextual-sheet-layout', 'tp-yt-paper-listbox',
        '.html5-video-player .ytp-popup',
        'yt-searchbox [class*="SuggestionsContainer"]', 'ytd-searchbox .sbdd_a'
    ].join(',');
    const TRIGGER_SELECTOR = [
        '[aria-haspopup="true"]', '[aria-haspopup="menu"]',
        'ytd-menu-renderer yt-icon-button', 'ytd-menu-renderer button',
        'yt-button-shape button', 'ytd-button-renderer button',
        '.ytp-settings-button', '.ytp-button[aria-haspopup="true"]'
    ].join(',');
    const knownTags = ['yt-icon', 'yt-icon-shape', 'icon-shape'];
    knownTags.forEach((name) => {
        try {
            customElements.whenDefined(name).catch(() => { });
        }
        catch (_error) { }
    });
    function primeIcon(icon) {
        try {
            customElements.upgrade(icon);
        }
        catch (_error) { }
        void icon.localName;
        void getComputedStyle(icon).opacity;
        void icon.getBoundingClientRect();
        const shadow = icon.shadowRoot;
        if (shadow) {
            try {
                customElements.upgrade(shadow);
            }
            catch (_error) { }
            const inner = shadow.querySelector('svg, path, yt-icon, icon-shape');
            if (inner)
                void inner.getBoundingClientRect();
        }
    }
    function primeTree(root, limit = 100) {
        if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof ShadowRoot))
            return;
        try {
            customElements.upgrade(root);
        }
        catch (_error) { }
        let count = 0;
        if (root instanceof Element && root.matches(ICON_SELECTOR)) {
            primeIcon(root);
            count += 1;
        }
        for (const icon of root.querySelectorAll?.(ICON_SELECTOR) || []) {
            if (count >= limit)
                break;
            primeIcon(icon);
            count += 1;
        }
        if (root instanceof Element && root.matches?.(POPUP_SELECTOR)) {
            root.setAttribute('data-liquid-glass-icon-primed', '1');
        }
    }
    function primeMountedPopups(limit = 180) {
        let remaining = limit;
        for (const popup of document.querySelectorAll(POPUP_SELECTOR)) {
            if (remaining <= 0)
                break;
            popup.setAttribute('data-liquid-glass-icon-primed', '1');
            primeTree(popup, Math.min(90, remaining));
            remaining -= 90;
        }
    }
    const warmedTriggers = new WeakMap();
    let hoverWarmFrame = 0;
    const prewarmFromTrigger = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const trigger = target?.closest?.(TRIGGER_SELECTOR);
        if (!trigger)
            return;
        const now = performance.now();
        const last = warmedTriggers.get(trigger) || 0;
        if (event.type === 'pointerover' && now - last < 220)
            return;
        warmedTriggers.set(trigger, now);
        primeTree(trigger, 28);
        if (event.type === 'pointerdown' || event.type === 'focusin') {
            primeMountedPopups(120);
            queueMicrotask(() => primeMountedPopups(120));
            requestAnimationFrame(() => primeMountedPopups(120));
            return;
        }
        if (hoverWarmFrame)
            return;
        hoverWarmFrame = requestAnimationFrame(() => {
            hoverWarmFrame = 0;
            primeMountedPopups(80);
        });
    };
    document.addEventListener('pointerover', prewarmFromTrigger, { capture: true, passive: true });
    document.addEventListener('focusin', prewarmFromTrigger, true);
    document.addEventListener('pointerdown', prewarmFromTrigger, { capture: true, passive: true });
    function warmVisibleChrome() {
        const roots = [
            document.querySelector('ytd-masthead'),
            document.querySelector('ytd-guide-renderer'),
            document.querySelector('ytd-mini-guide-renderer'),
            document.querySelector('ytd-watch-flexy'),
            document.querySelector('ytd-page-manager')
        ].filter(Boolean);
        let budget = 420;
        for (const root of roots) {
            if (budget <= 0)
                break;
            const before = budget;
            let count = 0;
            for (const icon of root.querySelectorAll?.(ICON_SELECTOR) || []) {
                if (count >= Math.min(110, before))
                    break;
                primeIcon(icon);
                count += 1;
            }
            budget -= count;
        }
    }
    function scheduleBaselineWarmup() {
        const run = () => {
            warmVisibleChrome();
            primeMountedPopups(240);
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(run, { timeout: 650 });
            requestIdleCallback(run, { timeout: 1800 });
        }
        else {
            setTimeout(run, 220);
            setTimeout(run, 900);
        }
    }
    function startObserver() {
        const root = document.documentElement;
        if (!root)
            return;
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
                const popup = target?.closest?.(POPUP_SELECTOR);
                if (popup) {
                    popup.setAttribute('data-liquid-glass-icon-primed', '1');
                    for (const node of mutation.addedNodes)
                        if (node instanceof Element)
                            primeTree(node, 70);
                    continue;
                }
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element))
                        continue;
                    if (node.matches?.(POPUP_SELECTOR))
                        primeTree(node, 100);
                    else if (node.matches?.('ytd-popup-container, tp-yt-iron-dropdown')) {
                        for (const child of node.querySelectorAll(POPUP_SELECTOR))
                            primeTree(child, 90);
                    }
                }
            }
        });
        observer.observe(root, { childList: true, subtree: true });
    }
    if (document.documentElement) {
        startObserver();
        scheduleBaselineWarmup();
    }
    else {
        document.addEventListener('DOMContentLoaded', () => {
            startObserver();
            scheduleBaselineWarmup();
        }, { once: true });
    }
})();
