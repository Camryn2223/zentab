import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';

class TabManager {

    async getTabsForAction(queryObj) {
        const tabs = await browser.tabs.query(queryObj);
        if (!tabs.length) return { tabsToSave: [], idsToClose: [] };

        const settings = await settingsManager.getSettings();
        const tabsToSave = [];
        const idsToClose = [];

        for (const tab of tabs) {
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
     * Persist a list of tabs.
     * @param {Array} tabsOrGroup - Either an array of tabs OR a full group object (for undo/restore).
     */
    async saveTabGroup(tabsOrGroup) {
        if (!tabsOrGroup) return;

        let groupData;

        // Check if we are restoring a full group object (Undo action)
        if (!Array.isArray(tabsOrGroup) && tabsOrGroup.id && tabsOrGroup.tabs) {
            groupData = tabsOrGroup;
        } else {
            // New Save
            if (tabsOrGroup.length === 0) return;
            groupData = {
                id: Date.now(),
                date: new Date().toLocaleString(),
                tabs: tabsOrGroup,
                pinned: false,
                customTitle: null
            };
        }

        await storageService.saveGroup(groupData);

        // Feature: Auto-Deduplicate (only on new saves, typically)
        const settings = await settingsManager.getSettings();
        if (settings.general.autoDeduplicate && Array.isArray(tabsOrGroup)) {
            await this.removeDuplicates();
        }
    }

    async deleteGroup(groupId) {
        const groups = await storageService.getGroups();
        const groupToDelete = groups.find(g => Number(g.id) === Number(groupId));
        
        const newGroups = groups.filter(g => Number(g.id) !== Number(groupId));
        await storageService.updateGroups(newGroups);
        
        return groupToDelete; // Return for Undo capability
    }

    async removeTab(groupId, tabIndex) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group && group.tabs[tabIndex]) {
            group.tabs.splice(tabIndex, 1);
            
            if (group.tabs.length === 0 && !group.pinned) {
                const newGroups = groups.filter(g => Number(g.id) !== Number(groupId));
                await storageService.updateGroups(newGroups);
            } else {
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