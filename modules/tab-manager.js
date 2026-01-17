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
            pinned: false,
            customTitle: null
        };

        await storageService.saveGroup(groupData);

        // Feature: Auto-Deduplicate
        const settings = await settingsManager.getSettings();
        if (settings.general.autoDeduplicate) {
            await this.removeDuplicates();
        }
    }

    async deleteGroup(groupId) {
        const groups = await storageService.getGroups();
        // Force numeric comparison if ID types differ
        const newGroups = groups.filter(g => Number(g.id) !== Number(groupId));
        await storageService.updateGroups(newGroups);
    }

    /**
     * Remove a single tab from a group.
     * If group becomes empty and is not pinned, delete the group.
     */
    async removeTab(groupId, tabIndex) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group && group.tabs[tabIndex]) {
            group.tabs.splice(tabIndex, 1);
            
            // Check if group is empty
            if (group.tabs.length === 0 && !group.pinned) {
                // Remove the group entirely
                const newGroups = groups.filter(g => Number(g.id) !== Number(groupId));
                await storageService.updateGroups(newGroups);
            } else {
                // Just save the modified group
                await storageService.updateGroups(groups);
            }
        }
    }

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

    async restoreGroupInNewWindow(groupId) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group && group.tabs && group.tabs.length > 0) {
            const firstTab = group.tabs[0];
            const win = await browser.windows.create({ url: firstTab.url, focused: true });

            for (let i = 1; i < group.tabs.length; i++) {
                await browser.tabs.create({ windowId: win.id, url: group.tabs[i].url, active: false });
            }

            if (!group.pinned) {
                await this.deleteGroup(groupId);
            }
        }
    }

    async renameGroup(groupId, newTitle) {
        const groups = await storageService.getGroups();
        const groupIndex = groups.findIndex(g => Number(g.id) === Number(groupId));

        if (groupIndex !== -1) {
            groups[groupIndex].customTitle = newTitle;
            await storageService.updateGroups(groups);
        }
    }

    async togglePin(groupId) {
        const groups = await storageService.getGroups();
        const groupIndex = groups.findIndex(g => Number(g.id) === Number(groupId));

        if (groupIndex !== -1) {
            groups[groupIndex].pinned = !groups[groupIndex].pinned;
            await storageService.updateGroups(groups);
        }
    }

    async clearAll() {
        const groups = await storageService.getGroups();
        const pinnedGroups = groups.filter(g => g.pinned);
        await storageService.updateGroups(pinnedGroups);
        
        return pinnedGroups.length; 
    }

    async removeDuplicates() {
        const groups = await storageService.getGroups();
        const seenUrls = new Set();
        let removedCount = 0;

        // Order logic: Pinned first, then Original Order (Newest first)
        const orderedIndices = groups.map((g, index) => ({ index, pinned: g.pinned, id: g.id }))
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return a.index - b.index;
            });
        
        for (const item of orderedIndices) {
            const group = groups[item.index];
            const originalLength = group.tabs.length;
            
            group.tabs = group.tabs.filter(tab => {
                const normalizedUrl = tab.url.trim();
                if (seenUrls.has(normalizedUrl)) {
                    return false;
                } else {
                    seenUrls.add(normalizedUrl);
                    return true;
                }
            });

            removedCount += (originalLength - group.tabs.length);
        }

        const cleanedGroups = groups.filter(g => g.tabs.length > 0);
        await storageService.updateGroups(cleanedGroups);
        return removedCount;
    }
}

export const tabManager = new TabManager();