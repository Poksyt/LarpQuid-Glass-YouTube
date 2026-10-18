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
    const ids = Object.keys(DEFAULTS);
    const videoActionIds = new Set(['hideJoin', 'hideShare', 'hideSave', 'hideDownload']);
    function setDisabled(disabled) {
        for (const id of ids) {
            if (id === 'enabled')
                continue;
            const input = document.getElementById(id);
            if (!input)
                continue;
            input.disabled = disabled;
            input.closest('label')?.classList.toggle('disabled', disabled);
        }
    }
    function updateActionState(id, hidden) {
        if (!videoActionIds.has(id))
            return;
        const state = document.querySelector(`[data-state-for="${id}"]`);
        if (!state)
            return;
        state.textContent = hidden ? 'Hidden' : 'Shown';
        state.dataset.value = hidden ? 'hidden' : 'shown';
        const input = document.getElementById(id);
        input?.closest('.action-row')?.setAttribute('aria-label', `${input.closest('.action-row')?.querySelector('.action-name')?.textContent || 'Action'}: ${hidden ? 'hidden' : 'shown'}`);
    }
    function reloadActiveYouTubeTab() {
        if (!chrome.tabs?.query || !chrome.tabs?.reload)
            return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError)
                return;
            const tab = tabs?.[0];
            if (!tab?.id || !/^https:\/\/(?:www\.)?youtube\.com\//i.test(tab.url || ''))
                return;
            chrome.tabs.reload(tab.id);
        });
    }
    function load() {
        chrome.storage.local.get(DEFAULTS, (stored) => {
            const state = { ...DEFAULTS, ...stored };
            for (const id of ids) {
                const input = document.getElementById(id);
                if (input)
                    input.checked = !!state[id];
                updateActionState(id, !!state[id]);
            }
            setDisabled(!state.enabled);
        });
    }
    for (const id of ids) {
        const input = document.getElementById(id);
        input?.addEventListener('change', () => {
            const value = !!input.checked;
            updateActionState(id, value);
            chrome.storage.local.set({ [id]: value }, () => {
                if (id === 'enabled') {
                    setDisabled(!value);
                    if (!value)
                        reloadActiveYouTubeTab();
                }
            });
        });
    }
    load();
})();
