import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { storageService } from './modules/storage.js';
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
            const targetId = btn.dataset.target;
            navigateTo(targetId);
        });
    });
}

function navigateTo(targetId) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(b => {
        b.classList.remove('active');
        if (b.dataset.target === targetId) b.classList.add('active');
    });

    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
        if (s.id === targetId) {
            s.style.display = 'block';
            s.classList.add('active');
        }
    });
}

// --- DASHBOARD ---

async function initGroupList() {
    await renderGroups();

    document.getElementById('clear-all').addEventListener('click', async () => {
        if(confirm("Delete all saved history? This cannot be undone.")) {
            await tabManager.clearAll();
            await renderGroups();
        }
    });
}

async function renderGroups() {
    const container = document.getElementById('container');
    container.innerHTML = '';
    
    const settings = await settingsManager.getSettings();
    const groups = await storageService.getGroups();

    if (groups.length === 0) {
        UIRenderer.updateEmptyState(container, 'No tabs saved yet.');
        return;
    }

    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
        const groupEl = UIRenderer.createTabGroupElement(
            group, 
            async (id) => { await tabManager.restoreGroup(id); await renderGroups(); },
            async (id) => { await tabManager.deleteGroup(id); await renderGroups(); },
            { showFavicons: settings.general.showFavicons }
        );
        fragment.appendChild(groupEl);
    });

    container.appendChild(fragment);
}

// --- SETTINGS ---

async function initSettingsPane() {
    const settings = await settingsManager.getSettings();
    
    // 1. Domain Filter
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

    // 2. General Settings
    const faviconCheckbox = document.getElementById('setting-favicons');
    faviconCheckbox.checked = settings.general.showFavicons;
    
    faviconCheckbox.addEventListener('change', async (e) => {
        await settingsManager.updateGeneralSetting('showFavicons', e.target.checked);
        await renderGroups(); 
    });

    // 3. Backup Settings
    initBackupUI(settings.backup);
    
    // 4. OneTab Import/Export Logic
    initOneTabUI();
}

function initOneTabUI() {
    const textarea = document.getElementById('onetab-io');
    const status = document.getElementById('onetab-status');

    // IMPORT
    document.getElementById('btn-onetab-import').addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) {
            status.innerText = "Please paste URLs first.";
            return;
        }

        const lines = text.split('\n');
        const tabs = [];

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            // OneTab format: https://url.com | Title
            const parts = line.split('|');
            const url = parts[0].trim();
            const title = parts[1] ? parts[1].trim() : url;

            if (url) {
                tabs.push({
                    url: url,
                    title: title,
                    favIconUrl: '' // Icons lost in plain text import
                });
            }
        });

        if (tabs.length > 0) {
            await tabManager.saveTabGroup(tabs);
            await renderGroups();
            textarea.value = '';
            status.innerText = `Successfully imported ${tabs.length} links into a new group!`;
            status.style.color = "var(--accent-green)";
        } else {
            status.innerText = "No valid URLs found.";
            status.style.color = "var(--accent-red)";
        }
    });

    // EXPORT
    document.getElementById('btn-onetab-export').addEventListener('click', async () => {
        const groups = await storageService.getGroups();
        let exportText = "";

        groups.forEach(group => {
            group.tabs.forEach(tab => {
                // OneTab format: URL | Title
                exportText += `${tab.url} | ${tab.title}\n`;
            });
            exportText += '\n'; // Extra spacing between groups
        });

        textarea.value = exportText.trim();
        status.innerText = "Export list generated. Copy text above.";
        status.style.color = "var(--text-primary)";
    });
}

function initBackupUI(backupSettings) {
    const enabledCheck = document.getElementById('backup-enabled');
    const valInput = document.getElementById('backup-val');
    const unitSelect = document.getElementById('backup-unit');
    const optionsDiv = document.getElementById('auto-backup-options');

    // Initial State
    enabledCheck.checked = backupSettings.enabled;
    valInput.value = backupSettings.intervalValue;
    unitSelect.value = backupSettings.intervalUnit;
    optionsDiv.style.opacity = backupSettings.enabled ? '1' : '0.5';
    optionsDiv.style.pointerEvents = backupSettings.enabled ? 'auto' : 'none';

    // 1. Manual Export (Native JSON)
    document.getElementById('btn-export-now').addEventListener('click', async () => {
        try {
            await browser.runtime.sendMessage({ action: MESSAGES.PERFORM_BACKUP });
        } catch (error) {
            console.warn("Communication with background script failed:", error);
            alert("Could not start backup. Please reload the extension from about:debugging.");
        }
    });

    // 2. Manual Import (Native JSON)
    const fileInput = document.getElementById('import-file');
    document.getElementById('btn-import-trigger').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.groups && Array.isArray(data.groups)) {
                    await storageService.importData(data);
                    await renderGroups();
                    
                    const status = document.getElementById('import-status');
                    status.innerText = "Successfully imported " + data.groups.length + " groups!";
                    status.style.display = 'block';
                    setTimeout(() => status.style.display = 'none', 3000);
                } else {
                    alert("Invalid backup file format.");
                }
            } catch (err) {
                alert("Error reading file: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // 3. Auto Backup Configuration
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

        // Update Alarm
        try {
            await browser.runtime.sendMessage({ action: MESSAGES.SCHEDULE_BACKUP });
        } catch (error) {
            console.warn("Background script not ready to schedule alarm:", error);
        }
    };

    enabledCheck.addEventListener('change', saveConfig);
    valInput.addEventListener('change', saveConfig);
    unitSelect.addEventListener('change', saveConfig);
}

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