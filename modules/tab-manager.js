import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';

class TabManager {

    /**
     * Query tabs, filter them using settings, and return the result.
     * @param {Object} queryObj - browser.tabs.query parameters
     * @returns {Promise<{tabsToSave: Array, idsToClose: Array}>}
     */
    async getTabsForAction(queryObj) {
        const tabs = await browser.tabs.query(queryObj);
        if (!tabs.length) return { tabsToSave: [], idsToClose: [] };

        const settings = await settingsManager.getSettings();
        const tabsToSave = [];
        const idsToClose = [];

        for (const tab of tabs) {
            // Business logic for filtering is delegated to SettingsManager
            const allowed = await settingsManager.shouldSaveUrl(tab.url, settings);

            if (allowed) {
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

    /**
     * Persist a list of tabs as a new group.
     * @param {Array} tabs
     */
    async saveTabGroup(tabs) {
        if (!tabs || tabs.length === 0) return;

        const groupData = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            tabs: tabs,
            pinned: false, // Feature #3: Default unpinned
            customTitle: null
        };

        await storageService.saveGroup(groupData);
    }

    async deleteGroup(groupId) {
        const groups = await storageService.getGroups();
        // Force numeric comparison if ID types differ
        const newGroups = groups.filter(g => Number(g.id) !== Number(groupId));
        await storageService.updateGroups(newGroups);
    }

    /**
     * Restore tabs to current window.
     * Logic: If pinned, keep the group. If not pinned, delete after restore.
     */
    async restoreGroup(groupId) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group && group.tabs) {
            for (const tab of group.tabs) {
                await browser.tabs.create({ url: tab.url, active: false });
            }
            
            // Only delete if NOT pinned
            if (!group.pinned) {
                await this.deleteGroup(groupId);
            }
        }
    }

    /**
     * Feature #4: Restore tabs to a new window.
     */
    async restoreGroupInNewWindow(groupId) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group && group.tabs && group.tabs.length > 0) {
            // Create window with the first tab
            const firstTab = group.tabs[0];
            const win = await browser.windows.create({ url: firstTab.url, focused: true });

            // Open remainder
            for (let i = 1; i < group.tabs.length; i++) {
                await browser.tabs.create({ windowId: win.id, url: group.tabs[i].url, active: false });
            }

            // Only delete if NOT pinned
            if (!group.pinned) {
                await this.deleteGroup(groupId);
            }
        }
    }

    /**
     * Renames a saved tab group
     */
    async renameGroup(groupId, newTitle) {
        const groups = await storageService.getGroups();
        const groupIndex = groups.findIndex(g => Number(g.id) === Number(groupId));

        if (groupIndex !== -1) {
            groups[groupIndex].customTitle = newTitle;
            await storageService.updateGroups(groups);
        }
    }

    /**
     * Feature #3: Toggle Pin Status
     */
    async togglePin(groupId) {
        const groups = await storageService.getGroups();
        const groupIndex = groups.findIndex(g => Number(g.id) === Number(groupId));

        if (groupIndex !== -1) {
            // Toggle boolean
            groups[groupIndex].pinned = !groups[groupIndex].pinned;
            await storageService.updateGroups(groups);
        }
    }

    async clearAll() {
        // Feature #3 refinement: Clear All should usually respect pins, 
        // but "Delete Everything" usually implies a wipe. 
        // For safety, we will ONLY delete unpinned groups.
        const groups = await storageService.getGroups();
        const pinnedGroups = groups.filter(g => g.pinned);
        await storageService.updateGroups(pinnedGroups);
        
        return pinnedGroups.length; // Return remaining count
    }
}

export const tabManager = new TabManager();