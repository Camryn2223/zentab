import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { storageService } from './modules/storage.js';
import { backupManager } from './modules/backup-manager.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { MODES, MESSAGES } from './modules/constants.js';
import { debounce } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    await Promise.all([initGroupList(), initSettingsPane()]);

    if (window.location.hash === '#view-settings') {
        navigateTo('view-settings');
    }
});

// --- NAVIGATION ---
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.target);
        });
    });
}

function navigateTo(targetId) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.target === targetId);
    });

    sections.forEach(s => {
        const isActive = s.id === targetId;
        s.style.display = isActive ? 'block' : 'none';
        s.classList.toggle('active', isActive);
    });
}

// --- DASHBOARD (SAVED TABS) ---
let allGroups = []; 
let currentSearchTerm = ''; 

async function initGroupList() {
    await loadAndRenderGroups();

    document.getElementById('clear-all').addEventListener('click', handleClearAll);
    document.getElementById('dashboard-search').addEventListener('input', debounce(handleSearch, 300));
}

async function loadAndRenderGroups() {
    allGroups = await storageService.getGroups();
    
    // Sort: Pinned first, then Newest ID first
    allGroups.sort((a, b) => {
        if (!!a.pinned === !!b.pinned) {
            return b.id - a.id; // Same pin state, sort by date desc
        }
        return a.pinned ? -1 : 1; // Pinned comes first
    });

    // Apply current search filter if exists, otherwise render all
    if (currentSearchTerm) {
        filterAndRender(currentSearchTerm);
    } else {
        renderGroups(allGroups);
    }
}

function filterAndRender(term) {
    const filteredGroups = allGroups.filter(group => {
        const titleMatch = (group.customTitle || '').toLowerCase().includes(term);
        const tabMatch = group.tabs.some(tab =>
            tab.title.toLowerCase().includes(term) ||
            tab.url.toLowerCase().includes(term)
        );
        return titleMatch || tabMatch;
    });
    renderGroups(filteredGroups);
}

async function renderGroups(groupsToRender) {
    const container = document.getElementById('container');
    container.innerHTML = '';

    const settings = await settingsManager.getSettings();

    if (groupsToRender.length === 0) {
        UIRenderer.updateEmptyState(container, 'No tabs found.');
        return;
    }

    const fragment = document.createDocumentFragment();

    groupsToRender.forEach(group => {
        // Actions wrapper
        const actions = {
            onRestore: async (id) => { await tabManager.restoreGroup(id); await loadAndRenderGroups(); },
            onRestoreWin: async (id) => { await tabManager.restoreGroupInNewWindow(id); await loadAndRenderGroups(); },
            onDelete: async (id) => { await tabManager.deleteGroup(id); await loadAndRenderGroups(); },
            onPin: async (id) => { await tabManager.togglePin(id); await loadAndRenderGroups(); }
        };

        const groupEl = UIRenderer.createTabGroupElement(group, actions, { showFavicons: settings.general.showFavicons });

        // Rename event listener
        groupEl.addEventListener('group-rename', async (e) => {
            const { id, newTitle } = e.detail;
            await tabManager.renameGroup(id, newTitle);
            await loadAndRenderGroups();
        });

        fragment.appendChild(groupEl);
    });

    container.appendChild(fragment);
}

async function handleClearAll() {
    const hasUnpinned = allGroups.some(g => !g.pinned);
    
    if (hasUnpinned && confirm("Delete all UNPINNED groups? Pinned groups will be saved.")) {
        const remaining = await tabManager.clearAll();
        if(remaining > 0) {
            alert(`Cleared history. ${remaining} pinned groups kept.`);
        }
        await loadAndRenderGroups();
    } else if (!hasUnpinned) {
        alert("Only pinned groups remain. Unpin them to delete.");
    }
}

async function handleSearch(e) {
    currentSearchTerm = e.target.value.toLowerCase();
    filterAndRender(currentSearchTerm);
}

// --- SETTINGS VIEW ---
async function initSettingsPane() {
    const settings = await settingsManager.getSettings();
    
    initFilterSettings(settings);

    const faviconCheckbox = document.getElementById('setting-favicons');
    faviconCheckbox.checked = settings.general.showFavicons;
    
    faviconCheckbox.addEventListener('change', async (e) => {
        await settingsManager.updateGeneralSetting('showFavicons', e.target.checked);
        await loadAndRenderGroups(); 
    });

    initBackupUI(settings.backup);
    initOneTabUI();
}

function initFilterSettings(settings) {
    const select = document.getElementById('mode-select');
    select.value = settings.mode;
    updateDomainUI(settings);

    select.addEventListener('change', async (e) => {
        await settingsManager.setMode(e.target.value);
        resetInputs();
        await refreshSettingsUI();
    });

    document.getElementById('add-btn').addEventListener('click', handleAddDomain);
    document.getElementById('add-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddDomain();
    });

    document.getElementById('search-input').addEventListener('input', 
        debounce(async (e) => {
            const currentSettings = await settingsManager.getSettings();
            renderDomainList(currentSettings, e.target.value);
        }, 300)
    );
}

