import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { backupManager } from './modules/backup-manager.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { store } from './modules/store.js';
import { DragManager } from './modules/drag-manager.js'; 
import { MODES, MESSAGES } from './modules/constants.js';
import { debounce } from './modules/utils.js';

class OptionsController {
    constructor() {
        // Local state only for volatile interactions (undo references)
        this.lastDeletedGroup = null;
        this.dragManager = new DragManager();
    }

    async init() {
        this.setupNavigation();
        this.setupDelegatedListeners();
        this.setupGlobalInputs();
        this.setupSettingsListeners();
        this.setupBackupListeners();
        
        // Initialize Store and subscribe UI
        store.subscribe((state) => this.render(state));
        await store.init();

        // Initialize Drag and Drop
        const container = document.getElementById('container');
        this.dragManager.init(container);

        // Handle Deep Linking
        if (window.location.hash === '#view-settings') {
            this.navigateTo('view-settings');
        }
    }

    /**
     * Core Render Loop: Reacts to Store Changes
     */
    render(state) {
        if (state.loading) return; 

        // 1. Dashboard Render
        const container = document.getElementById('container');
        const groupsToRender = store.getFilteredGroups();
        UIRenderer.renderDashboard(container, groupsToRender, state.settings);

        // 2. Settings Render (Sync UI with State)
        this.updateSettingsUI(state.settings);
    }

    // --- EVENT DELEGATION ---

    setupDelegatedListeners() {
        const container = document.getElementById('container');

        // Central Click Handler for Dashboard
        container.addEventListener('click', async (e) => {
            // Find closest element with a data-action attribute
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const id = Number(target.dataset.id); // Group ID
            
            // Allow default for inputs so they can be focused, but prevent for links/buttons
            if (target.tagName !== 'INPUT') {
                e.preventDefault(); 
            }

            switch (action) {
                case 'pin':
                    await store.togglePin(id);
                    break;

                case 'restore':
                    await tabManager.restoreGroup(id);
                    await store.refreshGroups();
                    break;

                case 'restore-win':
                    await tabManager.restoreGroupInNewWindow(id);
                    await store.refreshGroups();
                    break;

                case 'delete':
                    this.lastDeletedGroup = await store.deleteGroup(id);
                    UIRenderer.showToast("Group deleted", "Undo", async () => {
                        if (this.lastDeletedGroup) {
                            await store.restoreGroup(this.lastDeletedGroup);
                            this.lastDeletedGroup = null;
                        }
                    });
                    break;

                case 'open-tab':
                    // If we are dragging, do not open
                    if (target.classList.contains('dragging')) return;

                    const url = target.dataset.url;
                    const index = Number(target.dataset.index);
                    
                    // Determine if we should focus the new tab based on settings
                    const shouldFocus = store.state.settings.general.focusOnOpen;
                    await browser.tabs.create({ url, active: shouldFocus });
                    
                    if (store.state.settings.general.consumeOnOpen) {
                        await store.removeTab(id, index);
                    }
                    break;
            }
        });

        // Event delegation for Group Renaming (Blur/Enter)
        container.addEventListener('focusout', async (e) => {
            if (e.target.dataset.action === 'rename') {
                const id = Number(e.target.dataset.id);
                const newTitle = e.target.value;
                const originalTitle = store.state.groups.find(g => g.id === id)?.customTitle;
                
                if (newTitle !== originalTitle) {
                    await store.updateGroupTitle(id, newTitle);
                }
            }
        });

        container.addEventListener('keypress', (e) => {
            if (e.target.dataset.action === 'rename' && e.key === 'Enter') {
                e.target.blur(); // Triggers focusout above
            }
        });
    }

    // --- OTHER LISTENERS ---

    setupGlobalInputs() {
        // Search
        document.getElementById('dashboard-search').addEventListener('input', debounce((e) => {
            store.setFilter(e.target.value);
        }, 300));

        // Global Actions
        document.getElementById('clear-all').addEventListener('click', async () => {
            const hasUnpinned = store.state.groups.some(g => !g.pinned);
            if (hasUnpinned && confirm("Delete all UNPINNED groups?")) {
                const remaining = await tabManager.clearAll();
                await store.refreshGroups();
                UIRenderer.showToast(remaining > 0 ? `Cleared history. Kept ${remaining} pinned.` : "History cleared.");
            }
        });

        document.getElementById('btn-dedupe').addEventListener('click', async () => {
            if (confirm("Remove duplicate tabs? Pinned groups are protected.")) {
                const count = await tabManager.removeDuplicates();
                await store.refreshGroups();
                UIRenderer.showToast(`Cleanup complete! Removed ${count} duplicates.`);
            }
        });
    }

    // --- SETTINGS LOGIC ---

    updateSettingsUI(settings) {
        // Sync Toggles
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };

        setCheck('setting-favicons', settings.general.showFavicons);
        setCheck('setting-focus', settings.general.focusOnOpen); // NEW
        setCheck('setting-consume', settings.general.consumeOnOpen);
        setCheck('setting-dedupe', settings.general.autoDeduplicate);
        
        // Sync Inputs
        document.getElementById('mode-select').value = settings.mode;
        
        // Backup UI
        const b = settings.backup;
        setCheck('backup-enabled', b.enabled);
        document.getElementById('backup-val').value = b.intervalValue;
        document.getElementById('backup-unit').value = b.intervalUnit;

