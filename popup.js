import { storageService } from './modules/storage.js';
import { FilterService } from './modules/filters.js';
import { getHostname } from './modules/utils.js';
import { MODES } from './modules/constants.js';

document.addEventListener('DOMContentLoaded', initPopup);

// --- Initialization ---
let currentHostname = null;

async function initPopup() {
    setupEventListeners();

    // 1. Initialize Mode Select
    const settings = await storageService.getSettings();
    document.getElementById('mode-select').value = settings.mode;

    // 2. Identify Current Hostname
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentHostname = getHostname(tab?.url);

    if (currentHostname) {
        await updateFilterButtonUI(settings);
    }
}

function setupEventListeners() {
    document.getElementById('send-workspace').addEventListener('click', () => 
        handleTabAction({ currentWindow: true, hidden: false, pinned: false }));
    
    document.getElementById('send-selected').addEventListener('click', () => 
        handleTabAction({ currentWindow: true, highlighted: true, pinned: false }));
    
    document.getElementById('send-all').addEventListener('click', () => 
        handleTabAction({ currentWindow: true, pinned: false }));

    document.getElementById('open-dashboard').addEventListener('click', () => {
        browser.tabs.create({ url: "options.html" });
        window.close();
    });

    document.getElementById('toggle-filter').addEventListener('click', handleToggleFilter);

    document.getElementById('mode-select').addEventListener('change', async (e) => {
        await storageService.setMode(e.target.value);
        const settings = await storageService.getSettings();
        await updateFilterButtonUI(settings);
    });
}

// --- Logic ---

async function handleTabAction(queryObj) {
    const tabs = await browser.tabs.query(queryObj);
    if (!tabs.length) return;

    const settings = await storageService.getSettings();
    const result = filterTabs(tabs, settings);

    if (result.tabsToSave.length > 0) {
        await browser.runtime.sendMessage({ action: "saveTabs", tabs: result.tabsToSave });
        await browser.tabs.remove(result.idsToClose);
    }
    window.close();
}

function filterTabs(tabs, settings) {
    const tabsToSave = [];
    const idsToClose = [];

    for (const tab of tabs) {
        // Use FilterService to check if we should save
        if (FilterService.shouldSave(tab.url, settings)) {
            tabsToSave.push({
                title: tab.title,
                url: tab.url,
                favIconUrl: tab.favIconUrl
            });
            idsToClose.push(tab.id);
        }
    }
    return { tabsToSave, idsToClose };
}

async function handleToggleFilter() {
    if (!currentHostname) return;
    const settings = await storageService.getSettings();
    await FilterService.toggleDomain(currentHostname, settings, storageService);
    
    // Refresh UI with new settings
    const newSettings = await storageService.getSettings();
    await updateFilterButtonUI(newSettings);
}

async function updateFilterButtonUI(settings) {
    const btn = document.getElementById('toggle-filter');
    btn.style.display = 'inline-block';

    const { mode, blacklist, whitelist } = settings;
    const list = mode === MODES.BLACKLIST ? blacklist : whitelist;
    const isInList = list.includes(currentHostname);

    // Update Button State via Helper to keep this clean
    renderFilterButton(btn, mode, isInList, currentHostname);
}

function renderFilterButton(btn, mode, isInList, hostname) {
    if (mode === MODES.BLACKLIST) {
        if (isInList) {
            btn.innerText = `Un-blacklist ${hostname}`;
            btn.className = 'btn-action-link bl-remove';
            btn.title = "Allow this site to be saved";
        } else {
            btn.innerText = `Blacklist ${hostname}`;
            btn.className = 'btn-action-link bl-add';
            btn.title = "Never save tabs from this site";
        }
    } else {
        if (isInList) {
            btn.innerText = `Un-whitelist ${hostname}`;
            btn.className = 'btn-action-link wl-remove';
            btn.title = "Stop saving tabs from this site";
        } else {
            btn.innerText = `Whitelist ${hostname}`;
            btn.className = 'btn-action-link wl-add';
            btn.title = "Allow this site to be saved";
        }
    }
}