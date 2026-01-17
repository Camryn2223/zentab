import { storageService } from './modules/storage.js';
import { FilterService } from './modules/filters.js';
import { getHostname } from './modules/utils.js';
import { MODES } from './modules/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    await renderGroups();
    await initSettings();
});

// --- SETTINGS LOGIC ---

async function initSettings() {
    const settings = await storageService.getSettings();
    const select = document.getElementById('mode-select');
    
    select.value = settings.mode;
    updateDescription(settings.mode);
    renderDomainList(settings);

    // Mode Switch
    select.addEventListener('change', async (e) => {
        const newMode = e.target.value;
        await storageService.setMode(newMode);
        
        // Reset Inputs
        document.getElementById('add-input').value = '';
        document.getElementById('search-input').value = '';
        
        const newSettings = await storageService.getSettings();
        updateDescription(newSettings.mode);
        renderDomainList(newSettings);
    });

    // Add Domain
    document.getElementById('add-btn').addEventListener('click', addDomain);
    document.getElementById('add-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDomain();
    });

    // Search
    document.getElementById('search-input').addEventListener('input', async (e) => {
        const currentSettings = await storageService.getSettings();
        renderDomainList(currentSettings, e.target.value);
    });
}

function updateDescription(mode) {
    const desc = document.getElementById('mode-desc');
    const addInput = document.getElementById('add-input');
    
    if (mode === MODES.BLACKLIST) {
        desc.innerText = "Sites in this list will NEVER be saved.";
        addInput.placeholder = "Block domain (e.g. google.com)";
    } else {
        desc.innerText = "ONLY sites in this list will be saved.";
        addInput.placeholder = "Allow domain (e.g. work.com)";
    }
}

async function addDomain() {
    const input = document.getElementById('add-input');
    const rawValue = input.value.trim();
    if (!rawValue) return;

    // Use utils to get clean hostname, fallback to raw input if fails (e.g. wildcard)
    const hostname = getHostname(rawValue) || getHostname(`http://${rawValue}`) || rawValue;

    const settings = await storageService.getSettings();
    
    // Check if already exists in the ACTIVE list
    const activeList = settings.mode === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;
    
    if (activeList.includes(hostname)) {
        alert(`Domain already in ${settings.mode}!`);
        return;
    }

    // Use FilterService to toggle (add) it
    await FilterService.toggleDomain(hostname, settings, storageService);
    
    input.value = '';
    const newSettings = await storageService.getSettings();
    renderDomainList(newSettings);
}

function renderDomainList(settings, filterText = '') {
    const listContainer = document.getElementById('domain-list');
    listContainer.innerHTML = '';

    const list = settings.mode === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;

    const filtered = list.filter(domain => 
        domain.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-msg">No ${settings.mode} domains found.</div>`;
        return;
    }

    filtered.forEach(domain => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const text = document.createElement('span');
        text.innerText = domain;
        text.style.wordBreak = 'break-all';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove-domain';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = "Remove";
        
        removeBtn.onclick = async () => {
            // Re-fetch settings to ensure freshness
            const currentSettings = await storageService.getSettings();
            await FilterService.toggleDomain(domain, currentSettings, storageService);
            
            // Re-render
            const updatedSettings = await storageService.getSettings();
            const currentSearch = document.getElementById('search-input').value;
            renderDomainList(updatedSettings, currentSearch);
        };

        item.appendChild(text);
        item.appendChild(removeBtn);
        listContainer.appendChild(item);
    });
}

// --- GROUP LIST LOGIC ---

document.getElementById('clear-all').addEventListener('click', async () => {
    if(confirm("Delete all saved history?")) {
        await storageService.clearAllGroups();
        await renderGroups();
    }
});

async function renderGroups() {
    const container = document.getElementById('container');
    container.innerHTML = '';
    
    const groups = await storageService.getGroups();

    if (groups.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#6c7086; margin-top:50px;">No tabs saved yet.</div>';
        return;
    }

    groups.forEach(group => {
        container.appendChild(createGroupElement(group));
    });
}

function createGroupElement(group) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
        <span class="date">${group.tabs.length} Tabs - ${group.date}</span>
        <div><button class="btn-restore">Restore All</button><button class="btn-delete">Delete</button></div>
    `;
    
    // Wire up header buttons
    header.querySelector('.btn-restore').onclick = async () => {
        for (const tab of group.tabs) { 
            await browser.tabs.create({ url: tab.url, active: false }); 
        }
        await storageService.deleteGroup(group.id);
        renderGroups();
    };

    header.querySelector('.btn-delete').onclick = async () => {
        await storageService.deleteGroup(group.id);
        renderGroups();
    };

    groupDiv.appendChild(header);

    // Render Tabs
    group.tabs.forEach(tab => {
        const link = document.createElement('a');
        link.className = 'tab-link';
        link.href = tab.url;
        link.onclick = (e) => { 
            e.preventDefault(); 
            browser.tabs.create({ url: tab.url, active: false }); 
        };
        
        const iconSrc = tab.favIconUrl || '';
        const iconDisplay = iconSrc 
            ? `<img src="${iconSrc}" class="favicon" onerror="this.style.display='none'">` 
            : `<div class="favicon" style="background:#ccc"></div>`;

        link.innerHTML = `${iconDisplay} <span>${tab.title || tab.url}</span>`;
        groupDiv.appendChild(link);
    });

    return groupDiv;
}