        const optionsDiv = document.getElementById('auto-backup-options');
        if (optionsDiv) {
            optionsDiv.style.opacity = b.enabled ? '1' : '0.5';
            optionsDiv.style.pointerEvents = b.enabled ? 'auto' : 'none';
        }

        // Render Domains List
        this.renderDomainList(settings);
    }

    renderDomainList(settings) {
        const filterText = document.getElementById('search-input').value.toLowerCase();
        const listContainer = document.getElementById('domain-list');
        listContainer.innerHTML = '';

        const isBlacklist = settings.mode === MODES.BLACKLIST;
        const list = isBlacklist ? settings.blacklist : settings.whitelist;
        const filtered = list.filter(d => d.toLowerCase().includes(filterText));

        // Setup DOM
        const fragment = document.createDocumentFragment();
        if (filtered.length === 0) {
            UIRenderer.updateEmptyState(listContainer, `No ${settings.mode} domains found.`);
        } else {
            filtered.forEach(domain => {
                const item = UIRenderer.createDomainListItem(domain, settings.mode);
                fragment.appendChild(item);
            });
        }
        listContainer.appendChild(fragment);

        // Describe Text
        const desc = document.getElementById('mode-desc');
        const addInput = document.getElementById('add-input');
        
        desc.innerText = isBlacklist 
            ? "Sites in this list will NEVER be saved." 
            : "ONLY sites in this list will be saved.";
        addInput.placeholder = isBlacklist 
            ? "Block domain (e.g. google.com)" 
            : "Allow domain (e.g. work.com)";
    }

    setupSettingsListeners() {
        // 1. Toggles
        const bindToggle = (id, key) => {
            document.getElementById(id).addEventListener('change', async (e) => {
                await settingsManager.updateGeneralSetting(key, e.target.checked);
                await store.refreshSettings(); // Triggers render
            });
        };
        bindToggle('setting-favicons', 'showFavicons');
        bindToggle('setting-focus', 'focusOnOpen'); // NEW
        bindToggle('setting-consume', 'consumeOnOpen');
        bindToggle('setting-dedupe', 'autoDeduplicate');

        // 2. Mode & Filters
        document.getElementById('mode-select').addEventListener('change', async (e) => {
            await settingsManager.setMode(e.target.value);
            await store.refreshSettings();
        });

        // Filter list delegation
        document.getElementById('domain-list').addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action="remove-domain"]');
            if (target) {
                await settingsManager.removeDomain(target.dataset.domain, target.dataset.mode);
                await store.refreshSettings();
            }
        });

        const handleAdd = async () => {
            const input = document.getElementById('add-input');
            const val = input.value.trim();
            if (!val) return;
            
            await settingsManager.addDomain(val, store.state.settings.mode);
            input.value = '';
            await store.refreshSettings();
        };

        document.getElementById('add-btn').addEventListener('click', handleAdd);
        document.getElementById('add-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAdd();
        });
        
        document.getElementById('search-input').addEventListener('input', debounce(() => {
            // Trigger local re-render of just the list, or full refresh
            this.renderDomainList(store.state.settings);
        }, 300));
    }

    setupBackupListeners() {
        // Export
        document.getElementById('btn-export-now').addEventListener('click', async () => {
            try {
                await browser.runtime.sendMessage({ action: MESSAGES.PERFORM_BACKUP });
            } catch (e) { alert("Backup failed. Extension context invalidated?"); }
        });

        // Import
        const fileInput = document.getElementById('import-file');
        document.getElementById('btn-import-trigger').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const res = await backupManager.importBackupData(ev.target.result);
                    await store.init(); // Full reload
                    alert(`Imported ${res.count} groups.`);
                } catch (err) { alert("Invalid backup file."); }
            };
            reader.readAsText(file);
        });

        // Save Config
        const saveConfig = async () => {
            await settingsManager.saveBackupConfig({
                enabled: document.getElementById('backup-enabled').checked,
                intervalValue: parseFloat(document.getElementById('backup-val').value) || 1,
                intervalUnit: document.getElementById('backup-unit').value
            });
            await store.refreshSettings();
            browser.runtime.sendMessage({ action: MESSAGES.SCHEDULE_BACKUP }).catch(() => {});
        };

        ['backup-enabled', 'backup-val', 'backup-unit'].forEach(id => {
            document.getElementById(id).addEventListener('change', saveConfig);
        });

        // OneTab Compatibility
        const area = document.getElementById('onetab-io');
        document.getElementById('btn-onetab-import').addEventListener('click', async () => {
            const tabs = backupManager.parseOneTabImport(area.value);
            if (tabs.length > 0) {
                await tabManager.saveTabGroup(tabs);
                await store.refreshGroups();
                area.value = '';
                document.getElementById('onetab-status').innerText = `Imported ${tabs.length} links!`;
            }
        });

        document.getElementById('btn-onetab-export').addEventListener('click', async () => {
            area.value = await backupManager.generateOneTabExport();
        });
    }

    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => this.navigateTo(btn.dataset.target));
        });
    }

    navigateTo(targetId) {
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.target === targetId);
        });
        document.querySelectorAll('.view-section').forEach(s => {
            s.style.display = s.id === targetId ? 'block' : 'none';
        });
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    new OptionsController().init();
});