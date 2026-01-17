import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { MODES, DEFAULTS } from './modules/constants.js';
import { debounce } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([initGroupList(), initSettingsPane()]);
});

// --- TAB GROUPS CONTROLLER ---

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
    
    const groups = await storageService.getGroups(); // Access via storage or manager

    if (groups.length === 0) {
        UIRenderer.updateEmptyState(container, 'No tabs saved yet.');
        return;
    }

    // Use fragment for better performance on large lists
    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
        const groupEl = UIRenderer.createTabGroupElement(
            group, 
            async (id) => { await tabManager.restoreGroup(id); await renderGroups(); },
            async (id) => { await tabManager.deleteGroup(id); await renderGroups(); }
        );
        fragment.appendChild(groupEl);
    });

    container.appendChild(fragment);
}

// --- SETTINGS CONTROLLER ---

async function initSettingsPane() {
    const settings = await settingsManager.getSettings();
    const select = document.getElementById('mode-select');
    
    // Initialize UI state
    select.value = settings.mode;
    updateSettingsUI(settings);

    // Event Listeners
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

async function refreshSettingsUI() {
    const settings = await settingsManager.getSettings();
    updateSettingsUI(settings);
}

function updateSettingsUI(settings) {
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
            // Preserve search if existing
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
    
    // Check duplication in current list
    const list = settings.mode === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;
    if (list.some(d => d.includes(rawValue))) { 
        // Simple client side check, the manager handles strict hostname duplication
        // but this alert helps user experience
    }

    await settingsManager.addDomain(rawValue, settings.mode);
    
    input.value = '';
    await refreshSettingsUI();
}

function resetInputs() {
    document.getElementById('add-input').value = '';
    document.getElementById('search-input').value = '';
}

// Need to import storageService just for the read in renderGroups if we don't want to add a getter to tabManager
import { storageService } from './modules/storage.js';