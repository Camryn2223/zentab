import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { storageService } from './modules/storage.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { MODES } from './modules/constants.js';
import { debounce } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    await Promise.all([initGroupList(), initSettingsPane()]);
});

// --- NAVIGATION ---

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => {
                s.style.display = 'none';
                s.classList.remove('active');
            });

            // Add active to current
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');
            }
        });
    });
}

// --- TAB GROUPS CONTROLLER (DASHBOARD) ---

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
    
    // Get Settings to know if we show favicons
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

// --- SETTINGS CONTROLLER ---

async function initSettingsPane() {
    const settings = await settingsManager.getSettings();
    
    // 1. Domain Filter Logic
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

    // 2. General Settings Logic
    const faviconCheckbox = document.getElementById('setting-favicons');
    faviconCheckbox.checked = settings.general.showFavicons;
    
    faviconCheckbox.addEventListener('change', async (e) => {
        await settingsManager.updateGeneralSetting('showFavicons', e.target.checked);
        // Re-render dashboard to reflect changes
        await renderGroups(); 
    });
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