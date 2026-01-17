import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';

class TabManager {
    
    /**
     * Query tabs, filter them, and return the result.
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
            // Check if domain is allowed
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
            tabs: tabs
        };

        await storageService.saveGroup(groupData);
    }

    async deleteGroup(groupId) {
        const groups = await storageService.getGroups();
        const newGroups = groups.filter(g => g.id !== groupId);
        await storageService.updateGroups(newGroups);
    }

    async restoreGroup(groupId) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        
        if (group && group.tabs) {
            for (const tab of group.tabs) {
                await browser.tabs.create({ url: tab.url, active: false });
            }
            await this.deleteGroup(groupId);
        }
    }

    async clearAll() {
        await storageService.updateGroups([]);
    }
}

export const tabManager = new TabManager();