import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { getHostname } from './modules/utils.js';
import { MODES, MESSAGES } from './modules/constants.js';

let currentHostname = null;

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadInitialState();
});

function setupEventListeners() {
    // Tab Actions
    const bindAction = (id, query) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => executeTabAction(query));
    };

    bindAction('send-workspace', { currentWindow: true, hidden: false, pinned: false });
    bindAction('send-selected', { currentWindow: true, highlighted: true, pinned: false });
    bindAction('send-all', { currentWindow: true, pinned: false });

    // Navigation
    const openLink = (url) => {
        browser.tabs.create({ url });
        window.close();
    };

    document.getElementById('open-dashboard').addEventListener('click', () => openLink("options.html"));
    document.getElementById('btn-settings-icon').addEventListener('click', () => openLink("options.html#view-settings"));

    // Filtering Controls
    document.getElementById('toggle-filter').addEventListener('click', handleToggleFilter);
    document.getElementById('mode-select').addEventListener('change', handleModeChange);
}

async function loadInitialState() {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentHostname = getHostname(tab?.url);
        
        const settings = await settingsManager.getSettings();
        document.getElementById('mode-select').value = settings.mode;

        if (currentHostname) {
            renderFilterButton(settings);
        } else {
            document.getElementById('toggle-filter').style.display = 'none';
        }
    } catch (e) {
        console.error("Popup init error", e);
    }
}

async function executeTabAction(query) {
    try {
        const result = await tabManager.getTabsForAction(query);

        if (result.tabsToSave.length > 0) {
            // Hand off to background to ensure completion if popup closes
            await browser.runtime.sendMessage({ 
                action: MESSAGES.SAVE_TABS, 
                tabs: result.tabsToSave 
            });
            await browser.tabs.remove(result.idsToClose);
        }
        window.close();
    } catch (e) {
        console.error("Failed to process tabs", e);
    }
}

async function handleModeChange(e) {
    await settingsManager.setMode(e.target.value);
    const settings = await settingsManager.getSettings();
    if (currentHostname) renderFilterButton(settings);
}

async function handleToggleFilter() {
    if (!currentHostname) return;
    await settingsManager.toggleCurrentDomain(currentHostname);
    
    const settings = await settingsManager.getSettings();
    renderFilterButton(settings);
}

function renderFilterButton(settings) {
    const btn = document.getElementById('toggle-filter');
    const { mode, blacklist, whitelist } = settings;
    
    btn.style.display = 'inline-block';
    // Clean classes
    btn.classList.remove('status-loading', 'bl-add', 'bl-remove', 'wl-add', 'wl-remove');
    
    const list = mode === MODES.BLACKLIST ? blacklist : whitelist;
    const isInList = list.includes(currentHostname);

    // Define UI states
    const states = {
        [MODES.BLACKLIST]: {
            added: { text: `Un-block ${currentHostname}`, cls: 'bl-remove', title: "Allow this site" },
            removed: { text: `Block ${currentHostname}`, cls: 'bl-add', title: "Block this site" }
        },
        [MODES.WHITELIST]: {
            added: { text: `Remove ${currentHostname}`, cls: 'wl-remove', title: "Block this site" },
            removed: { text: `Allow ${currentHostname}`, cls: 'wl-add', title: "Allow this site" }
        }
    };

    const state = isInList ? states[mode].added : states[mode].removed;
    
    btn.innerText = state.text;
    btn.classList.add('btn-pill', state.cls);
    btn.title = state.title;
}