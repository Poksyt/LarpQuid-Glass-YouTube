(() => {
    'use strict';
    const PATCH_FLAG = Symbol.for('liquidGlassYouTubeEarlyShadowPatch');
    if (Element.prototype[PATCH_FLAG])
        return;
    Element.prototype[PATCH_FLAG] = true;
    const SEARCH_CSS = `
    input[type="search"] {
      -webkit-appearance: none !important;
      appearance: none !important;
    }
    input[type="search"]::-webkit-search-decoration,
    input[type="search"]::-webkit-search-results-button,
    input[type="search"]::-webkit-search-results-decoration {
      -webkit-appearance: none !important;
      appearance: none !important;
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    :is(.ytSearchboxComponentInputSearchIcon,[class*="InputSearchIcon"],[class*="LeadingSearchIcon"],[class*="leadingSearchIcon"]) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      min-width: 0 !important;
      max-width: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      flex: 0 0 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: none !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
      pointer-events: none !important;
    }
    :is(
      .ytSearchboxComponentInputBoxHasFocus,
      [class*="InputBoxHasFocus"],
      .ytSearchboxComponentInputContainerIsFocused .ytSearchboxComponentInputBox,
      [class*="InputContainerIsFocused"] [class*="InputBox"]
    )::before,
    :is(
      .ytSearchboxComponentInputBoxHasFocus,
      [class*="InputBoxHasFocus"],
      .ytSearchboxComponentInputContainerIsFocused .ytSearchboxComponentInputBox,
      [class*="InputContainerIsFocused"] [class*="InputBox"]
    )::after {
      content: none !important;
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: none !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
      box-shadow: none !important;
      pointer-events: none !important;
    }
    
    :is(div, form):has(input[name="search_query"])::before,
    :is(div, form):has(input[name="search_query"])::after,
    :is([class*="InputBox"], [class*="InputContainer"], [class*="InputWrapper"]):has(input)::before,
    :is([class*="InputBox"], [class*="InputContainer"], [class*="InputWrapper"]):has(input)::after {
      content: none !important;
      display: none !important;
      background: none !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
      box-shadow: none !important;
    }
    :is([class*="InputBox"], [class*="InputContainer"], [class*="InputWrapper"]):has(input) {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
      -webkit-mask-image: none !important;
      mask-image: none !important;
    }
    
    .ytSearchboxComponentInputBox > :not(form):not(.ytSearchboxComponentYtdTextInputAssistantWrapper):not([class*="TextInputAssistant"]) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      inline-size: 0 !important;
      block-size: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      pointer-events: none !important;
    }
    .ytSearchboxComponentInputBox,
    .ytSearchboxComponentInputContainer,
    .ytSearchboxComponentInputWrapper {
      background: transparent !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
    }
    .ytSearchboxComponentInputBox input[name="search_query"] {
      background: transparent !important;
      background-image: none !important;
      -webkit-mask: none !important;
      mask: none !important;
      padding-inline-start: 14px !important;
      text-indent: 0 !important;
    }
    .ytSearchboxComponentSearchForm > :not(input[name="search_query"]):not(input[role="combobox"]) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      inline-size: 0 !important;
      block-size: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      pointer-events: none !important;
    }
  `;
    const LIGHT_SEARCH_CSS = `
    yt-searchbox .ytSearchboxComponentInputSearchIcon,
    yt-searchbox [class*="InputSearchIcon"],
    yt-searchbox [class*="LeadingSearchIcon"],
    yt-searchbox [class*="leadingSearchIcon"],
    ytd-searchbox .ytSearchboxComponentInputSearchIcon,
    ytd-searchbox [class*="InputSearchIcon"] {
      display:none!important; visibility:hidden!important; opacity:0!important;
      width:0!important; min-width:0!important; max-width:0!important;
      height:0!important; min-height:0!important; max-height:0!important;
      flex:0 0 0!important; margin:0!important; padding:0!important; border:0!important;
      background:none!important; background-image:none!important;
      -webkit-mask:none!important; mask:none!important; pointer-events:none!important;
    }
    yt-searchbox :is(div,form,[class*="InputBox"],[class*="InputContainer"],[class*="InputWrapper"]):has(input[name="search_query"])::before,
    yt-searchbox :is(div,form,[class*="InputBox"],[class*="InputContainer"],[class*="InputWrapper"]):has(input[name="search_query"])::after,
    ytd-searchbox :is(div,form):has(input[name="search_query"])::before,
    ytd-searchbox :is(div,form):has(input[name="search_query"])::after {
      content:none!important; display:none!important; width:0!important; height:0!important;
      margin:0!important; padding:0!important; border:0!important; background:none!important;
      background-image:none!important; -webkit-mask:none!important; mask:none!important;
      box-shadow:none!important; pointer-events:none!important;
    }
    yt-searchbox :is([class*="InputBox"],[class*="InputContainer"],[class*="InputWrapper"]):has(input[name="search_query"]),
    ytd-searchbox :is(#container,#search-input,#search-container):has(input[name="search_query"]) {
      background:transparent!important; background-color:transparent!important; background-image:none!important;
      -webkit-mask:none!important; mask:none!important; -webkit-mask-image:none!important; mask-image:none!important;
    }
    yt-searchbox .ytSearchboxComponentInputBox > :not(form):not(.ytSearchboxComponentYtdTextInputAssistantWrapper):not([class*="TextInputAssistant"]) {
      display:none!important; visibility:hidden!important; opacity:0!important;
      inline-size:0!important; block-size:0!important; margin:0!important; padding:0!important; pointer-events:none!important;
    }
    yt-searchbox .ytSearchboxComponentInputBox input[name="search_query"] {
      background:transparent!important; background-image:none!important; -webkit-mask:none!important; mask:none!important;
      padding-inline-start:14px!important; text-indent:0!important;
    }
    yt-searchbox .ytSearchboxComponentSearchForm > :not(input[name="search_query"]):not(input[role="combobox"]) {
      display:none!important; visibility:hidden!important; opacity:0!important; inline-size:0!important; block-size:0!important;
      margin:0!important; padding:0!important; pointer-events:none!important;
    }
  `;
    function installLightSearchStyle() {
        if (document.getElementById('liquid-glass-search-light-dom'))
            return;
        const target = document.head || document.documentElement;
        if (!target) {
            setTimeout(installLightSearchStyle, 0);
            return;
        }
        const style = document.createElement('style');
        style.id = 'liquid-glass-search-light-dom';
        style.textContent = LIGHT_SEARCH_CSS;
        target.appendChild(style);
    }
    installLightSearchStyle();
    const CHIP_CSS = `
    :host {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      color: var(--lg-chip-fg, inherit) !important;
      --yt-spec-text-primary: var(--lg-chip-fg, currentColor) !important;
      --yt-spec-text-secondary: var(--lg-chip-muted, currentColor) !important;
      --yt-spec-button-chip-background: transparent !important;
      --yt-spec-badge-chip-background: transparent !important;
    }
    :where(button,[role="button"],.ytChipShapeChip,[class*="ChipShape"],[class*="chip"],span,div) {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      border-color: transparent !important;
      color: inherit !important;
    }
    :where(button,[role="button"],.ytChipShapeChip,[class*="ChipShape"],[class*="chip"],span,div)::before,
    :where(button,[role="button"],.ytChipShapeChip,[class*="ChipShape"],[class*="chip"],span,div)::after {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
    }
  `;
    function appendStyle(root, key, css) {
        if (!root || root.querySelector?.(`style[data-liquid-glass-${key}="1"]`))
            return;
        const style = document.createElement('style');
        style.setAttribute(`data-liquid-glass-${key}`, '1');
        style.textContent = css;
        root.appendChild(style);
    }
    function stripChipPaint(root) {
        root.querySelectorAll?.('button, [role="button"], .ytChipShapeChip, [class*="ChipShape"], [class*="chip"], span, div').forEach((node) => {
            if (!node?.style)
                return;
            node.style.setProperty('background', 'transparent', 'important');
            node.style.setProperty('background-color', 'transparent', 'important');
            node.style.setProperty('background-image', 'none', 'important');
            node.style.setProperty('box-shadow', 'none', 'important');
            node.style.setProperty('border-color', 'transparent', 'important');
            node.style.setProperty('color', 'var(--lg-chip-fg, inherit)', 'important');
        });
    }
    function isSearchDecoration(node) {
        if (!(node instanceof Element))
            return false;
        const className = typeof node.className === 'string' ? node.className : (node.className?.baseVal || '');
        const key = `${node.id || ''} ${className}`.toLowerCase();
        if (/inputsearchicon|search.*icon|icon.*search|leading.*icon/.test(key))
            return true;
        return node.getAttribute('aria-hidden') === 'true' && Boolean(node.querySelector?.('svg, yt-icon, yt-icon-shape, icon-shape'));
    }
    function hideSearchDecoration(node) {
        if (!node?.style)
            return;
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('opacity', '0', 'important');
        node.style.setProperty('width', '0', 'important');
        node.style.setProperty('min-width', '0', 'important');
        node.style.setProperty('max-width', '0', 'important');
        node.style.setProperty('height', '0', 'important');
        node.style.setProperty('min-height', '0', 'important');
        node.style.setProperty('max-height', '0', 'important');
        node.style.setProperty('margin', '0', 'important');
        node.style.setProperty('padding', '0', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
    }
    function killSearchLeadingIcon(root) {
        if (!root?.querySelectorAll)
            return;
        root.querySelectorAll('.ytSearchboxComponentInputBox, [class*="SearchboxComponentInputBox"]').forEach((box) => {
            const input = box.querySelector('input[name="search_query"], input[role="combobox"]');
            if (!input)
                return;
            Array.from(box.children).forEach((child) => {
                if (child.matches?.('form, .ytSearchboxComponentYtdTextInputAssistantWrapper, [class*="TextInputAssistant"]'))
                    return;
                if (child.contains?.(input) || !isSearchDecoration(child))
                    return;
                hideSearchDecoration(child);
            });
            box.style?.setProperty('background', 'transparent', 'important');
            box.style?.setProperty('background-image', 'none', 'important');
            box.style?.setProperty('-webkit-mask', 'none', 'important');
            box.style?.setProperty('mask', 'none', 'important');
            input.style?.setProperty('background', 'transparent', 'important');
            input.style?.setProperty('background-image', 'none', 'important');
            input.style?.setProperty('-webkit-mask', 'none', 'important');
            input.style?.setProperty('mask', 'none', 'important');
            input.style?.setProperty('padding-inline-start', '14px', 'important');
            input.style?.setProperty('text-indent', '0', 'important');
            const form = input.closest?.('form');
            if (form && box.contains(form)) {
                Array.from(form.children || []).forEach((child) => {
                    if (child === input || child.contains?.(input) || !isSearchDecoration(child))
                        return;
                    hideSearchDecoration(child);
                });
            }
        });
        const icons = root.querySelectorAll('.ytSearchboxComponentInputSearchIcon, [class*="InputSearchIcon"], [class*="LeadingSearchIcon"], [class*="leadingSearchIcon"]');
        icons.forEach(hideSearchDecoration);
        root.querySelectorAll('input[name="search_query"], input[type="search"], input[role="combobox"]').forEach((input) => {
            input.style?.setProperty('background-image', 'none', 'important');
            input.style?.setProperty('-webkit-mask-image', 'none', 'important');
            input.style?.setProperty('mask-image', 'none', 'important');
            let box = input.parentElement;
            for (let i = 0; box && i < 5; i += 1, box = box.parentElement) {
                box.style?.setProperty('background-image', 'none', 'important');
                box.style?.setProperty('-webkit-mask-image', 'none', 'important');
                box.style?.setProperty('mask-image', 'none', 'important');
            }
        });
    }
    const observedSearchRoots = new WeakSet();
    function watchSearchRoot(root) {
        if (!root || observedSearchRoots.has(root))
            return;
        observedSearchRoots.add(root);
        killSearchLeadingIcon(root);
        const observer = new MutationObserver(() => killSearchLeadingIcon(root));
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        const settle = () => {
            killSearchLeadingIcon(root);
            queueMicrotask(() => killSearchLeadingIcon(root));
            requestAnimationFrame(() => killSearchLeadingIcon(root));
            [24, 80, 180, 420, 900].forEach((delay) => setTimeout(() => killSearchLeadingIcon(root), delay));
        };
        root.addEventListener('focusin', settle, true);
        root.addEventListener('pointerdown', settle, true);
        root.addEventListener('input', settle, true);
    }
    function patchRoot(root, host) {
        if (!root || !host)
            return;
        const tag = (host.localName || '').toLowerCase();
        if (tag === 'yt-searchbox' || tag === 'ytd-searchbox') {
            appendStyle(root, 'search-native', SEARCH_CSS);
            watchSearchRoot(root);
            killSearchLeadingIcon(root);
            return;
        }
        if (tag === 'chip-shape' || tag === 'yt-chip-shape' || tag === 'yt-chip-cloud-chip-renderer' || tag === 'chip-view-model' || tag === 'yt-chip-view-model') {
            appendStyle(root, 'chip-native', CHIP_CSS);
            stripChipPaint(root);
        }
    }
    const PATCHED_HOSTS = new Set([
        'yt-searchbox', 'ytd-searchbox',
        'chip-shape', 'yt-chip-shape', 'yt-chip-cloud-chip-renderer',
        'chip-view-model', 'yt-chip-view-model'
    ]);
    const originalAttachShadow = Element.prototype.attachShadow;
    if (typeof originalAttachShadow === 'function') {
        Element.prototype.attachShadow = function (init) {
            const root = originalAttachShadow.call(this, init);
            const host = this;
            const tag = (host.localName || '').toLowerCase();
            if (!PATCHED_HOSTS.has(tag))
                return root;
            const repatch = () => {
                try {
                    patchRoot(root, host);
                }
                catch (_error) { }
            };
            repatch();
            queueMicrotask(repatch);
            window.setTimeout(repatch, 0);
            window.setTimeout(repatch, 80);
            return root;
        };
    }
    const searchHostObservers = new WeakSet();
    function watchSearchHost(host) {
        if (!host || searchHostObservers.has(host))
            return;
        searchHostObservers.add(host);
        killSearchLeadingIcon(host);
        const observer = new MutationObserver(() => killSearchLeadingIcon(host));
        observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        const settle = () => {
            killSearchLeadingIcon(host);
            queueMicrotask(() => killSearchLeadingIcon(host));
            requestAnimationFrame(() => killSearchLeadingIcon(host));
            [20, 70, 160, 360, 800].forEach((delay) => setTimeout(() => killSearchLeadingIcon(host), delay));
        };
        host.addEventListener('focusin', settle, true);
        host.addEventListener('pointerdown', settle, true);
        host.addEventListener('input', settle, true);
    }
    function scanSearchHosts(root = document) {
        if (root?.matches?.('yt-searchbox, ytd-searchbox'))
            watchSearchHost(root);
        root?.querySelectorAll?.('yt-searchbox, ytd-searchbox').forEach(watchSearchHost);
    }
    const installDocumentSearchObserver = () => {
        const target = document.documentElement;
        if (!target)
            return;
        scanSearchHosts(document);
        if (document.querySelector('yt-searchbox, ytd-searchbox'))
            return;
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (!(node instanceof Element))
                        continue;
                    const host = node.matches?.('yt-searchbox, ytd-searchbox')
                        ? node
                        : node.querySelector?.('yt-searchbox, ytd-searchbox');
                    if (!host)
                        continue;
                    watchSearchHost(host);
                    observer.disconnect();
                    return;
                }
            }
        });
        observer.observe(target, { childList: true, subtree: true });
    };
    const scan = () => {
        document.querySelectorAll?.('yt-searchbox, ytd-searchbox, chip-shape, yt-chip-shape, yt-chip-cloud-chip-renderer, chip-view-model, yt-chip-view-model').forEach((host) => {
            try {
                if (host.shadowRoot)
                    patchRoot(host.shadowRoot, host);
            }
            catch (_error) { }
        });
        scanSearchHosts(document);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { scan(); installDocumentSearchObserver(); }, { once: true });
    }
    else {
        scan();
        installDocumentSearchObserver();
    }
})();