function initOneTabUI() {
    const textarea = document.getElementById('onetab-io');
    const status = document.getElementById('onetab-status');

    document.getElementById('btn-onetab-import').addEventListener('click', async () => {
        const text = textarea.value.trim();
        const tabs = backupManager.parseOneTabImport(text);

        if (tabs.length > 0) {
            await tabManager.saveTabGroup(tabs);
            await loadAndRenderGroups();
            textarea.value = '';
            status.innerText = `Successfully imported ${tabs.length} links into a new group!`;
            status.style.color = "var(--accent-green)";
        } else {
            status.innerText = "No valid URLs found in text.";
            status.style.color = "var(--accent-red)";
        }
    });

    document.getElementById('btn-onetab-export').addEventListener('click', async () => {
        const text = await backupManager.generateOneTabExport();
        textarea.value = text;
        status.innerText = "Export list generated. Copy text above.";
        status.style.color = "var(--text-primary)";
    });
}

function initBackupUI(backupSettings) {
    const enabledCheck = document.getElementById('backup-enabled');
    const valInput = document.getElementById('backup-val');
    const unitSelect = document.getElementById('backup-unit');
    const optionsDiv = document.getElementById('auto-backup-options');

    enabledCheck.checked = backupSettings.enabled;
    valInput.value = backupSettings.intervalValue;
    unitSelect.value = backupSettings.intervalUnit;
    optionsDiv.style.opacity = backupSettings.enabled ? '1' : '0.5';
    optionsDiv.style.pointerEvents = backupSettings.enabled ? 'auto' : 'none';

    document.getElementById('btn-export-now').addEventListener('click', async () => {
        try {
            await browser.runtime.sendMessage({ action: MESSAGES.PERFORM_BACKUP });
        } catch (error) {
            console.warn("Background communication failed:", error);
            alert("Could not start backup. Please reload the extension.");
        }
    });

    const fileInput = document.getElementById('import-file');
    document.getElementById('btn-import-trigger').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const result = await backupManager.importBackupData(event.target.result);
                await loadAndRenderGroups();
                
                const status = document.getElementById('import-status');
                status.innerText = `Successfully imported ${result.count} groups!`;
                status.style.display = 'block';
                setTimeout(() => status.style.display = 'none', 3000);
            } catch (err) {
                alert("Error reading backup file: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    const saveConfig = async () => {
        const val = parseFloat(valInput.value);
        if (isNaN(val) || val <= 0) return;

        const isEnabled = enabledCheck.checked;
        optionsDiv.style.opacity = isEnabled ? '1' : '0.5';
        optionsDiv.style.pointerEvents = isEnabled ? 'auto' : 'none';

        await settingsManager.saveBackupConfig({
            enabled: isEnabled,
            intervalValue: val,
            intervalUnit: unitSelect.value
        });

        try {
            await browser.runtime.sendMessage({ action: MESSAGES.SCHEDULE_BACKUP });
        } catch (error) {
            console.warn("Background script not ready:", error);
        }
    };

    enabledCheck.addEventListener('change', saveConfig);
    valInput.addEventListener('change', saveConfig);
    unitSelect.addEventListener('change', saveConfig);
}

// --- HELPER FUNCTIONS ---
async function refreshSettingsUI() {
    const settings = await settingsManager.getSettings();
    updateDomainUI(settings);
}

function updateDomainUI(settings) {
    const desc = document.getElementById('mode-desc');
    const addInput = document.getElementById('add-input');
    
    if (settings.mode === MODES.BLACKLIST) {
        desc.innerText = "Sites in this list will NEVER be saved.";
        addInput.placeholder = "Block domain (e.g. google.com)";
    } else {
        desc.innerText = "ONLY sites in this list will be saved.";
        addInput.placeholder = "Allow domain (e.g. work.com)";
    }

    renderDomainList(settings);
}

function renderDomainList(settings, filterText = '') {
    const listContainer = document.getElementById('domain-list');
    listContainer.innerHTML = '';

    const list = settings.mode === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;
    const filtered = list.filter(domain => domain.toLowerCase().includes(filterText.toLowerCase()));

    if (filtered.length === 0) {
        UIRenderer.updateEmptyState(listContainer, `No ${settings.mode} domains found.`);
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(domain => {
        const item = UIRenderer.createDomainListItem(domain, async (d) => {
            await settingsManager.removeDomain(d, settings.mode);
            await refreshSettingsUI();
            
            const searchVal = document.getElementById('search-input').value;
            if(searchVal) {
                 const newSettings = await settingsManager.getSettings();
                 renderDomainList(newSettings, searchVal);
            }
        });
        fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
}

async function handleAddDomain() {
    const input = document.getElementById('add-input');
    const rawValue = input.value.trim();
    if (!rawValue) return;

    const settings = await settingsManager.getSettings();
    await settingsManager.addDomain(rawValue, settings.mode);
    
    input.value = '';
    await refreshSettingsUI();
}

function resetInputs() {
    document.getElementById('add-input').value = '';
    document.getElementById('search-input').value = '';
}