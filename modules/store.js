import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';
import { tabManager } from './tab-manager.js';
import { STORAGE_KEYS } from './constants.js';

/**
 * Centralized State Management (Observer Pattern).
 * Acts as the Single Source of Truth for the Options UI.
 */
class Store extends EventTarget {
    constructor() {
        super();
        this.state = {
            groups: [],
            settings: null,
            filter: '', // Search filter
            loading: true
        };

        // Reactive: Listen for storage changes from background script or other contexts
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                this.handleStorageChange(changes);
            }
        });
    }

    /**
     * Reacts to storage changes to keep UI in sync across windows/background
     * @param {Object} changes 
     */
    handleStorageChange(changes) {
        // 1. Refresh Groups if changed
        if (changes[STORAGE_KEYS.TAB_GROUPS]) {
            this.refreshGroups();
        }

        // 2. Refresh Settings if any setting key changed
        // This includes LAST_BACKUP, which fixes the UI update issue
        const settingKeys = [
            STORAGE_KEYS.FILTER_MODE,
            STORAGE_KEYS.BLACKLIST,
            STORAGE_KEYS.WHITELIST,
            STORAGE_KEYS.GENERAL_SETTINGS,
            STORAGE_KEYS.BACKUP_SETTINGS,
            STORAGE_KEYS.LAST_BACKUP
        ];

        if (settingKeys.some(key => changes[key])) {
            this.refreshSettings();
        }
    }

    /**
     * Initialize data from storage
     */
    async init() {
        this.state.loading = true;
        this._notify();

        const [groups, settings] = await Promise.all([
            storageService.getGroups(),
            settingsManager.getSettings()
        ]);

        // We respect the order stored in the database to allow Manual Sorting.
        this.state.groups = groups; 
        this.state.settings = settings;
        this.state.loading = false;
        this._notify();
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback 
     */
    subscribe(callback) {
        this.addEventListener('state-change', () => callback(this.state));
    }

    _notify() {
        this.dispatchEvent(new CustomEvent('state-change'));
    }

    // --- ACTIONS ---

    setFilter(term) {
        this.state.filter = term;
        this._notify();
    }

    getFilteredGroups() {
        if (!this.state.filter) return this.state.groups;
        
        const term = this.state.filter.toLowerCase();
        
        return this.state.groups
            .map(group => {
                // 1. If Group Title matches, return the whole group (showing context)
                // We return the original object so UIRenderer uses standard indices
                if ((group.customTitle || '').toLowerCase().includes(term)) {
                    return group;
                }

                // 2. If Group Title does NOT match, search specific tabs
                // We must attach the original index to ensure actions (delete/open) target the correct tab
                const matchingTabs = group.tabs
                    .map((tab, index) => ({ ...tab, originalIndex: index })) 
                    .filter(tab => 
                        (tab.title || '').toLowerCase().includes(term) ||
                        (tab.url || '').toLowerCase().includes(term)
                    );

                // If we have matching tabs, return a NEW group object with just those tabs
                if (matchingTabs.length > 0) {
                    return {
                        ...group,
                        tabs: matchingTabs
                    };
                }

                return null;
            })
            .filter(group => group !== null);
    }

    async refreshGroups() {
        // We do not re-sort here, trusting the backend order (TabManager updates)
        const groups = await storageService.getGroups();
        this.state.groups = groups;
        this._notify();
    }

    async refreshSettings() {
        this.state.settings = await settingsManager.getSettings();
        this._notify();
    }

    // --- LOGIC WRAPPERS ---

    async deleteGroup(id) {
        const deleted = await tabManager.deleteGroup(id);
        if (deleted) {
            this.state.groups = this.state.groups.filter(g => g.id !== id);
            this._notify();
        }
        return deleted; // Return for Undo
    }

    async restoreGroup(deletedGroup) {
        if (!deletedGroup) return;
        await tabManager.saveTabGroup(deletedGroup);
        // refreshGroups handled by storage listener, but calling it here ensures quick feedback
        await this.refreshGroups();
    }

    async updateGroupTitle(id, newTitle) {
        await tabManager.renameGroup(id, newTitle);
        const group = this.state.groups.find(g => g.id === Number(id));
        if (group) group.customTitle = newTitle;
    }

    async togglePin(id) {
        await tabManager.togglePin(id);
        // refreshGroups handled by storage listener
    }

    async removeTab(groupId, tabIndex) {
        await tabManager.removeTab(groupId, tabIndex);
        
        // Optimistic update
        const group = this.state.groups.find(g => g.id === Number(groupId));
        if (group) {
            // Note: If we are in a filtered view, tabIndex passed here MUST be the original index.
            // The UIRenderer handles passing the correct index via dataset.
            group.tabs.splice(tabIndex, 1);
            if (group.tabs.length === 0 && !group.pinned) {
                this.state.groups = this.state.groups.filter(g => g.id !== Number(groupId));
            }
        }
        this._notify();
    }

    async moveGroup(fromId, toIndex) {
        await tabManager.moveGroup(fromId, toIndex);
        await this.refreshGroups();
    }

    async moveTab(fromGroupId, fromIndex, toGroupId, toIndex) {
        await tabManager.moveTab(fromGroupId, fromIndex, toGroupId, toIndex);
        await this.refreshGroups();
    }
}

export const store = new Store();