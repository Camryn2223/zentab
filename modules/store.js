import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';
import { tabManager } from './tab-manager.js';

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
        return this.state.groups.filter(group => {
            const titleMatch = (group.customTitle || '').toLowerCase().includes(term);
            const tabMatch = group.tabs.some(tab =>
                tab.title.toLowerCase().includes(term) ||
                tab.url.toLowerCase().includes(term)
            );
            return titleMatch || tabMatch;
        });
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
        await this.refreshGroups();
    }

    async updateGroupTitle(id, newTitle) {
        await tabManager.renameGroup(id, newTitle);
        const group = this.state.groups.find(g => g.id === Number(id));
        if (group) group.customTitle = newTitle;
    }

    async togglePin(id) {
        await tabManager.togglePin(id);
        await this.refreshGroups();
    }

    async removeTab(groupId, tabIndex) {
        await tabManager.removeTab(groupId, tabIndex);
        
        // Optimistic update
        const group = this.state.groups.find(g => g.id === Number(groupId));
        if (group) {
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