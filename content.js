(() => {
    'use strict';
    const DEFAULTS = {
        enabled: true,
        refraction: true,
        bounce: true,
        adaptiveChipText: true,
        hideShorts: true,
        hideMusic: true,
        hideKids: true,
        hidePremium: true,
        hideAiOverview: true,
        hideJoin: true,
        hideShare: true,
        hideSave: true,
        hideDownload: true
    };
    const HIDE_ATTR = 'data-liquid-glass-hidden';
    const ACTION_SELECTOR = [
        'ytd-menu-service-item-renderer',
        'ytd-menu-navigation-item-renderer',
        'yt-list-item-view-model',
        '[role="menuitem"]',
        'tp-yt-paper-item',
        'ytd-button-renderer',
        'yt-button-view-model',
        'tp-yt-paper-button',
        'button[aria-label]',
        'button[title]',
        '[role="button"][aria-label]',
        'a[aria-label]'
    ].join(',');
    const NAV_SELECTOR = [
        'ytd-guide-entry-renderer',
        'ytd-mini-guide-entry-renderer',
        'ytd-compact-link-renderer'
    ].join(',');
    const ACTION_TERMS = {
        join: ['join', 'liity', 'jäseneksi', 'jäsenyys', 'become a member', 'join this channel'],
        share: ['share', 'jaa', 'dela', 'teilen', 'compartir', 'partager', 'поделиться', '共有'],
        save: ['save to playlist', 'save', 'tallenna', 'spara', 'speichern', 'guardar', 'enregistrer', 'salva', 'gem', 'lagre'],
        download: ['download', 'lataa', 'ladda ned', 'last ned', 'nedladdning', 'herunterladen', 'descargar', 'télécharger', 'scarica', 'baixar', 'downloaden', 'pobierz']
    };
    const MORE_FROM_YOUTUBE = [
        'more from youtube', 'lisää youtubelta', 'mehr von youtube', 'más de youtube',
        'plus de youtube', 'altro da youtube', 'meer van youtube'
    ];
    const GUIDE_EXPANDER_TERMS = [
        'show more', 'show less', 'näytä lisää', 'näytä vähemmän', 'visa fler', 'visa mindre',
        'mehr anzeigen', 'weniger anzeigen', 'mostrar más', 'mostrar menos', 'afficher plus',
        'afficher moins', 'mostra altro', 'mostra meno', 'meer weergeven', 'minder weergeven'
    ];
    const GUIDE_HOST_ATTR = 'data-liquid-glass-guide-expander';
    const GUIDE_CONTROL_ATTR = 'data-liquid-glass-guide-expander-control';
    const GUIDE_EXPANDED_ATTR = 'data-liquid-glass-guide-expanded';
    let settings = { ...DEFAULTS };
    let cleanupTimer = 0;
    let refreshHidden = true;
    const managedHidden = new Set();
    const hiddenInlineState = new WeakMap();
    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, parent) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        if (parent)
            parent.appendChild(node);
        return node;
    }
    function buildRefractionFilter(defs, id, opts) {
        const filter = svgEl('filter', {
            id,
            x: opts.x, y: opts.y, width: opts.width, height: opts.height,
            'color-interpolation-filters': 'sRGB'
        }, defs);
        svgEl('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: opts.sigma, result: 'b' }, filter);
        svgEl('feColorMatrix', { in: 'b', type: 'matrix', values: '0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1', result: 'h' }, filter);
        const convolve = (kernel, result) => svgEl('feConvolveMatrix', {
            in: 'h', order: '3', kernelMatrix: kernel, divisor: opts.divisor, bias: '0.5',
            targetX: '1', targetY: '1', edgeMode: 'duplicate', preserveAlpha: 'true', result
        }, filter);
        convolve('1 0 -1  2 0 -2  1 0 -1', 'cx');
        convolve('1 2 1  0 0 0  -1 -2 -1', 'cy');
        svgEl('feColorMatrix', { in: 'cx', type: 'matrix', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0.5  0 0 0 0 1', result: 'xr' }, filter);
        svgEl('feColorMatrix', { in: 'cy', type: 'matrix', values: '0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1', result: 'yg' }, filter);
        svgEl('feComposite', { in: 'xr', in2: 'yg', operator: 'arithmetic', k1: '0', k2: '1', k3: '1', k4: '0', result: 'map' }, filter);
        svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: opts.scale, xChannelSelector: 'R', yChannelSelector: 'G' }, filter);
    }
    function installLiquidFilter() {
        if (document.getElementById('lg-liquid-filter-bank'))
            return;
        const svg = svgEl('svg', { id: 'lg-liquid-filter-bank', 'aria-hidden': 'true', width: '0', height: '0' });
        svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;';
        const defs = svgEl('defs', {}, svg);
        buildRefractionFilter(defs, 'lg-refract', { x: '-8%', y: '-8%', width: '116%', height: '116%', sigma: '6', divisor: '1.1', scale: '-80' });
        buildRefractionFilter(defs, 'lg-refract-bar', { x: '-2%', y: '-50%', width: '104%', height: '200%', sigma: '4.5', divisor: '1.1', scale: '-64' });
        document.documentElement.appendChild(svg);
    }
    installLiquidFilter();
    function normalize(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    }
    function nodeText(node) {
        if (!node)
            return '';
        return normalize([
            node.getAttribute?.('aria-label'),
            node.getAttribute?.('title'),
            node.getAttribute?.('data-tooltip-text'),
            node.getAttribute?.('data-tooltip'),
            node.getAttribute?.('id'),
            node.getAttribute?.('data'),
            node.innerText,
            node.textContent
        ].filter(Boolean).join(' '));
    }
    function deepQueryAll(root, selector) {
        const out = [];
        const walk = (node) => {
            if (!node)
                return;
            node.querySelectorAll?.(selector).forEach((el) => out.push(el));
            const all = node.querySelectorAll?.('*') || [];
            for (const el of all)
                if (el.shadowRoot)
                    walk(el.shadowRoot);
            if (node.shadowRoot)
                walk(node.shadowRoot);
        };
        walk(root);
        return out;
    }
    function setHidden(element) {
        if (!element || element === document.body || element === document.documentElement)
            return;
        if (element.getAttribute(HIDE_ATTR) === '1')
            return;
        element.setAttribute(HIDE_ATTR, '1');
        if (!hiddenInlineState.has(element)) {
            hiddenInlineState.set(element, {
                value: element.style.getPropertyValue('display'),
                priority: element.style.getPropertyPriority('display')
            });
        }
        element.style.setProperty('display', 'none', 'important');
        managedHidden.add(element);
    }
    function restoreHidden() {
        managedHidden.forEach((element) => {
            if (!element.isConnected)
                return;
            element.removeAttribute(HIDE_ATTR);
            const previous = hiddenInlineState.get(element);
            if (previous?.value)
                element.style.setProperty('display', previous.value, previous.priority || '');
            else
                element.style.removeProperty('display');
            hiddenInlineState.delete(element);
        });
        managedHidden.clear();
    }
    function pruneDetachedHidden() {
        managedHidden.forEach((element) => {
            if (element.isConnected)
                return;
            element.removeAttribute(HIDE_ATTR);
            const previous = hiddenInlineState.get(element);
            if (previous?.value)
                element.style.setProperty('display', previous.value, previous.priority || '');
            else
                element.style.removeProperty('display');
            hiddenInlineState.delete(element);
            managedHidden.delete(element);
        });
    }
    let bootTimer = 0;
    let bootReadyFrame = 0;
    let bootReadyTimer = 0;
    let bootPending = false;
    let bootChipSignature = '';
    let bootChipStableFrames = 0;
    let wasActive = false;
    function playBoot() {
        const root = document.documentElement;
        root.removeAttribute('data-liquid-glass-preboot');
        root.removeAttribute('data-liquid-glass-boot');
        void root.offsetWidth;
        root.setAttribute('data-liquid-glass-boot', '');
        window.clearTimeout(bootTimer);
        bootTimer = window.setTimeout(() => root.removeAttribute('data-liquid-glass-boot'), 1500);
    }
    function cancelBootPreparation() {
        bootPending = false;
        if (bootReadyFrame)
            cancelAnimationFrame(bootReadyFrame);
        bootReadyFrame = 0;
        window.clearTimeout(bootReadyTimer);
        bootReadyTimer = 0;
        bootChipSignature = '';
        bootChipStableFrames = 0;
        document.documentElement.removeAttribute('data-liquid-glass-preboot');
    }
    function bootChromeReady(elapsed) {
        const masthead = document.querySelector('ytd-masthead #container.ytd-masthead');
        if (!masthead || masthead.getBoundingClientRect().width < 200)
            return false;
        if (location.pathname === '/watch' || location.pathname.startsWith('/watch/'))
            return true;
        const bar = document.querySelector('ytd-feed-filter-chip-bar-renderer');
        const scroll = bar?.querySelector('#scroll-container');
        const chips = bar?.querySelector('#chips');
        if (!bar || !scroll || !chips || scroll.clientWidth < 80)
            return false;
        const visibleChips = Array.from(chips.querySelectorAll(':scope > yt-chip-cloud-chip-renderer, :scope > chip-view-model, :scope > [role="presentation"]'))
            .filter((chip) => getComputedStyle(chip).display !== 'none' && chip.offsetWidth > 0);
        tidyChipBar(bar);
        fitPrimaryChipBars(bar);
        const signature = `${scroll.clientWidth}|${visibleChips.map((chip) => `${nodeText(chip)}:${chip.offsetWidth}`).join('|')}`;
        if (signature === bootChipSignature)
            bootChipStableFrames += 1;
        else {
            bootChipSignature = signature;
            bootChipStableFrames = 0;
        }
        return elapsed >= 120 && visibleChips.length >= 3 && bootChipStableFrames >= 2;
    }
    function requestBoot() {
        if (bootPending)
            return;
        bootPending = true;
        const root = document.documentElement;
        root.setAttribute('data-liquid-glass-preboot', 'true');
        const started = performance.now();
        const attempt = () => {
            bootReadyFrame = 0;
            if (!bootPending || !settings.enabled) {
                cancelBootPreparation();
                return;
            }
            const elapsed = performance.now() - started;
            if (bootChromeReady(elapsed) || elapsed >= 700) {
                tidyChipBar();
                fitPrimaryChipBars();
                bootPending = false;
                window.clearTimeout(bootReadyTimer);
                bootReadyTimer = 0;
                playBoot();
                return;
            }
            bootReadyFrame = requestAnimationFrame(attempt);
        };
        bootReadyFrame = requestAnimationFrame(attempt);
        bootReadyTimer = window.setTimeout(() => {
            if (!bootPending)
                return;
            tidyChipBar();
            fitPrimaryChipBars();
            bootPending = false;
            if (bootReadyFrame)
                cancelAnimationFrame(bootReadyFrame);
            bootReadyFrame = 0;
            playBoot();
        }, 760);
    }
    let previousWatchRoute = null;
    let guideEnterTimer = 0;
    let guideExitTimer = 0;
    let guideExitGhostTimer = 0;
    let guideExitGhost = null;
    let guideExitSource = null;
    let pendingWatchNavigation = null;
    let replayingWatchNavigation = false;
    let skipNextWatchRouteExit = false;
    let skipNextWatchRouteExitTimer = 0;
    let frozenWatchNavigationVisual = null;
    let frozenWatchNavigationTimer = 0;
    const GUIDE_EXIT_CLEANUP_MS = 560;
    const WATCH_NAV_FREEZE_ATTR = 'data-liquid-glass-watch-nav-freeze';
    function clearWatchNavigationVisual() {
        window.clearTimeout(frozenWatchNavigationTimer);
        frozenWatchNavigationTimer = 0;
        if (frozenWatchNavigationVisual) {
            frozenWatchNavigationVisual.forEach(({ node, state }) => {
                if (!(node instanceof HTMLElement))
                    return;
                node.removeAttribute(WATCH_NAV_FREEZE_ATTR);
                ['transform', 'transition', 'box-shadow'].forEach((property) => {
                    const saved = state[property];
                    if (saved?.value)
                        node.style.setProperty(property, saved.value, saved.priority || '');
                    else
                        node.style.removeProperty(property);
                });
            });
        }
        frozenWatchNavigationVisual = null;
        document.documentElement.removeAttribute('data-liquid-glass-watch-nav-pending');
    }
    function freezeWatchNavigationVisual(link, path = []) {
        clearWatchNavigationVisual();
        const cardSelector = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model';
        const visualSelector = 'ytd-thumbnail, yt-thumbnail-view-model, .yt-lockup-view-model-wiz__content-image';
        const card = path.find((node) => node?.matches?.(cardSelector)) || link?.closest?.(cardSelector);
        if (!card)
            return;
        const visuals = Array.from(new Set([
            ...path.filter((node) => node?.matches?.(visualSelector)),
            ...card.querySelectorAll(visualSelector)
        ])).filter((node) => node instanceof HTMLElement);
        if (!visuals.length)
            return;
        frozenWatchNavigationVisual = visuals.map((node) => {
            const computed = getComputedStyle(node);
            const state = {};
            ['transform', 'transition', 'box-shadow'].forEach((property) => {
                state[property] = {
                    value: node.style.getPropertyValue(property),
                    priority: node.style.getPropertyPriority(property)
                };
            });
            node.setAttribute(WATCH_NAV_FREEZE_ATTR, '1');
            node.style.setProperty('transition', 'none', 'important');
            node.style.setProperty('transform', computed.transform === 'none' ? 'none' : computed.transform, 'important');
            node.style.setProperty('box-shadow', computed.boxShadow === 'none' ? 'none' : computed.boxShadow, 'important');
            return { node, state };
        });
        document.documentElement.setAttribute('data-liquid-glass-watch-nav-pending', 'true');
        frozenWatchNavigationTimer = window.setTimeout(clearWatchNavigationVisual, 2400);
    }
    function clearGuideExitGhost() {
        window.clearTimeout(guideExitGhostTimer);
        if (guideExitGhost?.isConnected)
            guideExitGhost.remove();
        if (guideExitSource?.isConnected)
            guideExitSource.removeAttribute('data-liquid-glass-guide-source-exiting');
        guideExitGhost = null;
        guideExitSource = null;
    }
    function findVisibleGuide() {
        const candidates = Array.from(document.querySelectorAll('ytd-guide-renderer'));
        return candidates.find((candidate) => {
            const rect = candidate.getBoundingClientRect?.();
            const style = getComputedStyle(candidate);
            return rect && rect.width > 120 && rect.height > 160 && style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > .05;
        }) || null;
    }
    function makeGuideExitGhost() {
        const guide = findVisibleGuide();
        if (!guide)
            return null;
        const rect = guide.getBoundingClientRect();
        clearGuideExitGhost();
        const ghost = document.createElement('div');
        ghost.setAttribute('data-liquid-glass-guide-ghost', '1');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('inert', '');
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.innerHTML = guide.innerHTML;
        document.body.appendChild(ghost);
        ghost.scrollTop = guide.scrollTop || 0;
        guide.setAttribute('data-liquid-glass-guide-source-exiting', '1');
        guideExitGhost = ghost;
        guideExitSource = guide;
        guideExitGhostTimer = window.setTimeout(clearGuideExitGhost, GUIDE_EXIT_CLEANUP_MS);
        return ghost;
    }
    function startGuideExit(useGhost = true) {
        if (!settings.enabled)
            return null;
        const root = document.documentElement;
        window.clearTimeout(guideEnterTimer);
        root.removeAttribute('data-liquid-glass-guide-enter');
        let animationTarget = null;
        if (useGhost) {
            if (!guideExitGhost?.isConnected)
                makeGuideExitGhost();
            animationTarget = guideExitGhost;
        } else {
            clearGuideExitGhost();
            animationTarget = findVisibleGuide();
        }
        if (root.getAttribute('data-liquid-glass-guide-exit') !== 'true') {
            root.removeAttribute('data-liquid-glass-guide-exit');
            void root.offsetWidth;
            root.setAttribute('data-liquid-glass-guide-exit', 'true');
        }
        window.clearTimeout(guideExitTimer);
        guideExitTimer = window.setTimeout(() => root.removeAttribute('data-liquid-glass-guide-exit'), GUIDE_EXIT_CLEANUP_MS);
        return animationTarget;
    }
    function startGuideEnter() {
        if (!settings.enabled)
            return;
        const root = document.documentElement;
        clearGuideExitGhost();
        window.clearTimeout(guideExitTimer);
        root.removeAttribute('data-liquid-glass-guide-exit');
        root.removeAttribute('data-liquid-glass-guide-enter');
        void root.offsetWidth;
        root.setAttribute('data-liquid-glass-guide-enter', 'true');
        window.clearTimeout(guideEnterTimer);
        guideEnterTimer = window.setTimeout(() => root.removeAttribute('data-liquid-glass-guide-enter'), 900);
    }
    function syncRouteState() {
        const root = document.documentElement;
        const watchRoute = location.pathname === '/watch' || location.pathname.startsWith('/watch/');
        const enteringWatch = previousWatchRoute === false && watchRoute;
        const leavingWatch = previousWatchRoute === true && !watchRoute;
        root.setAttribute('data-liquid-glass-watch-page', watchRoute ? 'true' : 'false');
        if (enteringWatch) {
            if (skipNextWatchRouteExit) {
                skipNextWatchRouteExit = false;
                window.clearTimeout(skipNextWatchRouteExitTimer);
            } else {
                startGuideExit();
            }
        }
        if (leavingWatch)
            startGuideEnter();
        previousWatchRoute = watchRoute;
    }
    function releaseWatchNavigation(link, url) {
        const pending = pendingWatchNavigation;
        if (!pending)
            return;
        pendingWatchNavigation = null;
        skipNextWatchRouteExit = true;
        window.clearTimeout(skipNextWatchRouteExitTimer);
        skipNextWatchRouteExitTimer = window.setTimeout(() => {
            skipNextWatchRouteExit = false;
        }, 2200);
        replayingWatchNavigation = true;
        try {
            if (link?.isConnected)
                link.click();
            else
                location.assign(url.href);
        } finally {
            replayingWatchNavigation = false;
        }
    }
    function delayWatchNavigation(link, url) {
        if (pendingWatchNavigation)
            return;
        const animationTarget = startGuideExit(false);
        if (!animationTarget) {
            pendingWatchNavigation = { link, url };
            releaseWatchNavigation(link, url);
            return;
        }
        const pending = { link, url, animationTarget, timer: 0 };
        pendingWatchNavigation = pending;
        const finish = () => {
            if (pendingWatchNavigation !== pending)
                return;
            animationTarget.removeEventListener('animationend', onAnimationEnd);
            window.clearTimeout(pending.timer);
            requestAnimationFrame(() => releaseWatchNavigation(link, url));
        };
        const onAnimationEnd = (event) => {
            if (event.target === animationTarget && event.animationName === 'lg-guide-exit')
                finish();
        };
        animationTarget.addEventListener('animationend', onAnimationEnd);
        pending.timer = window.setTimeout(finish, GUIDE_EXIT_CLEANUP_MS);
    }
    window.addEventListener('click', (event) => {
        if (replayingWatchNavigation)
            return;
        if (!settings.enabled || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        if (location.pathname === '/watch' || location.pathname.startsWith('/watch/'))
            return;
        const path = event.composedPath?.() || [];
        const link = path.find((node) => node?.matches?.('a[href]'));
        if (!link || link.getAttribute('target') === '_blank' || link.hasAttribute('download'))
            return;
        let url;
        try {
            url = new URL(link.href || link.getAttribute('href'), location.href);
        } catch {
            return;
        }
        if (url.origin !== location.origin || (url.pathname !== '/watch' && !url.pathname.startsWith('/watch/')))
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        freezeWatchNavigationVisual(link, path);
        delayWatchNavigation(link, url);
    }, true);
    function applyRootState() {
        const root = document.documentElement;
        syncRouteState();
        const active = settings.enabled;
        if (settings.enabled)
            root.setAttribute('data-liquid-glass-clean', 'true');
        else
            root.removeAttribute('data-liquid-glass-clean');
        if (active)
            root.setAttribute('data-liquid-glass-active', 'true');
        else
            root.removeAttribute('data-liquid-glass-active');
        root.setAttribute('data-liquid-glass-refract', String(active && settings.refraction));
        root.setAttribute('data-liquid-glass-bounce', String(settings.bounce));
        root.setAttribute('data-liquid-glass-adaptive-chip-text', String(active && settings.adaptiveChipText));
        root.setAttribute('data-liquid-glass-hide-ai-overview', String(active && settings.hideAiOverview));
        if (active && !wasActive)
            requestBoot();
        else if (!active)
            cancelBootPreparation();
        wasActive = active;
    }
    let fullscreenWasActive = false;
    let fullscreenReturnTimer = 0;
    function pulseFullscreenReturn() {
        const root = document.documentElement;
        root.removeAttribute('data-liquid-glass-fullscreen-return');
        void root.offsetWidth;
        root.setAttribute('data-liquid-glass-fullscreen-return', 'true');
        window.clearTimeout(fullscreenReturnTimer);
        fullscreenReturnTimer = window.setTimeout(() => {
            root.removeAttribute('data-liquid-glass-fullscreen-return');
        }, 760);
    }
    function syncFullscreenState() {
        const fullscreenRoot = document.fullscreenElement || document.webkitFullscreenElement || null;
        const active = Boolean(fullscreenRoot);
        const root = document.documentElement;
        document.querySelectorAll('[data-liquid-glass-fullscreen-host="1"]').forEach((el) => {
            if (el !== fullscreenRoot)
                el.removeAttribute('data-liquid-glass-fullscreen-host');
        });
        if (active) {
            fullscreenWasActive = true;
            root.removeAttribute('data-liquid-glass-fullscreen-return');
            root.setAttribute('data-liquid-glass-player-fullscreen', 'true');
            fullscreenRoot?.setAttribute?.('data-liquid-glass-fullscreen-host', '1');
            return;
        }
        root.removeAttribute('data-liquid-glass-player-fullscreen');
        document.querySelectorAll('[data-liquid-glass-fullscreen-host="1"]').forEach((el) => {
            el.removeAttribute('data-liquid-glass-fullscreen-host');
        });
        if (fullscreenWasActive) {
            fullscreenWasActive = false;
            pulseFullscreenReturn();
            window.requestAnimationFrame(() => scheduleCleanup(false));
        }
    }
    function settleFullscreenState() {
        [0, 40, 140, 320].forEach((delay) => window.setTimeout(syncFullscreenState, delay));
    }
    function hrefOf(element) {
        const link = element.matches?.('a[href]') ? element : element.querySelector?.('a[href]');
        return (link?.getAttribute('href') || element.getAttribute?.('href') || '').toLocaleLowerCase();
    }
    function navigationRuleMatches(label, href) {
        const rules = [
            [settings.hideShorts, ['shorts', '/shorts', 'feed/shorts']],
            [settings.hideMusic, ['music.youtube.com', 'youtube music', 'music']],
            [settings.hideKids, ['youtubekids.com', 'youtube kids', 'kids.google.com']],
            [settings.hidePremium, ['/premium', 'youtube premium', 'premium']]
        ];
        return rules.some(([enabled, keywords]) => enabled && keywords.some((keyword) => label.includes(keyword) || href.includes(keyword)));
    }
    function isGuideExpander(element) {
        if (!element)
            return false;
        if (element.matches?.('ytd-guide-collapsible-entry-renderer'))
            return true;
        const label = nodeText(element);
        if (!GUIDE_EXPANDER_TERMS.some((term) => label.includes(term)))
            return false;
        return !hrefOf(element) || Boolean(element.querySelector?.('button, [role="button"], tp-yt-paper-button'));
    }
    function hideNavigationEntries() {
        if (!settings.hideShorts && !settings.hideMusic && !settings.hideKids && !settings.hidePremium)
            return;
        document.querySelectorAll(NAV_SELECTOR).forEach((entry) => {
            if (isGuideExpander(entry))
                return;
            const label = nodeText(entry);
            const href = hrefOf(entry);
            if (navigationRuleMatches(label, href))
                setHidden(entry);
        });
        document.querySelectorAll('#guide-content a[href], ytd-guide-renderer a[href], ytd-mini-guide-renderer a[href]').forEach((link) => {
            if (link.closest(`[${HIDE_ATTR}="1"]`))
                return;
            if (isGuideExpander(link.closest('ytd-guide-entry-renderer, ytd-guide-collapsible-entry-renderer') || link))
                return;
            if (navigationRuleMatches(nodeText(link), hrefOf(link))) {
                setHidden(link.closest(`${NAV_SELECTOR}, yt-list-item-view-model`) || link);
            }
        });
    }
    const SEARCH_SHORTS_HIDDEN = new Set();
    const SHORTS_HIDDEN = new Set();
    let shortsSearchClickOverrideUntil = 0;
    function isSearchResultsPage() {
        return location.pathname === '/results';
    }
    function isShortsLabel(label) {
        const value = normalize(label);
        return value === 'shorts'
            || value === 'shortsit'
            || value === 'short videos'
            || value === 'short-videoer'
            || value === 'shortsvideos'
            || value === 'cortos'
            || value === 'courts'
            || value === 'kurzvideos'
            || value.startsWith('shorts ')
            || value.startsWith('shortsit ');
    }
    function explicitShortsSearchSelected() {
        if (!isSearchResultsPage())
            return false;
        const selected = Array.from(document.querySelectorAll([
            '[role="tab"][aria-selected="true"]',
            'yt-chip-cloud-chip-renderer[selected]',
            'chip-view-model:has([role="tab"][aria-selected="true"])',
            'chip-shape button[aria-selected="true"]'
        ].join(','))).filter((el) => el.getClientRects?.().length || el.offsetParent !== null);
        if (selected.length)
            return selected.some((el) => isShortsLabel(nodeText(el)));
        return performance.now() < shortsSearchClickOverrideUntil;
    }
    function restoreTrackedShorts() {
        SHORTS_HIDDEN.forEach((element) => {
            if (!element?.isConnected) {
                SHORTS_HIDDEN.delete(element);
                SEARCH_SHORTS_HIDDEN.delete(element);
                return;
            }
            if (element.getAttribute(HIDE_ATTR) !== '1' || !managedHidden.has(element)) {
                SHORTS_HIDDEN.delete(element);
                SEARCH_SHORTS_HIDDEN.delete(element);
                return;
            }
            element.removeAttribute(HIDE_ATTR);
            const previous = hiddenInlineState.get(element);
            if (previous?.value)
                element.style.setProperty('display', previous.value, previous.priority || '');
            else
                element.style.removeProperty('display');
            hiddenInlineState.delete(element);
            managedHidden.delete(element);
            SHORTS_HIDDEN.delete(element);
            SEARCH_SHORTS_HIDDEN.delete(element);
        });
    }
    function restoreSearchShorts() {
        restoreTrackedShorts();
    }
    function isExplicitShortsContext() {
        if (location.pathname === '/shorts' || location.pathname.startsWith('/shorts/'))
            return true;
        if (!isSearchResultsPage()) {
            const selected = Array.from(document.querySelectorAll([
                '[role="tab"][aria-selected="true"]',
                'yt-chip-cloud-chip-renderer[selected]',
                'chip-view-model:has([role="tab"][aria-selected="true"])',
                'chip-shape button[aria-selected="true"]'
            ].join(','))).filter((el) => el.getClientRects?.().length || el.offsetParent !== null);
            if (selected.some((el) => isShortsLabel(nodeText(el))))
                return true;
            const activeShortsNav = document.querySelector('ytd-guide-entry-renderer[active] a[href^="/shorts"], ytd-mini-guide-entry-renderer[active] a[href^="/shorts"], a[aria-current="page"][href^="/shorts"]');
            if (activeShortsNav)
                return true;
        }
        return explicitShortsSearchSelected();
    }
    function hideShortsShelves() {
        const searchPage = isSearchResultsPage();
        const allowShorts = isExplicitShortsContext();
        if (allowShorts) {
            document.documentElement.setAttribute('data-liquid-glass-shorts-mode', 'show');
            if (searchPage)
                document.documentElement.setAttribute('data-liquid-glass-search-shorts', 'show');
            restoreTrackedShorts();
            return;
        }
        if (!settings.hideShorts && !searchPage) {
            document.documentElement.removeAttribute('data-liquid-glass-shorts-mode');
            return;
        }
        document.documentElement.setAttribute('data-liquid-glass-shorts-mode', 'hide');
        if (searchPage)
            document.documentElement.setAttribute('data-liquid-glass-search-shorts', 'hide');
        else
            document.documentElement.removeAttribute('data-liquid-glass-search-shorts');
        const hideNode = (node) => {
            if (!node)
                return;
            setHidden(node);
            SHORTS_HIDDEN.add(node);
            if (searchPage)
                SEARCH_SHORTS_HIDDEN.add(node);
        };
        const directSelectors = [
            'ytd-reel-shelf-renderer',
            'ytd-reel-item-renderer',
            'ytd-rich-shelf-renderer[is-shorts]',
            'ytd-shorts',
            'ytd-shorts-lockup-view-model',
            'ytm-shorts-lockup-view-model',
            'ytm-shorts-lockup-view-model-v2',
            'yt-shorts-lockup-view-model',
            'grid-shelf-view-model:has(a[href^="/shorts/"])',
            'ytd-rich-grid-group:has(a[href^="/shorts/"])'
        ];
        document.querySelectorAll(directSelectors.join(',')).forEach((node) => {
            const isShelf = node.matches?.('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-shorts, grid-shelf-view-model, ytd-rich-grid-group');
            const section = isShelf
                ? node.closest('ytd-rich-section-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer, grid-shelf-view-model, ytd-rich-grid-group')
                : null;
            hideNode(section || node);
        });
        const cardSelector = [
            'ytd-reel-item-renderer',
            'ytd-shorts-lockup-view-model',
            'ytm-shorts-lockup-view-model',
            'ytm-shorts-lockup-view-model-v2',
            'yt-shorts-lockup-view-model',
            'ytd-video-renderer',
            'ytd-rich-item-renderer',
            'ytd-compact-video-renderer',
            'ytd-grid-video-renderer',
            'yt-lockup-view-model',
            'yt-video-view-model',
            'ytd-rich-grid-media'
        ].join(',');
        document.querySelectorAll('a[href^="/shorts"], a[href*="youtube.com/shorts/"]').forEach((anchor) => {
            hideNode(anchor.closest(cardSelector));
        });
        document.querySelectorAll([
            'ytd-rich-section-renderer',
            'ytd-rich-shelf-renderer',
            'ytd-shelf-renderer',
            'ytd-horizontal-card-list-renderer',
            'yt-horizontal-list-renderer',
            'grid-shelf-view-model',
            'ytd-rich-grid-group'
        ].join(',')).forEach((section) => {
            const headings = Array.from(section.querySelectorAll([
                '#title', '#title-text', '#header #title', '#header yt-formatted-string',
                '#rich-shelf-header-container', 'h2', 'h3', '[role="heading"]',
                'yt-formatted-string[title]', '[aria-label="Shorts" i]', '[title="Shorts" i]'
            ].join(',')));
            const headingIsShorts = headings.some((heading) => isShortsLabel(nodeText(heading)));
            const sectionText = normalize(section.innerText || section.textContent);
            const sectionStartsWithShorts = sectionText === 'shorts'
                || sectionText.startsWith('shorts ')
                || sectionText.startsWith('shortsit ');
            const isMarkedShorts = section.matches?.('[is-shorts], [title="Shorts" i], [aria-label="Shorts" i]')
                || Boolean(section.querySelector('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-shorts'));
            const shortLinks = Array.from(section.querySelectorAll('a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'));
            const dedicatedModernShelf = section.matches?.('grid-shelf-view-model, ytd-rich-grid-group, ytd-rich-section-renderer')
                && shortLinks.length > 0;
            if (headingIsShorts || sectionStartsWithShorts || isMarkedShorts || dedicatedModernShelf) {
                hideNode(section);
                return;
            }
            const links = Array.from(section.querySelectorAll('a[href]'));
            if (links.length && shortLinks.length && links.every((a) => /(?:^|youtube\.com)\/shorts\//i.test(a.getAttribute('href') || a.href || '')))
                hideNode(section);
        });
        document.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]').forEach((badge) => {
            hideNode(badge.closest(cardSelector));
        });
    }
    function isActionLabel(label, action) {
        if (!label || label.length > 180)
            return false;
        return ACTION_TERMS[action].some((term) => label.includes(term));
    }
    function actionFor(element) {
        const label = nodeText(element);
        for (const action of Object.keys(ACTION_TERMS)) {
            if (settings[`hide${action[0].toUpperCase()}${action.slice(1)}`] && isActionLabel(label, action))
                return action;
        }
        return null;
    }
    function isInMenu(element) {
        return Boolean(element.closest('ytd-menu-popup-renderer, ytd-popup-container, tp-yt-paper-dialog, [role="menu"], yt-contextual-sheet-layout'));
    }
    function hideVideoActions() {
        const roots = document.querySelectorAll([
            'ytd-watch-flexy',
            'ytd-popup-container',
            'ytd-menu-popup-renderer',
            'tp-yt-paper-dialog',
            'ytd-video-owner-renderer',
            'ytd-channel-header-renderer',
            'yt-contextual-sheet-layout'
        ].join(','));
        const candidates = new Set();
        roots.forEach((root) => {
            if (root.matches(ACTION_SELECTOR))
                candidates.add(root);
            root.querySelectorAll(ACTION_SELECTOR).forEach((element) => candidates.add(element));
        });
        candidates.forEach((element) => {
            if (element.closest(`[${HIDE_ATTR}="1"]`))
                return;
            const action = actionFor(element);
            if (!action)
                return;
            const menu = isInMenu(element);
            const inWatchArea = Boolean(element.closest([
                'ytd-watch-flexy',
                'ytd-video-owner-renderer',
                'ytd-subscribe-button-renderer',
                'ytd-channel-header-renderer',
                '#top-level-buttons-computed',
                '#actions'
            ].join(',')));
            if (!menu && !inWatchArea)
                return;
            let control;
            if (menu) {
                control = element.closest('ytd-menu-service-item-renderer')
                    || element.closest('ytd-menu-navigation-item-renderer')
                    || element.closest('yt-list-item-view-model')
                    || element.closest('[role="menuitem"]')
                    || element.closest('tp-yt-paper-item')
                    || element.closest('yt-button-view-model, ytd-button-renderer, button, [role="button"]')
                    || element;
            }
            else {
                control = element.closest('ytd-button-renderer, yt-button-view-model, tp-yt-paper-button, button, [role="button"]') || element;
            }
            setHidden(control);
        });
    }
    function hideEmptyYouTubeSections() {
        document.querySelectorAll('ytd-guide-section-renderer').forEach((section) => {
            const heading = section.querySelector('#title, #guide-section-title, h3, .title');
            const title = nodeText(heading);
            const sectionText = nodeText(section);
            if (![title, sectionText].some((value) => MORE_FROM_YOUTUBE.some((phrase) => value.includes(phrase))))
                return;
            const rows = Array.from(section.querySelectorAll(NAV_SELECTOR));
            if (rows.length && rows.every((row) => row.getAttribute(HIDE_ATTR) === '1'))
                setHidden(section);
        });
    }
    const SUBMIT_ATTR = 'data-liquid-glass-search-submit';
    const SEARCH_LEADING_ATTR = 'data-liquid-glass-search-leading';
    const SEARCH_STRIP_PSEUDO_ATTR = 'data-liquid-glass-search-strip-pseudo';
    const SEARCH_DISMISSED_ATTR = 'data-liquid-glass-search-suggestions-dismissed';
    const SEARCH_COMMIT_ATTR = 'data-liquid-glass-search-committing';
    const CHIP_SURFACE_ATTR = 'data-liquid-glass-chip-surface';
    const CHIP_ADAPTIVE_ATTR = 'data-liquid-glass-adaptive-category';
    const CHIP_SELECTED_ATTR = 'data-liquid-glass-chip-selected';
    const SHADOW_STYLE_ID = 'liquid-glass-runtime-patch';
    function installShadowPatch(root) {
        if (!root || root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE || root.getElementById?.(SHADOW_STYLE_ID))
            return;
        const style = document.createElement('style');
        style.id = SHADOW_STYLE_ID;
        style.textContent = `
      [${SEARCH_LEADING_ATTR}="1"] {
        display:none!important; visibility:hidden!important; opacity:0!important;
        width:0!important; min-width:0!important; max-width:0!important;
        height:0!important; min-height:0!important; max-height:0!important;
        margin:0!important; padding:0!important; border:0!important;
        background:none!important; box-shadow:none!important; pointer-events:none!important;
      }
      [${SEARCH_LEADING_ATTR}="1"]::before,
      [${SEARCH_LEADING_ATTR}="1"]::after,
      [${SEARCH_STRIP_PSEUDO_ATTR}="1"]::before,
      [${SEARCH_STRIP_PSEUDO_ATTR}="1"]::after {
        content:none!important; display:none!important; background:none!important;
        background-image:none!important; -webkit-mask:none!important; mask:none!important;
        box-shadow:none!important;
      }
      input[type="search"] { -webkit-appearance:none!important; appearance:none!important; }
      input[type="search"]::-webkit-search-decoration,
      input[type="search"]::-webkit-search-results-button,
      input[type="search"]::-webkit-search-results-decoration {
        -webkit-appearance:none!important; appearance:none!important; display:none!important;
        width:0!important; height:0!important; margin:0!important; padding:0!important;
      }
      :is([class*="InputBox"],[class*="inputBox"],[class*="SearchboxComponentInput"])
        :is([class*="SearchIcon"],[class*="searchIcon"],[class*="LeadingIcon"],[class*="leadingIcon"]) {
        display:none!important; visibility:hidden!important; opacity:0!important;
        width:0!important; min-width:0!important; max-width:0!important;
        margin:0!important; padding:0!important; pointer-events:none!important;
      }
      .ytSearchboxComponentInputBox > :not(form):not(.ytSearchboxComponentYtdTextInputAssistantWrapper):not([class*="TextInputAssistant"]) {
        display:none!important; visibility:hidden!important; opacity:0!important;
        inline-size:0!important; block-size:0!important; margin:0!important; padding:0!important; pointer-events:none!important;
      }
      .ytSearchboxComponentInputBox, .ytSearchboxComponentInputContainer, .ytSearchboxComponentInputWrapper {
        background:transparent!important; background-image:none!important; -webkit-mask:none!important; mask:none!important;
      }
      .ytSearchboxComponentInputBox input[name="search_query"] {
        background:transparent!important; background-image:none!important; -webkit-mask:none!important; mask:none!important;
        padding-inline-start:14px!important; text-indent:0!important;
      }
      .ytSearchboxComponentSearchForm > :not(input[name="search_query"]):not(input[role="combobox"]) {
        display:none!important; visibility:hidden!important; opacity:0!important; inline-size:0!important; block-size:0!important;
        margin:0!important; padding:0!important; pointer-events:none!important;
      }
      :host([${SEARCH_DISMISSED_ATTR}="1"]) :is(
        [class*="SuggestionsContainer"],
        [class*="SuggestionContainer"],
        [role="listbox"]
      ) {
        opacity:0!important; visibility:hidden!important; pointer-events:none!important;
        transform:translate3d(0,-8px,0) scale(.985)!important;
        animation:none!important;
        transition:opacity 190ms cubic-bezier(.2,.8,.2,1),
          transform 260ms cubic-bezier(.2,.8,.2,1),
          visibility 0s linear 260ms!important;
      }
      [${CHIP_SURFACE_ATTR}="1"] {
        box-sizing:border-box!important; display:inline-flex!important; align-items:center!important;
        justify-content:center!important; min-height:34px!important; margin:0!important; padding:0!important;
        border:0!important; border-radius:999px!important;
        background:linear-gradient(145deg,rgb(255 255 255 / .105),rgb(255 255 255 / .018) 62%),var(--lg-ctl-fill)!important;
        box-shadow:var(--lg-ctl-shadow)!important; color:var(--yt-spec-text-primary,#f7f7f8)!important;
        overflow:visible!important; transform:none!important;
        transition:background-color 170ms var(--lg-ease),box-shadow 170ms var(--lg-ease),filter 170ms var(--lg-ease)!important;
      }
      [${CHIP_SURFACE_ATTR}="1"]:hover,
      [${CHIP_SURFACE_ATTR}="1"]:focus-visible {
        background:linear-gradient(145deg,rgb(255 255 255 / .15),rgb(255 255 255 / .025) 60%),var(--lg-ctl-hover)!important;
        filter:brightness(1.04)!important; transform:none!important;
      }
      [${CHIP_SURFACE_ATTR}="1"][${CHIP_SELECTED_ATTR}="1"] {
        background:linear-gradient(145deg,rgb(255 255 255 / .19),rgb(255 255 255 / .03) 58%),color-mix(in srgb,var(--lg-ctl-hover) 84%,transparent)!important;
        box-shadow:var(--lg-ctl-shadow),0 7px 18px -14px var(--lg-drop)!important;
        -webkit-backdrop-filter:blur(16px) saturate(1.35) brightness(.97)!important;
        backdrop-filter:blur(16px) saturate(1.35) brightness(.97)!important;
      }
      [${CHIP_SURFACE_ATTR}="1"] > *, [${CHIP_SURFACE_ATTR}="1"] * {
        background:transparent!important; background-color:transparent!important;
        background-image:none!important; box-shadow:none!important; border-color:transparent!important;
      }
      [${CHIP_SURFACE_ATTR}="1"], [${CHIP_SURFACE_ATTR}="1"] * {
        color:var(--lg-chip-fg,#fafafc)!important;
        -webkit-text-fill-color:var(--lg-chip-fg,#fafafc)!important;
        mix-blend-mode:normal!important;
        filter:none!important;
        transition:color 210ms var(--lg-ease),-webkit-text-fill-color 210ms var(--lg-ease)!important;
      }
      [${CHIP_SURFACE_ATTR}="1"] > :is(.ytChipShapeChip,[class*="ChipShapeChip"]) {
        min-height:34px!important; padding-inline:16px!important; display:inline-flex!important;
        align-items:center!important; border:0!important; border-radius:999px!important;
      }
      [${CHIP_SURFACE_ATTR}="1"]::before,[${CHIP_SURFACE_ATTR}="1"]::after,
      [${CHIP_SURFACE_ATTR}="1"] *::before,[${CHIP_SURFACE_ATTR}="1"] *::after {
        background:transparent!important; background-image:none!important; box-shadow:none!important;
      }
      :is(yt-touch-feedback-shape,.ytSpecTouchFeedbackShapeHost,.ytSpecTouchFeedbackShapeStroke,.ytSpecTouchFeedbackShapeFill,.yt-spec-touch-feedback-shape,.yt-spec-touch-feedback-shape__fill,.yt-spec-touch-feedback-shape__stroke) {
        display:none!important; visibility:hidden!important; opacity:0!important;
        background:transparent!important; background-image:none!important; box-shadow:none!important; pointer-events:none!important;
      }
    `;
        root.appendChild(style);
    }
    function installOpenShadowPatches(root) {
        const seen = new Set();
        const walk = (node) => {
            if (!node || seen.has(node))
                return;
            seen.add(node);
            if (node.shadowRoot) {
                installShadowPatch(node.shadowRoot);
                walk(node.shadowRoot);
            }
            node.querySelectorAll?.('*').forEach((el) => {
                if (el.shadowRoot) {
                    installShadowPatch(el.shadowRoot);
                    walk(el.shadowRoot);
                }
            });
        };
        walk(root);
    }
    function resetToGlass(el) {
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('border', '0', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('display', 'inline-flex', 'important');
        el.style.setProperty('align-items', 'center', 'important');
        el.style.setProperty('justify-content', 'center', 'important');
    }
    function rectVisible(rect) {
        return Boolean(rect && rect.width > 1 && rect.height > 1);
    }
    const searchCommitTimers = new WeakMap();
    function searchHostFromEvent(event) {
        const path = event?.composedPath?.() || [];
        return path.find((node) => node?.matches?.('ytd-searchbox, yt-searchbox'))
            || event?.target?.closest?.('ytd-searchbox, yt-searchbox')
            || null;
    }
    function searchInputFromHost(host) {
        if (!host)
            return null;
        return (host.shadowRoot && host.shadowRoot.querySelector('input[name="search_query"], input[role="combobox"], input'))
            || deepQueryAll(host, 'input[name="search_query"], input[role="combobox"], input')[0]
            || host.querySelector?.('input[name="search_query"], input[role="combobox"], input')
            || null;
    }
    function dismissSearchSuggestions(host) {
        if (!host)
            return;
        host.setAttribute(SEARCH_DISMISSED_ATTR, '1');
        host.setAttribute(SEARCH_COMMIT_ATTR, '1');
        const oldTimer = searchCommitTimers.get(host);
        if (oldTimer)
            window.clearTimeout(oldTimer);
        const timer = window.setTimeout(() => {
            if (host.isConnected)
                host.removeAttribute(SEARCH_COMMIT_ATTR);
            searchCommitTimers.delete(host);
        }, 460);
        searchCommitTimers.set(host, timer);
        window.setTimeout(() => {
            const input = searchInputFromHost(host);
            if (input === document.activeElement || input?.matches?.(':focus'))
                input.blur?.();
        }, 0);
    }
    function reopenSearchSuggestions(host) {
        if (!host || !host.hasAttribute(SEARCH_DISMISSED_ATTR))
            return;
        host.removeAttribute(SEARCH_DISMISSED_ATTR);
        host.removeAttribute(SEARCH_COMMIT_ATTR);
        const timer = searchCommitTimers.get(host);
        if (timer)
            window.clearTimeout(timer);
        searchCommitTimers.delete(host);
    }
    function tidySearchBox() {
        document.querySelectorAll('ytd-searchbox, yt-searchbox').forEach((host) => {
            installOpenShadowPatches(host);
            const input = (host.shadowRoot && host.shadowRoot.querySelector('input')) || deepQueryAll(host, 'input')[0] || host.querySelector('input');
            if (!input)
                return;
            const inputRect = input.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();
            if (!rectVisible(inputRect) || !rectVisible(hostRect))
                return;
            deepQueryAll(host, '.ytSearchboxComponentInputBox, [class*="SearchboxComponentInputBox"]').forEach((box) => {
                const boxInput = box.querySelector?.('input[name="search_query"], input[role="combobox"]');
                if (!boxInput)
                    return;
                box.style?.setProperty('background', 'transparent', 'important');
                box.style?.setProperty('background-image', 'none', 'important');
                box.style?.setProperty('-webkit-mask', 'none', 'important');
                box.style?.setProperty('mask', 'none', 'important');
                boxInput.style?.setProperty('background', 'transparent', 'important');
                boxInput.style?.setProperty('background-image', 'none', 'important');
                boxInput.style?.setProperty('-webkit-mask', 'none', 'important');
                boxInput.style?.setProperty('mask', 'none', 'important');
                boxInput.style?.setProperty('padding-inline-start', '14px', 'important');
                boxInput.style?.setProperty('text-indent', '0', 'important');
            });
            deepQueryAll(host, '.ytSearchboxComponentInputSearchIcon, [class*="InputSearchIcon"], [class*="LeadingSearchIcon"], [class*="leadingSearchIcon"]').forEach((icon) => {
                if (icon === input || icon.contains?.(input))
                    return;
                icon.setAttribute(SEARCH_LEADING_ATTR, '1');
                icon.style?.setProperty('display', 'none', 'important');
                icon.style?.setProperty('visibility', 'hidden', 'important');
                icon.style?.setProperty('opacity', '0', 'important');
                icon.style?.setProperty('pointer-events', 'none', 'important');
            });
            input.style.setProperty('background-image', 'none', 'important');
            input.style.setProperty('-webkit-mask-image', 'none', 'important');
            input.style.setProperty('-webkit-appearance', 'none', 'important');
            input.style.setProperty('appearance', 'none', 'important');
            let ancestor = input.parentElement;
            for (let i = 0; ancestor && ancestor !== host && i < 4; i += 1, ancestor = ancestor.parentElement) {
                ancestor.setAttribute(SEARCH_STRIP_PSEUDO_ATTR, '1');
                ancestor.style.setProperty('background-image', 'none', 'important');
                ancestor.style.setProperty('-webkit-mask-image', 'none', 'important');
                ancestor.style.setProperty('mask-image', 'none', 'important');
            }
            deepQueryAll(host, `[${SUBMIT_ATTR}]`).forEach((el) => el.removeAttribute(SUBMIT_ATTR));
            const visualCandidates = deepQueryAll(host, [
                'button', '[role="button"]', 'svg', 'yt-icon',
                '[id*="search" i]', '[class*="search" i]', '[class*="icon" i]'
            ].join(','))
                .filter((el) => el !== input && !el.contains?.(input) && !input.contains?.(el))
                .filter((el) => !el.closest?.('.sbdd_a, .sbdd_b, [class*="SuggestionsContainer"]'));
            const leadingBoundary = hostRect.left + Math.min(78, Math.max(52, hostRect.width * .16));
            visualCandidates.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (!rectVisible(rect) || rect.width > 72 || rect.height > 72)
                    return;
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const verticallyAligned = centerY >= inputRect.top - 10 && centerY <= inputRect.bottom + 10;
                if (!verticallyAligned || centerX > leadingBoundary)
                    return;
                const namedIcon = /search|icon/i.test(`${el.id || ''} ${el.className?.baseVal || el.className || ''}`);
                const smallControl = el.closest?.('button, [role="button"]');
                let target = smallControl && !smallControl.contains(input) ? smallControl : el;
                const targetRect = target.getBoundingClientRect();
                if (!namedIcon && (targetRect.width > 64 || targetRect.height > 64))
                    target = el;
                target.setAttribute(SEARCH_LEADING_ATTR, '1');
                target.style?.setProperty('display', 'none', 'important');
                target.style?.setProperty('visibility', 'hidden', 'important');
                target.style?.setProperty('opacity', '0', 'important');
                target.style?.setProperty('width', '0', 'important');
                target.style?.setProperty('height', '0', 'important');
                target.style?.setProperty('pointer-events', 'none', 'important');
            });
            const actionable = deepQueryAll(host, 'button, [role="button"]')
                .filter((el) => el.getAttribute(HIDE_ATTR) !== '1' && el.getAttribute(SEARCH_LEADING_ATTR) !== '1')
                .filter((el) => !el.closest?.('.sbdd_a, .sbdd_b, [class*="SuggestionsContainer"]'));
            let submit = null;
            let submitRect = null;
            actionable.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (!rectVisible(rect))
                    return;
                const centerX = rect.left + rect.width / 2;
                if (centerX < hostRect.left + hostRect.width * .56)
                    return;
                if (!submit || rect.right > submitRect.right) {
                    submit = el;
                    submitRect = rect;
                }
            });
            if (submit)
                submit.setAttribute(SUBMIT_ATTR, '1');
            actionable.forEach((control) => {
                if (control === submit)
                    return;
                if (control.getAttribute('data-liquid-glass-reset') !== '1') {
                    control.setAttribute('data-liquid-glass-reset', '1');
                    resetToGlass(control);
                }
            });
            if (submit && submit.getAttribute('data-liquid-glass-reset') !== '1') {
                submit.setAttribute('data-liquid-glass-reset', '1');
                resetToGlass(submit);
                submit.style.setProperty('border-radius', '999px', 'important');
            }
        });
    }
    function flattenChipNode(node) {
        if (!node?.style)
            return;
        node.style.setProperty('background', 'transparent', 'important');
        node.style.setProperty('background-color', 'transparent', 'important');
        node.style.setProperty('background-image', 'none', 'important');
        node.style.setProperty('box-shadow', 'none', 'important');
        node.style.setProperty('border-color', 'transparent', 'important');
    }
    const CHIP_HOST_SELECTOR = [
        'yt-chip-cloud-chip-renderer',
        'chip-view-model',
        'yt-chip-view-model'
    ].join(',');
    const CHIP_READY_ATTR = 'data-liquid-glass-chip-ready';
    const ADAPTIVE_CHIP_CONTEXT_SELECTOR = [
        'ytd-feed-filter-chip-bar-renderer',
        'yt-chip-cloud-renderer',
        'ytd-chips-shelf-with-video-shelf-renderer',
        'chips-shelf-view-model'
    ].join(',');
    function composedClosest(node, selector) {
        let current = node instanceof Element ? node : null;
        while (current) {
            if (current.matches?.(selector))
                return current;
            if (current.parentElement) {
                current = current.parentElement;
                continue;
            }
            const root = current.getRootNode?.();
            current = root?.host instanceof Element ? root.host : null;
        }
        return null;
    }
    function isAdaptiveCategoryChip(chip) {
        return Boolean(composedClosest(chip, ADAPTIVE_CHIP_CONTEXT_SELECTOR));
    }
    function directChipSurface(chip) {
        if (!chip)
            return null;
        const direct = chip.querySelector?.([
            'chip-shape > button[role="tab"]',
            'chip-shape > button',
            'button[role="tab"]',
            'button[aria-selected]',
            '[role="tab"]',
            'button',
            '[role="button"]'
        ].join(','));
        if (direct)
            return direct;
        if (chip.localName === 'yt-chip-cloud-chip-renderer') {
            return deepQueryAll(chip, 'button[role="tab"], button, [role="button"]')
                .find((el) => rectVisible(el.getBoundingClientRect())) || null;
        }
        return null;
    }
    function chipIsSelected(chip, surface) {
        return chip.hasAttribute?.('selected')
            || chip.getAttribute?.('aria-selected') === 'true'
            || surface?.getAttribute?.('aria-selected') === 'true'
            || /active|selected/i.test(surface?.className?.baseVal || surface?.className || '');
    }
    function syncChipSurface(chip, surface) {
        if (!chip || !surface)
            return;
        const selected = chipIsSelected(chip, surface);
        chip.querySelectorAll?.(`[${CHIP_SURFACE_ATTR}]`).forEach((el) => {
            if (el !== surface) {
                el.removeAttribute(CHIP_SURFACE_ATTR);
                el.removeAttribute(CHIP_SELECTED_ATTR);
                el.removeAttribute(CHIP_ADAPTIVE_ATTR);
                el.removeAttribute('data-liquid-glass-chip-tone');
                el.removeAttribute(CHIP_READY_ATTR);
                el.style?.removeProperty('--lg-chip-fg');
                el.style?.removeProperty('--lg-chip-muted');
            }
        });
        surface.setAttribute(CHIP_SURFACE_ATTR, '1');
        if (isAdaptiveCategoryChip(chip)) {
            surface.setAttribute(CHIP_ADAPTIVE_ATTR, '1');
        }
        else {
            surface.removeAttribute(CHIP_ADAPTIVE_ATTR);
            surface.removeAttribute('data-liquid-glass-chip-tone');
            surface.style.removeProperty('--lg-chip-fg');
            surface.style.removeProperty('--lg-chip-muted');
        }
        if (selected)
            surface.setAttribute(CHIP_SELECTED_ATTR, '1');
        else
            surface.removeAttribute(CHIP_SELECTED_ATTR);
        if (surface.getAttribute(CHIP_READY_ATTR) === '1')
            return;
        surface.setAttribute(CHIP_READY_ATTR, '1');
        surface.style.setProperty('box-sizing', 'border-box', 'important');
        surface.style.setProperty('display', 'inline-flex', 'important');
        surface.style.setProperty('align-items', 'center', 'important');
        surface.style.setProperty('justify-content', 'center', 'important');
        surface.style.setProperty('min-height', '34px', 'important');
        surface.style.setProperty('padding', '0 16px', 'important');
        surface.style.setProperty('margin', '0', 'important');
        surface.style.setProperty('border', '0', 'important');
        surface.style.setProperty('border-radius', '999px', 'important');
        surface.style.setProperty('overflow', 'visible', 'important');
        surface.style.removeProperty('color');
        surface.style.removeProperty('--yt-spec-text-primary');
        surface.style.removeProperty('--yt-spec-text-secondary');
        surface.style.setProperty('--yt-spec-button-chip-background', 'transparent', 'important');
        surface.style.setProperty('--yt-spec-badge-chip-background', 'transparent', 'important');
    }
    function tidyChipBar(root = document) {
        const chips = [];
        if (root?.matches?.(CHIP_HOST_SELECTOR))
            chips.push(root);
        root?.querySelectorAll?.(CHIP_HOST_SELECTOR).forEach((chip) => chips.push(chip));
        for (const chip of chips) {
            installOpenShadowPatches(chip);
            const surface = directChipSurface(chip);
            if (!surface)
                continue;
            syncChipSurface(chip, surface);
        }
    }
    const CHIP_FIT_ATTR = 'data-liquid-glass-chip-fit';
    const CHIP_BAR_READY_ATTR = 'data-liquid-glass-chip-bar-ready';
    const CHIP_OVERFLOW_ATTR = 'data-liquid-glass-chip-overflow';
    const CHIP_AT_START_ATTR = 'data-liquid-glass-chip-at-start';
    const CHIP_AT_END_ATTR = 'data-liquid-glass-chip-at-end';
    const chipScrollBound = new WeakSet();
    const chipResizeBound = new WeakSet();
    const chipObservedWidths = new WeakMap();
    const chipResizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            let changed = false;
            for (const entry of entries) {
                const width = Math.round(entry.contentRect.width * 2) / 2;
                const previous = chipObservedWidths.get(entry.target);
                chipObservedWidths.set(entry.target, width);
                if (previous === undefined || Math.abs(width - previous) >= 1)
                    changed = true;
            }
            if (changed)
                scheduleChipFit();
        })
        : null;
    function syncChipScrollEdges(bar, scroll) {
        if (!bar || !scroll)
            return;
        const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
        const x = Math.max(0, scroll.scrollLeft);
        if (x <= 2)
            bar.setAttribute(CHIP_AT_START_ATTR, '1');
        else
            bar.removeAttribute(CHIP_AT_START_ATTR);
        if (max <= 2 || x >= max - 2)
            bar.setAttribute(CHIP_AT_END_ATTR, '1');
        else
            bar.removeAttribute(CHIP_AT_END_ATTR);
    }
    function bindChipScroller(bar, scroll) {
        if (!bar || !scroll || chipScrollBound.has(scroll))
            return;
        chipScrollBound.add(scroll);
        scroll.addEventListener('scroll', () => syncChipScrollEdges(bar, scroll), { passive: true });
    }
    function primaryChipNaturalWidth(chips) {
        const items = Array.from(chips.querySelectorAll(':scope > yt-chip-cloud-chip-renderer, :scope > chip-view-model, :scope > [role="presentation"]'));
        const visible = items.filter((item) => {
            const style = getComputedStyle(item);
            return style.display !== 'none' && item.offsetWidth > 0;
        });
        if (!visible.length)
            return chips.scrollWidth;
        const chipStyle = getComputedStyle(chips);
        const gap = Number.parseFloat(chipStyle.columnGap || chipStyle.gap) || 0;
        const itemWidth = visible.reduce((total, item) => {
            const style = getComputedStyle(item);
            const ml = Number.parseFloat(style.marginLeft) || 0;
            const mr = Number.parseFloat(style.marginRight) || 0;
            return total + item.offsetWidth + ml + mr;
        }, 0);
        return itemWidth + Math.max(0, visible.length - 1) * gap;
    }
    function fitPrimaryChipBars(root = document) {
        const bars = [];
        if (root?.matches?.('ytd-feed-filter-chip-bar-renderer'))
            bars.push(root);
        root?.querySelectorAll?.('ytd-feed-filter-chip-bar-renderer').forEach((bar) => bars.push(bar));
        bars.forEach((bar) => {
            const scroll = bar.querySelector('#scroll-container');
            const chips = bar.querySelector('#chips');
            if (!scroll || !chips || scroll.clientWidth < 80)
                return;
            const natural = Math.max(primaryChipNaturalWidth(chips), 1);
            const scrollStyle = getComputedStyle(scroll);
            const paddingLeft = Number.parseFloat(scrollStyle.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(scrollStyle.paddingRight) || 0;
            const available = Math.max(scroll.clientWidth - paddingLeft - paddingRight - 12, 1);
            const viewport = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const responsiveCap = viewport <= 760 ? .72 : viewport <= 900 ? .78 : viewport <= 1100 ? .84 : viewport <= 1280 ? .89 : viewport <= 1440 ? .93 : viewport <= 1600 ? .97 : 1;
            const fit = Math.min(responsiveCap, Math.max(.22, available / natural));
            const rounded = Math.round(fit * 200) / 200;
            const currentZoom = Number.parseFloat(getComputedStyle(chips).zoom) || 1;
            if (Math.abs(currentZoom - rounded) >= .004)
                chips.style.setProperty('zoom', String(rounded), 'important');
            const currentFit = Number.parseFloat(bar.style.getPropertyValue('--lg-chip-fit')) || 0;
            if (Math.abs(currentFit - rounded) >= .004)
                bar.style.setProperty('--lg-chip-fit', String(rounded));
            bar.setAttribute(CHIP_FIT_ATTR, rounded < .995 ? 'scaled' : 'native');
            if (!bar.hasAttribute(CHIP_BAR_READY_ATTR)) {
                requestAnimationFrame(() => bar.setAttribute(CHIP_BAR_READY_ATTR, '1'));
            }
            bar.removeAttribute(CHIP_OVERFLOW_ATTR);
            bar.setAttribute(CHIP_AT_START_ATTR, '1');
            bar.setAttribute(CHIP_AT_END_ATTR, '1');
            bindChipScroller(bar, scroll);
            if (chipResizeObserver && !chipResizeBound.has(scroll)) {
                chipResizeBound.add(scroll);
                chipObservedWidths.set(scroll, Math.round(scroll.getBoundingClientRect().width * 2) / 2);
                chipResizeObserver.observe(scroll);
            }
            syncChipScrollEdges(bar, scroll);
        });
    }
    let chipFitFrame = 0;
    function scheduleChipFit() {
        if (chipFitFrame)
            return;
        chipFitFrame = requestAnimationFrame(() => {
            chipFitFrame = 0;
            fitPrimaryChipBars();
        });
    }
    function nativeVisible(node) {
        if (!node || node.hidden || node.getAttribute?.('aria-hidden') === 'true')
            return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
    function syncGuideExpander(host) {
        if (!host?.isConnected)
            return;
        const expander = host.querySelector?.('#expander-item');
        const collapser = host.querySelector?.('#collapser-item');
        if (!expander && !collapser)
            return;
        const nativeExpanded = host.hasAttribute('expanded')
            || host.getAttribute('aria-expanded') === 'true'
            || (collapser && nativeVisible(collapser) && (!expander || !nativeVisible(expander)));
        if (nativeExpanded)
            host.setAttribute(GUIDE_EXPANDED_ATTR, '1');
        else if (!host.hasAttribute(GUIDE_EXPANDED_ATTR))
            host.removeAttribute(GUIDE_EXPANDED_ATTR);
    }
    let guideAlignFrame = 0;
    function alignGuideExpanders() {
        guideAlignFrame = 0;
        document.querySelectorAll(`[${GUIDE_CONTROL_ATTR}="1"]`).forEach((control) => {
            control.style?.removeProperty('--lg-guide-expander-align-shift');
            control.style?.removeProperty('--lg-guide-expander-gap');
            control.querySelectorAll?.('#icon, yt-icon, yt-icon-shape, .guide-icon, svg').forEach((icon) => {
                icon.style?.removeProperty('transform');
                icon.style?.removeProperty('transform-origin');
            });
        });
    }
    function scheduleGuideAlignment() {
        if (guideAlignFrame)
            cancelAnimationFrame(guideAlignFrame);
        guideAlignFrame = requestAnimationFrame(alignGuideExpanders);
    }
    function protectGuideExpanders() {
        document.querySelectorAll('ytd-guide-collapsible-entry-renderer, ytd-guide-entry-renderer[can-show-more]').forEach((host) => {
            const rows = Array.from(host.querySelectorAll?.('#expander-item, #collapser-item') || []);
            if (!rows.length && !host.matches?.('ytd-guide-entry-renderer[can-show-more]'))
                return;
            host.setAttribute(GUIDE_HOST_ATTR, '1');
            host.querySelectorAll?.(`[${GUIDE_CONTROL_ATTR}]`).forEach((node) => node.removeAttribute(GUIDE_CONTROL_ATTR));
            if (!rows.length)
                rows.push(host);
            rows.forEach((row) => {
                const control = row.querySelector?.('a#endpoint')
                    || row.querySelector?.('#endpoint')
                    || row.querySelector?.('button')
                    || row.querySelector?.('[role="button"]')
                    || (row.matches?.('a#endpoint, #endpoint, button, [role="button"]') ? row : null)
                    || row;
                control.setAttribute?.(GUIDE_CONTROL_ATTR, '1');
                control.style?.setProperty('pointer-events', 'auto', 'important');
            });
            syncGuideExpander(host);
        });
        scheduleGuideAlignment();
    }
    const RESULT_INFO_TERMS = ['about these results', 'tietoa tuloksista', 'om dessa resultat', 'über diese ergebnisse', 'acerca de estos resultados', 'à propos de ces résultats'];
    const FILTER_TERMS = ['filters', 'filter', 'suodattimet', 'suodata', 'filter', 'filteren', 'filtre', 'filtres'];
    function styleRuntimeGlassControl(el) {
        if (!el?.style)
            return;
        el.setAttribute('data-liquid-glass-runtime-control', '1');
        el.style.setProperty('box-sizing', 'border-box', 'important');
        el.style.setProperty('display', 'inline-flex', 'important');
        el.style.setProperty('align-items', 'center', 'important');
        el.style.setProperty('justify-content', 'center', 'important');
        el.style.setProperty('gap', '7px', 'important');
        el.style.setProperty('min-height', '36px', 'important');
        el.style.setProperty('padding-inline', '13px', 'important');
        el.style.setProperty('border', '0', 'important');
        el.style.setProperty('border-radius', '999px', 'important');
        el.style.setProperty('background', 'linear-gradient(145deg, rgb(255 255 255 / .10), rgb(255 255 255 / .015) 62%), var(--lg-ctl-fill)', 'important');
        el.style.setProperty('box-shadow', 'var(--lg-ctl-shadow)', 'important');
        el.style.setProperty('color', 'var(--yt-spec-text-primary, #f7f7f8)', 'important');
    }
    function tidySearchResultControls() {
        document.querySelectorAll('ytd-search-sub-menu-renderer').forEach((header) => {
            installOpenShadowPatches(header);
            const styled = new Set();
            const nodes = [header, ...deepQueryAll(header, '*')];
            nodes.forEach((node) => {
                const label = nodeText(node);
                if (!label || label.length > 90)
                    return;
                const isInfo = RESULT_INFO_TERMS.some((term) => label === term || label.startsWith(`${term} `));
                const isFilter = FILTER_TERMS.some((term) => label === term || label.startsWith(`${term} `));
                if (!isInfo && !isFilter)
                    return;
                const control = node.closest?.('button, [role="button"], yt-button-shape, ytd-button-renderer') || node;
                if (styled.has(control))
                    return;
                styled.add(control);
                styleRuntimeGlassControl(control);
            });
        });
    }
    const LIKE_TERMS = ['like', 'tykkä', 'gilla', 'gefällt', 'me gusta', 'j’aime', 'j\'aime', 'mi piace', 'vind ik leuk', 'нравится', '好き', '좋아요'];
    const DISLIKE_TERMS = ['dislike', 'ei tykkä', 'inte', 'gefällt mir nicht', 'no me gusta', 'non mi piace', 'vind ik niet leuk', 'не нравится'];
    function looksLikeBareCount(text) {
        const value = (text || '').trim();
        if (!value || value.length > 10)
            return false;
        if (!/^\d/.test(value))
            return false;
        if (/\s.*\S.*\s/.test(value))
            return false;
        return /^[\d.,\s]+[a-zA-Z.]{0,4}$/.test(value);
    }
    function findLikeControl(bar) {
        const byId = bar.querySelector('#like-button, [id*="like-button" i]');
        if (byId)
            return byId;
        return deepQueryAll(bar, 'button, [role="button"]').find((el) => {
            const label = nodeText(el);
            return LIKE_TERMS.some((term) => label.includes(term)) && !DISLIKE_TERMS.some((term) => label.includes(term));
        }) || null;
    }
    function findDislikeControl(bar) {
        const byId = bar.querySelector('#dislike-button, [id*="dislike-button" i]');
        if (byId)
            return byId;
        return deepQueryAll(bar, 'button, [role="button"]').find((el) => DISLIKE_TERMS.some((term) => nodeText(el).includes(term))) || null;
    }
    function mergeCommentVoteCounts() {
        document.querySelectorAll('ytd-comment-engagement-bar').forEach((bar) => {
            const likeControl = findLikeControl(bar);
            if (!likeControl)
                return;
            const likeClickable = likeControl.matches('button, [role="button"]')
                ? likeControl
                : (likeControl.querySelector('button, [role="button"]') || likeControl);
            const dislikeControl = findDislikeControl(bar);
            const visualLike = likeClickable.closest('yt-icon-button') || likeControl.closest?.('yt-icon-button') || likeClickable;
            const skip = new Set([likeControl, likeClickable, visualLike, dislikeControl].filter(Boolean));
            let countNode = bar.querySelector('[data-liquid-glass-vote-count-source="1"]');
            if (!countNode) {
                const scan = (nodes) => nodes.find((el) => {
                    if ([...skip].some((node) => node === el || node.contains?.(el) || el.contains?.(node)))
                        return false;
                    return looksLikeBareCount(el.textContent) && el.children.length === 0;
                });
                countNode = scan(Array.from(bar.children))
                    || scan(Array.from(bar.children).flatMap((el) => Array.from(el.children)));
            }
            if (!countNode) {
                visualLike.removeAttribute('data-liquid-glass-vote-count-text');
                return;
            }
            const countText = (countNode.textContent || '').trim();
            if (!countText)
                return;
            const voteSurface = likeClickable.matches?.('button, [role="button"]') ? likeClickable : visualLike;
            visualLike.setAttribute('data-liquid-glass-vote-like', '1');
            voteSurface.setAttribute('data-liquid-glass-vote-like-surface', '1');
            visualLike.setAttribute('data-liquid-glass-vote-count-text', countText);
            countNode.setAttribute('data-liquid-glass-vote-count-source', '1');
            setHidden(countNode);
            let rendered = voteSurface.querySelector?.('[data-liquid-glass-vote-count-rendered="1"]');
            if (!rendered) {
                rendered = document.createElement('span');
                rendered.setAttribute('data-liquid-glass-vote-count-rendered', '1');
                rendered.setAttribute('aria-hidden', 'true');
                voteSurface.appendChild(rendered);
            }
            rendered.textContent = countText;
            rendered.style.setProperty('display', 'inline-flex', 'important');
            rendered.style.setProperty('align-items', 'center', 'important');
            rendered.style.setProperty('margin', '0', 'important');
            rendered.style.setProperty('padding', '0', 'important');
            rendered.style.setProperty('background', 'transparent', 'important');
            rendered.style.setProperty('box-shadow', 'none', 'important');
            rendered.style.setProperty('font', '500 12px/1 var(--yt-spec-font-family, Roboto, Arial, sans-serif)', 'important');
            rendered.style.setProperty('color', 'var(--yt-spec-text-secondary, currentColor)', 'important');
            rendered.style.setProperty('pointer-events', 'none', 'important');
            voteSurface.style.setProperty('box-sizing', 'border-box', 'important');
            voteSurface.style.setProperty('display', 'inline-flex', 'important');
            voteSurface.style.setProperty('align-items', 'center', 'important');
            voteSurface.style.setProperty('justify-content', 'center', 'important');
            voteSurface.style.setProperty('gap', '5px', 'important');
            voteSurface.style.setProperty('width', 'auto', 'important');
            voteSurface.style.setProperty('min-width', '54px', 'important');
            voteSurface.style.setProperty('height', '36px', 'important');
            voteSurface.style.setProperty('padding', '0 10px 0 8px', 'important');
            voteSurface.style.setProperty('border', '0', 'important');
            voteSurface.style.setProperty('border-radius', '999px', 'important');
            voteSurface.style.setProperty('background', 'linear-gradient(145deg, rgb(255 255 255 / .10), rgb(255 255 255 / .015) 62%), var(--lg-ctl-fill)', 'important');
            voteSurface.style.setProperty('box-shadow', 'var(--lg-ctl-shadow)', 'important');
            voteSurface.style.setProperty('overflow', 'visible', 'important');
            bar.setAttribute('data-liquid-glass-vote-merged', '1');
        });
    }
    const VIDEO_VOTE_GROUP_ATTR = 'data-liquid-glass-video-vote-group';
    const VIDEO_VOTE_SURFACE_ATTR = 'data-liquid-glass-video-vote-surface';
    const VIDEO_VOTE_CONTROL_ATTR = 'data-liquid-glass-video-vote-control';
    const VIDEO_VOTE_KIND_ATTR = 'data-liquid-glass-video-vote-kind';
    function firstDeep(root, selector) {
        if (!root)
            return null;
        if (root.matches?.(selector))
            return root;
        return root.querySelector?.(selector) || deepQueryAll(root, selector)[0] || null;
    }
    function currentVoteGroups(root) {
        const selector = [
            '.ytSegmentedLikeDislikeButtonViewModelHost',
            'segmented-like-dislike-button-view-model',
            'ytd-segmented-like-dislike-button-renderer',
            '#segmented-like-dislike-button'
        ].join(',');
        return [...new Set([...(root.querySelectorAll?.(selector) || []), ...deepQueryAll(root, selector)])];
    }
    function markVoteGroup(group) {
        if (!(group instanceof Element) || !group.isConnected)
            return false;
        group.setAttribute(VIDEO_VOTE_GROUP_ATTR, '1');
        const surface = firstDeep(group, '.ytSegmentedLikeDislikeButtonViewModelSegmentedButtonsWrapper, #segmented-buttons-wrapper') || group;
        surface.setAttribute(VIDEO_VOTE_SURFACE_ATTR, '1');
        const likeHost = firstDeep(group, '.ytLikeButtonViewModelHost, like-button-view-model, #segmented-like-button, #like-button');
        const dislikeHost = firstDeep(group, '.ytDislikeButtonViewModelHost, dislike-button-view-model, #segmented-dislike-button, #dislike-button');
        const likeButton = firstDeep(likeHost, 'button[aria-pressed], button, [role="button"]');
        const dislikeButton = firstDeep(dislikeHost, 'button[aria-pressed], button, [role="button"]');
        if (likeButton) {
            likeButton.setAttribute(VIDEO_VOTE_CONTROL_ATTR, '1');
            likeButton.setAttribute(VIDEO_VOTE_KIND_ATTR, 'like');
        }
        if (dislikeButton) {
            dislikeButton.setAttribute(VIDEO_VOTE_CONTROL_ATTR, '1');
            dislikeButton.setAttribute(VIDEO_VOTE_KIND_ATTR, 'dislike');
        }
        return Boolean(likeButton || dislikeButton);
    }
    function styleVideoVoteControls() {
        const roots = document.querySelectorAll('ytd-watch-metadata #actions, ytd-watch-metadata #top-level-buttons-computed, ytd-watch-metadata ytd-menu-renderer');
        roots.forEach((root) => {
            let marked = false;
            currentVoteGroups(root).forEach((group) => {
                if (markVoteGroup(group))
                    marked = true;
            });
            if (marked)
                return;
            const controls = deepQueryAll(root, 'button, [role="button"]').filter((control) => {
                const rect = control.getBoundingClientRect?.();
                return rect && rect.width > 18 && rect.height > 18;
            });
            const like = controls.find((control) => {
                const label = nodeText(control);
                return LIKE_TERMS.some((term) => label.includes(term)) && !DISLIKE_TERMS.some((term) => label.includes(term));
            }) || null;
            const dislike = controls.find((control) => DISLIKE_TERMS.some((term) => nodeText(control).includes(term))) || null;
            if (!like || !dislike)
                return;
            const ancestors = [];
            let node = like.parentElement;
            while (node && node !== root) {
                ancestors.push(node);
                node = node.parentElement;
            }
            const group = ancestors.find((ancestor) => ancestor.contains(dislike)) || null;
            if (!group)
                return;
            group.setAttribute(VIDEO_VOTE_GROUP_ATTR, '1');
            group.setAttribute(VIDEO_VOTE_SURFACE_ATTR, '1');
            like.setAttribute(VIDEO_VOTE_CONTROL_ATTR, '1');
            like.setAttribute(VIDEO_VOTE_KIND_ATTR, 'like');
            dislike.setAttribute(VIDEO_VOTE_CONTROL_ATTR, '1');
            dislike.setAttribute(VIDEO_VOTE_KIND_ATTR, 'dislike');
        });
    }
    const INLINE_ROW_ATTR = 'data-liquid-glass-inline-action-row';
    const INLINE_COPY_ATTR = 'data-liquid-glass-inline-action-copy';
    const INLINE_CONTROL_ATTR = 'data-liquid-glass-inline-action-control';
    const AI_METADATA_ATTR = 'data-liquid-glass-ai-metadata';
    function tidyExpandableMetadata(root = document) {
        const selector = 'ytd-expandable-metadata-renderer';
        const renderers = [];
        if (root?.matches?.(selector))
            renderers.push(root);
        root?.querySelectorAll?.(selector).forEach((el) => renderers.push(el));
        renderers.forEach((renderer) => {
            if (!renderer.isConnected)
                return;
            const tagged = [renderer, ...renderer.querySelectorAll?.(`[${INLINE_ROW_ATTR}], [${INLINE_COPY_ATTR}], [${INLINE_CONTROL_ATTR}]`) || []];
            tagged.forEach((node) => {
                node.removeAttribute?.(INLINE_ROW_ATTR);
                node.removeAttribute?.(INLINE_COPY_ATTR);
                node.removeAttribute?.(INLINE_CONTROL_ATTR);
                node.style?.removeProperty('--lg-inline-action-reserve');
            });
            renderer.setAttribute(AI_METADATA_ATTR, '1');
            renderer.querySelector('#collapsed-label')?.setAttribute('data-liquid-glass-ai-label', '1');
            renderer.querySelector('#inline-content')?.setAttribute('data-liquid-glass-ai-content', '1');
            renderer.querySelector('#expand')?.setAttribute('data-liquid-glass-ai-control', 'expand');
            renderer.querySelector('#collapse')?.setAttribute('data-liquid-glass-ai-control', 'collapse');
        });
    }
    function tidyDescriptionInlineRows(root = document) {
        const scopes = [];
        const scopeSelector = [
            'ytd-watch-metadata #description',
            'ytd-structured-description-content-renderer',
            'ytd-expandable-video-description-body-renderer',
            'ytd-video-description-transcript-section-renderer',
            'yt-video-description-view-model',
            'yt-description-view-model'
        ].join(',');
        if (root?.matches?.(scopeSelector))
            scopes.push(root);
        root?.querySelectorAll?.(scopeSelector).forEach((el) => scopes.push(el));
        scopes.forEach((scope) => {
            const controls = scope.querySelectorAll?.([
                'button[aria-expanded]', 'button[aria-haspopup]', '[role="button"][aria-expanded]',
                'yt-button-shape button', 'ytd-button-renderer button'
            ].join(',')) || [];
            controls.forEach((control) => {
                if (!control.isConnected)
                    return;
                if (control.closest?.('ytd-expandable-metadata-renderer'))
                    return;
                const controlRect = control.getBoundingClientRect();
                if (controlRect.width < 24 || controlRect.height < 20)
                    return;
                let row = control.parentElement;
                let chosen = null;
                for (let depth = 0; row && row !== scope && depth < 7; depth += 1, row = row.parentElement) {
                    const rect = row.getBoundingClientRect();
                    if (rect.width < 220 || rect.height < 24 || rect.height > 112)
                        continue;
                    const text = normalize(row.innerText || row.textContent);
                    if (text.length < 28)
                        continue;
                    const rightSide = controlRect.left >= rect.left + rect.width * .52;
                    if (!rightSide)
                        continue;
                    const kids = Array.from(row.children || []);
                    const controlBranch = kids.find((child) => child === control || child.contains?.(control)) || control;
                    let copyBranch = kids
                        .filter((child) => child !== controlBranch && !child.contains?.(control))
                        .sort((a, b) => normalize(b.innerText || b.textContent).length - normalize(a.innerText || a.textContent).length)
                        .find((child) => normalize(child.innerText || child.textContent).length >= 18) || null;
                    if (!copyBranch) {
                        const candidates = Array.from(row.querySelectorAll?.('div, span, yt-formatted-string') || [])
                            .filter((el) => el !== control && !el.contains?.(control) && !control.contains?.(el))
                            .filter((el) => normalize(el.innerText || el.textContent).length >= 18)
                            .sort((a, b) => normalize(b.innerText || b.textContent).length - normalize(a.innerText || a.textContent).length);
                        copyBranch = candidates[0] || null;
                    }
                    chosen = { row, controlBranch, copyBranch };
                    break;
                }
                if (!chosen)
                    return;
                const branchRect = chosen.controlBranch.getBoundingClientRect?.() || controlRect;
                const reserve = Math.ceil(Math.max(controlRect.width, branchRect.width) + 22);
                chosen.row.setAttribute(INLINE_ROW_ATTR, '1');
                chosen.row.style.setProperty('--lg-inline-action-reserve', `${reserve}px`);
                if (chosen.copyBranch)
                    chosen.copyBranch.setAttribute(INLINE_COPY_ATTR, '1');
                chosen.controlBranch.setAttribute(INLINE_CONTROL_ATTR, '1');
            });
        });
    }
    function stabilizeFullGuide() {
        if (!settings.enabled || document.fullscreenElement || document.webkitFullscreenElement || document.documentElement.getAttribute('data-liquid-glass-player-fullscreen') === 'true')
            return;
        const app = document.querySelector('ytd-app');
        if (!app)
            return;
        const drawer = app.querySelector('tp-yt-app-drawer#guide, #guide.ytd-app');
        const content = drawer?.querySelector?.('#contentContainer');
        const guide = app.querySelector('ytd-guide-renderer');
        [drawer, content, guide].forEach((node) => {
            if (!(node instanceof HTMLElement))
                return;
            node.removeAttribute('hidden');
            node.removeAttribute('inert');
            if (node.getAttribute('aria-hidden') === 'true')
                node.setAttribute('aria-hidden', 'false');
        });
    }
    function runCleanup() {
        cleanupTimer = 0;
        if (refreshHidden) {
            restoreHidden();
            refreshHidden = false;
        }
        applyRootState();
        if (!settings.enabled) {
            restoreHidden();
            return;
        }
        stabilizeFullGuide();
        hideNavigationEntries();
        hideShortsShelves();
        hideVideoActions();
        hideEmptyYouTubeSections();
        protectGuideExpanders();
        tidySearchBox();
        tidyChipBar();
        fitPrimaryChipBars();
        tidySearchResultControls();
        tidyExpandableMetadata();
        tidyDescriptionInlineRows();
        mergeCommentVoteCounts();
        styleVideoVoteControls();
        pruneDetachedHidden();
        scheduleFloatingChromeLayout();
    }
    function scheduleCleanup(forceRefresh = false) {
        if (forceRefresh) {
            refreshHidden = true;
            if (cleanupTimer) {
                window.clearTimeout(cleanupTimer);
                cleanupTimer = 0;
            }
        }
        if (cleanupTimer)
            return;
        cleanupTimer = window.setTimeout(runCleanup, forceRefresh ? 0 : 90);
    }
    function nodeContainsRelevantUI(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE)
            return false;
        const relevant = [
            'ytd-menu-popup-renderer', 'ytd-menu-service-item-renderer', 'ytd-menu-navigation-item-renderer',
            'yt-list-item-view-model', 'ytd-guide-entry-renderer', 'ytd-mini-guide-entry-renderer',
            'ytd-guide-section-renderer', 'ytd-reel-shelf-renderer', 'ytd-reel-item-renderer',
            'ytd-shorts', 'ytd-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2', 'yt-shorts-lockup-view-model', 'grid-shelf-view-model', 'ytd-rich-grid-group', 'ytd-rich-shelf-renderer[is-shorts]', 'a[href^="/shorts"]',
            'ytd-rich-section-renderer', 'ytd-button-renderer', 'yt-button-view-model',
            'ytd-popup-container', 'tp-yt-paper-dialog', 'ytd-searchbox', 'yt-searchbox',
            'ytd-feed-filter-chip-bar-renderer', 'yt-chip-cloud-renderer', 'yt-chip-cloud-chip-renderer',
            'ytd-chips-shelf-with-video-shelf-renderer', 'chips-shelf-view-model', 'chip-view-model',
            'ytd-guide-collapsible-entry-renderer', 'ytd-watch-next-secondary-results-renderer',
            'ytd-live-chat-frame', 'ytd-engagement-panel-section-list-renderer', 'ytd-search-sub-menu-renderer',
            'ytd-structured-description-content-renderer', 'ytd-expandable-video-description-body-renderer', 'ytd-expandable-metadata-renderer',
            'ytd-video-description-transcript-section-renderer', 'yt-video-description-view-model', 'yt-description-view-model'
        ].join(',');
        return node.matches(relevant) || Boolean(node.querySelector(relevant));
    }
    function mutationIsRelevant(mutation) {
        if (mutation.type !== 'childList')
            return false;
        const target = mutation.target.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target.parentElement;
        if (!target || target.closest(`[${HIDE_ATTR}="1"]`))
            return false;
        if (target.closest('ytd-guide-collapsible-entry-renderer'))
            return false;
        if (target.closest('ytd-menu-popup-renderer, ytd-popup-container, tp-yt-paper-dialog, yt-contextual-sheet-layout'))
            return true;
        if (target.closest('ytd-searchbox, yt-searchbox') && !target.closest('.sbdd_a, .sbdd_b, [class*="SuggestionsContainer"]'))
            return true;
        if (target.closest('ytd-feed-filter-chip-bar-renderer, yt-chip-cloud-renderer, ytd-chips-shelf-with-video-shelf-renderer, chips-shelf-view-model, chip-view-model, ytd-watch-next-secondary-results-renderer, ytd-live-chat-frame, ytd-engagement-panel-section-list-renderer, ytd-search-sub-menu-renderer, ytd-structured-description-content-renderer, ytd-expandable-video-description-body-renderer, ytd-expandable-metadata-renderer, ytd-video-description-transcript-section-renderer, yt-video-description-view-model, yt-description-view-model'))
            return true;
        if (target.closest(`${ACTION_SELECTOR}, ${NAV_SELECTOR}`))
            return true;
        if (isSearchResultsPage()) {
            const searchResultSelector = 'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-grid-video-renderer';
            if (target.closest?.(searchResultSelector))
                return true;
            if (Array.from(mutation.addedNodes).some((node) => node?.nodeType === Node.ELEMENT_NODE && (node.matches?.(searchResultSelector) || node.querySelector?.(searchResultSelector))))
                return true;
        }
        return Array.from(mutation.addedNodes).some(nodeContainsRelevantUI);
    }
    function loadSettings() {
        try {
            chrome.storage.local.get(DEFAULTS, (stored) => {
                settings = { ...DEFAULTS, ...stored };
                scheduleCleanup(true);
            });
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local')
                    return;
                let changed = false;
                Object.entries(changes).forEach(([key, change]) => {
                    if (!(key in DEFAULTS))
                        return;
                    settings[key] = change.newValue ?? DEFAULTS[key];
                    changed = true;
                });
                if (changed) {
                    scheduleCleanup(true);
                }
            });
        }
        catch (_error) {
            settings = { ...DEFAULTS };
            scheduleCleanup(true);
        }
    }
    const TRACKED = [
        'ytd-masthead #container.ytd-masthead',
        'ytd-popup-container ytd-menu-popup-renderer',
        'ytd-popup-container ytd-multi-page-menu-renderer',
        'ytd-popup-container tp-yt-paper-dialog',
        'ytd-popup-container yt-contextual-sheet-layout',
        'ytd-searchbox .sbdd_a',
        'yt-searchbox [class*="SuggestionsContainer"]',
        'ytd-app ytd-guide-renderer'
    ].join(',');
    let pointerEvent = null;
    let pointerFrame = 0;
    const pointerRects = new WeakMap();
    let pointerGeometryEpoch = 0;
    function trackedRect(node) {
        const now = performance.now();
        const cached = pointerRects.get(node);
        if (cached && cached.epoch === pointerGeometryEpoch && (now - cached.time) < 220)
            return cached.rect;
        const rect = node.getBoundingClientRect();
        pointerRects.set(node, { rect, time: now, epoch: pointerGeometryEpoch });
        return rect;
    }
    function flushPointer() {
        pointerFrame = 0;
        const event = pointerEvent;
        pointerEvent = null;
        if (!event)
            return;
        const path = event.path;
        let found = 0;
        for (let i = 0; i < path.length && found < 2; i += 1) {
            const node = path[i];
            if (node.nodeType !== Node.ELEMENT_NODE || !node.matches(TRACKED))
                continue;
            const rect = trackedRect(node);
            node.style.setProperty('--lg-mx', `${(event.clientX - rect.left).toFixed(1)}px`);
            node.style.setProperty('--lg-my', `${(event.clientY - rect.top).toFixed(1)}px`);
            found += 1;
        }
    }
    document.addEventListener('pointermove', (event) => {
        if (!settings.enabled || event.pointerType === 'touch')
            return;
        const path = event.composedPath ? event.composedPath() : [];
        if (document.documentElement.getAttribute('data-liquid-glass-video-playing') === 'true') {
            let overMasthead = false;
            for (const node of path) {
                if (!(node instanceof Element))
                    continue;
                if (node.matches?.('ytd-masthead #container.ytd-masthead')) {
                    overMasthead = true;
                    break;
                }
            }
            if (!overMasthead)
                return;
        }
        pointerEvent = { clientX: event.clientX, clientY: event.clientY, path };
        if (!pointerFrame)
            pointerFrame = window.requestAnimationFrame(flushPointer);
    }, { passive: true });
    addEventListener('scroll', () => { pointerGeometryEpoch += 1; }, { capture: true, passive: true });
    addEventListener('resize', () => { pointerGeometryEpoch += 1; }, { passive: true });
    const POPUP_TRIGGER_SELECTOR = [
        '[aria-haspopup="true"]', '[aria-haspopup="menu"]',
        'ytd-menu-renderer yt-icon-button', 'ytd-menu-renderer button',
        'yt-button-shape button', 'ytd-button-renderer button',
        '.ytp-settings-button', '.ytp-button[aria-haspopup="true"]'
    ].join(',');
    const POPUP_PRIME_SELECTOR = [
        'ytd-menu-popup-renderer', 'ytd-multi-page-menu-renderer',
        'tp-yt-paper-dialog', 'yt-contextual-sheet-layout',
        'tp-yt-paper-listbox', '.html5-video-player .ytp-popup',
        'yt-searchbox [class*="SuggestionsContainer"]', 'ytd-searchbox .sbdd_a'
    ].join(',');
    const ICON_SELECTOR = 'yt-icon, yt-icon-shape, icon-shape, .yt-icon-shape, svg';
    let iconWarmFrame = 0;
    let idleIconWarmHandle = 0;
    function forceIconReady(icon) {
        try {
            customElements.upgrade?.(icon);
        }
        catch (_error) { }
        void icon.localName;
        void getComputedStyle(icon).opacity;
        void icon.getBoundingClientRect();
        if (icon.shadowRoot) {
            try {
                customElements.upgrade?.(icon.shadowRoot);
            }
            catch (_error) { }
            const inner = icon.shadowRoot.querySelector('svg, path, yt-icon, icon-shape');
            if (inner)
                void inner.getBoundingClientRect();
        }
    }
    function primeIconTree(root, limit = 140) {
        if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof ShadowRoot))
            return 0;
        try {
            customElements.upgrade?.(root);
        }
        catch (_error) { }
        let warmed = 0;
        const icons = [];
        if (root instanceof Element && root.matches?.(ICON_SELECTOR))
            icons.push(root);
        root.querySelectorAll?.(ICON_SELECTOR).forEach((icon) => {
            if (icons.length < limit)
                icons.push(icon);
        });
        for (const icon of icons) {
            if (warmed >= limit)
                break;
            forceIconReady(icon);
            warmed += 1;
        }
        return warmed;
    }
    function primePopupTree(root) {
        if (!(root instanceof Element))
            return;
        const popups = [];
        if (root.matches?.(POPUP_PRIME_SELECTOR))
            popups.push(root);
        root.querySelectorAll?.(POPUP_PRIME_SELECTOR).forEach((popup) => popups.push(popup));
        let remaining = 180;
        for (const popup of popups) {
            if (remaining <= 0)
                break;
            popup.setAttribute('data-liquid-glass-icon-primed', '1');
            remaining -= primeIconTree(popup, Math.min(remaining, 90));
        }
    }
    function warmPopupIcons() {
        if (iconWarmFrame)
            return;
        iconWarmFrame = window.requestAnimationFrame(() => {
            iconWarmFrame = 0;
            let remaining = 180;
            document.querySelectorAll(POPUP_PRIME_SELECTOR).forEach((popup) => {
                if (remaining <= 0)
                    return;
                popup.setAttribute('data-liquid-glass-icon-primed', '1');
                remaining -= primeIconTree(popup, Math.min(remaining, 90));
            });
            ['yt-icon', 'yt-icon-shape', 'icon-shape'].forEach((name) => {
                try {
                    customElements.whenDefined(name).then(() => { }).catch(() => { });
                }
                catch (_error) { }
            });
        });
    }
    function warmVisiblePageIcons() {
        const run = () => {
            idleIconWarmHandle = 0;
            let remaining = 220;
            document.querySelectorAll('ytd-masthead, ytd-guide-renderer, ytd-mini-guide-renderer, ytd-menu-renderer, ytd-watch-flexy').forEach((surface) => {
                if (remaining <= 0)
                    return;
                remaining -= primeIconTree(surface, Math.min(remaining, 70));
            });
        };
        if (idleIconWarmHandle)
            return;
        if ('requestIdleCallback' in window)
            idleIconWarmHandle = requestIdleCallback(run, { timeout: 450 });
        else
            idleIconWarmHandle = window.setTimeout(run, 90);
    }
    document.addEventListener('pointerover', (event) => {
        if (!settings.enabled || !event.target?.closest?.(POPUP_TRIGGER_SELECTOR))
            return;
        warmPopupIcons();
    }, { capture: true, passive: true });
    document.addEventListener('focusin', (event) => {
        if (!settings.enabled || !event.target?.closest?.(POPUP_TRIGGER_SELECTOR))
            return;
        warmPopupIcons();
    }, true);
    document.addEventListener('pointerdown', (event) => {
        if (!settings.enabled || !event.target?.closest?.(POPUP_TRIGGER_SELECTOR))
            return;
        warmPopupIcons();
        queueMicrotask(() => {
            warmPopupIcons();
            document.querySelectorAll(POPUP_PRIME_SELECTOR).forEach((popup) => primePopupTree(popup));
        });
    }, { capture: true, passive: true });
    warmVisiblePageIcons();
    document.addEventListener('yt-navigate-finish', warmVisiblePageIcons, true);
    let lastPress = { x: 0, y: 0, time: 0 };
    const rememberPress = (x, y) => { lastPress = { x, y, time: performance.now() }; };
    document.addEventListener('pointerdown', (event) => rememberPress(event.clientX, event.clientY), true);
    let reroutedSpace = false;
    const deepActiveElement = () => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement)
            active = active.shadowRoot.activeElement;
        return active;
    };
    const isEditableTarget = (node) => node?.matches?.('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]');
    const isPlayerTarget = (node) => Boolean(node?.closest?.('#movie_player, .html5-video-player, .ytp-chrome-controls, .ytp-popup, .ytp-menuitem'));
    const toggleWatchVideo = () => {
        const video = document.querySelector('#movie_player video.html5-main-video, #movie_player video, ytd-player video');
        if (!(video instanceof HTMLVideoElement))
            return;
        if (video.paused || video.ended)
            video.play().catch(() => {});
        else
            video.pause();
    };
    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' && event.key !== ' ')
            return;
        document.documentElement.setAttribute('data-liquid-glass-space-key', 'true');
        if (!settings.enabled || !location.pathname.startsWith('/watch'))
            return;
        if (reroutedSpace) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const path = event.composedPath?.() || [];
        if (path.some((node) => isEditableTarget(node)) || path.some((node) => isPlayerTarget(node)))
            return;
        const active = deepActiveElement();
        if (!(active instanceof HTMLElement) || active === document.body || active === document.documentElement || isEditableTarget(active) || isPlayerTarget(active))
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        active.blur();
        reroutedSpace = true;
        if (!event.repeat)
            toggleWatchVideo();
    }, true);
    document.addEventListener('keyup', (event) => {
        if (event.code !== 'Space' && event.key !== ' ')
            return;
        document.documentElement.removeAttribute('data-liquid-glass-space-key');
        if (!reroutedSpace)
            return;
        reroutedSpace = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        const active = deepActiveElement();
        if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement && !isEditableTarget(active) && !isPlayerTarget(active))
            active.blur();
    }, true);
    window.addEventListener('blur', () => {
        reroutedSpace = false;
        document.documentElement.removeAttribute('data-liquid-glass-space-key');
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.isComposing)
            return;
        const path = event.composedPath?.() || [];
        const input = path.find((node) => node?.matches?.('input[name="search_query"], input[role="combobox"]'));
        const host = searchHostFromEvent(event);
        if (input && host && settings.enabled)
            dismissSearchSuggestions(host);
    }, true);
    document.addEventListener('submit', (event) => {
        if (!settings.enabled)
            return;
        const host = searchHostFromEvent(event) || event.target?.closest?.('ytd-searchbox, yt-searchbox');
        if (host)
            dismissSearchSuggestions(host);
    }, true);
    document.addEventListener('pointerdown', (event) => {
        if (!settings.enabled)
            return;
        const path = event.composedPath?.() || [];
        const input = path.find((node) => node?.matches?.('input[name="search_query"], input[role="combobox"]'));
        if (!input)
            return;
        const host = searchHostFromEvent(event);
        if (!host)
            return;
        reopenSearchSuggestions(host);
        requestAnimationFrame(() => { if (settings.enabled)
            tidySearchBox(); });
    }, true);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter')
            return;
        const target = document.activeElement;
        if (!target || !target.getBoundingClientRect)
            return;
        const rect = target.getBoundingClientRect();
        rememberPress(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, true);
    document.addEventListener('animationstart', (event) => {
        if (event.animationName !== 'lg-pop' || !(event.target instanceof HTMLElement))
            return;
        if (performance.now() - lastPress.time > 2500)
            return;
        const popup = event.target;
        const anchor = popup.closest('tp-yt-iron-dropdown') || popup;
        const rect = anchor.getBoundingClientRect();
        if (!rect.width || !rect.height)
            return;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const x = clamp(lastPress.x - rect.left, 0, rect.width);
        const y = clamp(lastPress.y - rect.top, 0, rect.height);
        popup.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
        const dx = clamp(((lastPress.x - (rect.left + rect.width / 2)) / rect.width) * 28, -14, 14);
        const opensAbove = lastPress.y > rect.bottom - 4;
        popup.style.setProperty('--lg-pop-dx', `${dx.toFixed(1)}px`);
        popup.style.setProperty('--lg-pop-dy', opensAbove ? '12px' : '-12px');
    }, true);
    function settleSearchBox() {
        [0, 16, 50, 120, 260, 520, 1000].forEach((delay) => window.setTimeout(() => {
            if (settings.enabled)
                tidySearchBox();
        }, delay));
    }
    document.addEventListener('focusin', (event) => {
        const inSearch = event.target?.closest?.('ytd-searchbox, yt-searchbox')
            || event.composedPath?.().some?.((node) => node?.matches?.('ytd-searchbox, yt-searchbox'));
        if (!inSearch || !settings.enabled)
            return;
        settleSearchBox();
    }, true);
    [220, 700, 1600].forEach((delay) => window.setTimeout(() => {
        if (settings.enabled)
            tidySearchBox();
    }, delay));
    document.addEventListener('click', (event) => {
        const path = event.composedPath?.() || [];
        const row = path.find((node) => node?.id === 'expander-item' || node?.id === 'collapser-item')
            || event.target?.closest?.('#expander-item, #collapser-item');
        if (!row)
            return;
        const host = row.closest?.('ytd-guide-collapsible-entry-renderer, ytd-guide-entry-renderer[can-show-more]');
        if (!host)
            return;
        window.setTimeout(() => {
            if (!host.isConnected)
                return;
            if (row.id === 'expander-item') {
                host.setAttribute(GUIDE_EXPANDED_ATTR, '1');
            }
            else {
                host.removeAttribute(GUIDE_EXPANDED_ATTR);
            }
        }, 0);
    }, true);
    document.addEventListener('click', (event) => {
        const path = event.composedPath?.() || [];
        const chip = path.find((node) => node?.matches?.(CHIP_HOST_SELECTOR));
        if (!chip)
            return;
        const row = chip.closest?.([
            'chips-shelf-view-model',
            'yt-chip-cloud-renderer',
            'ytd-feed-filter-chip-bar-renderer',
            'ytd-chips-shelf-with-video-shelf-renderer'
        ].join(',')) || chip.parentElement;
        if (isSearchResultsPage()) {
            if (isShortsLabel(nodeText(chip))) {
                shortsSearchClickOverrideUntil = performance.now() + 1800;
                document.documentElement.setAttribute('data-liquid-glass-search-shorts', 'show');
                restoreSearchShorts();
            }
            else {
                shortsSearchClickOverrideUntil = 0;
                document.documentElement.setAttribute('data-liquid-glass-search-shorts', 'hide');
            }
            window.setTimeout(hideShortsShelves, 0);
            window.setTimeout(hideShortsShelves, 100);
            window.setTimeout(hideShortsShelves, 320);
        }
        window.requestAnimationFrame(() => { tidyChipBar(row || chip); scheduleChipFit(); });
        window.setTimeout(() => { tidyChipBar(row || chip); scheduleChipFit(); }, 90);
    }, true);
    document.addEventListener('click', (event) => {
        const path = event.composedPath?.() || [];
        const arrow = path.find((node) => node?.id === 'left-arrow-button' || node?.id === 'right-arrow-button' || node?.id === 'left-arrow' || node?.id === 'right-arrow')
            || event.target?.closest?.('#left-arrow-button, #right-arrow-button, #left-arrow, #right-arrow');
        if (!arrow)
            return;
        const bar = arrow.closest?.('ytd-feed-filter-chip-bar-renderer');
        if (!bar || bar.getAttribute(CHIP_OVERFLOW_ATTR) !== '1')
            return;
        const scroll = bar.querySelector('#scroll-container');
        if (!scroll)
            return;
        const dir = /left/.test(arrow.id) ? -1 : 1;
        const distance = Math.max(180, Math.round(scroll.clientWidth * .62));
        event.preventDefault();
        event.stopPropagation();
        scroll.scrollBy({ left: dir * distance, behavior: 'smooth' });
    }, true);
    let chromeLayoutFrame = 0;
    let chromeLayoutSettleTimer = 0;
    function visibleRect(element) {
        if (!(element instanceof Element))
            return null;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1)
            return null;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden')
            return null;
        return rect;
    }
    function mastheadVisualBottom() {
        const candidates = [
            document.querySelector('ytd-masthead #container.ytd-masthead'),
            document.querySelector('ytd-masthead #container'),
            document.querySelector('ytd-masthead')
        ].filter(Boolean);
        for (const candidate of candidates) {
            const rect = visibleRect(candidate);
            if (!rect)
                continue;
            if (rect.bottom <= 0 || rect.top >= innerHeight)
                continue;
            return Math.max(0, Math.min(innerHeight, rect.bottom));
        }
        return 0;
    }
    function firstVisibleChipRect(bar) {
        const selectors = [
            '[data-liquid-glass-chip-surface="1"]',
            'chip-shape button[role="tab"]',
            'button[role="tab"]',
            'yt-chip-cloud-chip-renderer'
        ];
        for (const selector of selectors) {
            for (const node of bar.querySelectorAll(selector)) {
                const rect = visibleRect(node);
                if (rect)
                    return rect;
            }
        }
        return visibleRect(bar);
    }
    function syncFloatingChromeLayout() {
        chromeLayoutFrame = 0;
        const root = document.documentElement;
        const measuredBottom = mastheadVisualBottom();
        const fallbackBottom = 52;
        const chromeTop = Math.max(0, Math.min(96, Math.round((measuredBottom || fallbackBottom) + 2)));
        root.style.setProperty('--lg-chrome-top', `${chromeTop}px`);
        document.querySelectorAll('ytd-feed-filter-chip-bar-renderer').forEach((bar) => {
            if (bar instanceof HTMLElement)
                bar.style.removeProperty('--lg-chip-shift-y');
        });
        document.querySelectorAll('ytd-app ytd-guide-renderer').forEach((guide) => {
            if (!(guide instanceof HTMLElement))
                return;
            guide.style.removeProperty('--lg-guide-shift-y');
            guide.style.removeProperty('--lg-guide-live-height');
        });
    }
    function scheduleFloatingChromeLayout(settle = false) {
        if (!chromeLayoutFrame)
            chromeLayoutFrame = requestAnimationFrame(syncFloatingChromeLayout);
        if (!settle)
            return;
        clearTimeout(chromeLayoutSettleTimer);
        let pass = 0;
        const settlePass = () => {
            syncFloatingChromeLayout();
            if (++pass < 4)
                chromeLayoutSettleTimer = setTimeout(settlePass, pass === 1 ? 70 : 180);
        };
        chromeLayoutSettleTimer = setTimeout(settlePass, 40);
    }
    document.addEventListener('yt-navigate-start', () => {
        requestAnimationFrame(syncRouteState);
        setTimeout(syncRouteState, 0);
    }, true);
    document.addEventListener('yt-navigate-finish', () => {
        syncRouteState();
        clearWatchNavigationVisual();
        if (!settings.enabled)
            return;
        scheduleCleanup(true);
        settleSearchBox();
        scheduleFloatingChromeLayout(true);
    }, true);
    function syncVideoPlaybackState(event) {
        const candidate = event?.target instanceof HTMLVideoElement
            ? event.target
            : document.querySelector('video.html5-main-video, .html5-video-player video, video');
        const playing = Boolean(candidate && !candidate.paused && !candidate.ended && candidate.readyState >= 2 && document.querySelector('ytd-watch-flexy'));
        document.documentElement.setAttribute('data-liquid-glass-video-playing', playing ? 'true' : 'false');
    }
    document.addEventListener('play', syncVideoPlaybackState, true);
    document.addEventListener('playing', syncVideoPlaybackState, true);
    document.addEventListener('pause', syncVideoPlaybackState, true);
    document.addEventListener('ended', syncVideoPlaybackState, true);
    document.addEventListener('emptied', syncVideoPlaybackState, true);
    document.addEventListener('yt-navigate-finish', () => setTimeout(syncVideoPlaybackState, 80), true);
    setTimeout(syncVideoPlaybackState, 0);
    document.addEventListener('fullscreenchange', settleFullscreenState, true);
    document.addEventListener('webkitfullscreenchange', settleFullscreenState, true);
    document.addEventListener('yt-player-fullscreen-change', settleFullscreenState, true);
    window.addEventListener('resize', () => { settleFullscreenState(); stabilizeFullGuide(); scheduleChipFit(); scheduleGuideAlignment(); scheduleFloatingChromeLayout(); }, { passive: true });
    syncRouteState();
    syncFullscreenState();
    scheduleFloatingChromeLayout(true);
    const observer = new MutationObserver((mutations) => {
        if (mutations.some(mutationIsRelevant))
            scheduleCleanup(false);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: false, attributes: false });
    loadSettings();
})();
