import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { getHostname } from './modules/utils.js';
import { MODES, MESSAGES } from './modules/constants.js';

document.addEventListener('DOMContentLoaded', initPopup);

let currentHostname = null;

async function initPopup() {
    setupEventListeners();
    await loadInitialState();
}

function setupEventListeners() {
    // Tab Actions
    // 1. Workspace (Visible tabs)
    bindAction('send-workspace', { currentWindow: true, hidden: false, pinned: false });
    // 2. Selected (Highlighted)
    bindAction('send-selected', { currentWindow: true, highlighted: true, pinned: false });
    // 3. All (Window)
    bindAction('send-all', { currentWindow: true, pinned: false });

    // Navigation
    document.getElementById('open-dashboard').addEventListener('click', () => {
        browser.tabs.create({ url: "options.html" });
        window.close();
    });

    document.getElementById('btn-settings-icon').addEventListener('click', () => {
        browser.tabs.create({ url: "options.html#view-settings" });
        window.close();
    });

    // Filtering Controls
    document.getElementById('toggle-filter').addEventListener('click', handleToggleFilter);
    document.getElementById('mode-select').addEventListener('change', handleModeChange);
}

function bindAction(elementId, query) {
    const el = document.getElementById(elementId);
    if (el) {
        el.addEventListener('click', () => executeTabAction(query));
    }
}

async function loadInitialState() {
    const settings = await settingsManager.getSettings();
    document.getElementById('mode-select').value = settings.mode;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentHostname = getHostname(tab?.url);

    if (currentHostname) {
        renderFilterButton(settings);
    } else {
        document.getElementById('toggle-filter').style.display = 'none';
    }
}

async function executeTabAction(query) {
    try {
        const result = await tabManager.getTabsForAction(query);

        if (result.tabsToSave.length > 0) {
            // Send to background to save (ensures completion if popup closes)
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
    btn.classList.remove('status-loading', 'bl-add', 'bl-remove', 'wl-add', 'wl-remove');
    
    const list = mode === MODES.BLACKLIST ? blacklist : whitelist;
    const isInList = list.includes(currentHostname);

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