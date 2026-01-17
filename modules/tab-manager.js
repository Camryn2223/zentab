import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';

class TabManager {

    /**
     * Retrieves tabs matching the query, filters them based on settings,
     * and prepares them for saving/closing.
     * @param {Object} queryObj - browser.tabs.query object
     * @returns {Promise<{tabsToSave: Array, idsToClose: Array}>}
     */
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
     * Persist a list of tabs as a new group, or restore a deleted group object.
     * @param {Array|Object} tabsOrGroup - Array of tabs or a full group object (for undo).
     */
    async saveTabGroup(tabsOrGroup) {
        if (!tabsOrGroup) return;

        let groupData;

        // Restore Undo Case: tabsOrGroup is a full group object
        if (!Array.isArray(tabsOrGroup) && tabsOrGroup.id && tabsOrGroup.tabs) {
            groupData = tabsOrGroup;
        } else {
            // New Save Case
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

        // Feature: Auto-Deduplicate (only on new saves via array input)
        const settings = await settingsManager.getSettings();
        if (settings.general.autoDeduplicate && Array.isArray(tabsOrGroup)) {
            await this.removeDuplicates();
        }
        
        return groupData;
    }

    async deleteGroup(groupId) {
        const groups = await storageService.getGroups();
        const idToMatch = Number(groupId);
        
        const groupToDelete = groups.find(g => Number(g.id) === idToMatch);
        if (!groupToDelete) return null;
        
        const newGroups = groups.filter(g => Number(g.id) !== idToMatch);
        await storageService.updateGroups(newGroups);
        
        return groupToDelete; // Return for Undo capability
    }

    async removeTab(groupId, tabIndex) {
        const groups = await storageService.getGroups();
        const idToMatch = Number(groupId);
        const group = groups.find(g => Number(g.id) === idToMatch);

        if (group && group.tabs[tabIndex]) {
            group.tabs.splice(tabIndex, 1);
            
            // If group is empty and not pinned, delete it
            if (group.tabs.length === 0 && !group.pinned) {
                const newGroups = groups.filter(g => Number(g.id) !== idToMatch);
                await storageService.updateGroups(newGroups);
            } else {
                await storageService.updateGroups(groups);
            }
            return true;
        }
        return false;
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
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group) {
            group.customTitle = newTitle;
            await storageService.updateGroups(groups);
        }
    }

    async togglePin(groupId) {
        const groups = await storageService.getGroups();
        const group = groups.find(g => Number(g.id) === Number(groupId));

        if (group) {
            group.pinned = !group.pinned;
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

        // Sort to prioritize pinned groups
        const map = groups.map((g, i) => ({ index: i, pinned: g.pinned }));
        map.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return a.index - b.index;
        });

        for (const item of map) {
            const group = groups[item.index];
            const originalLen = group.tabs.length;
            
            group.tabs = group.tabs.filter(tab => {
                const normalized = tab.url.trim();
                if (seenUrls.has(normalized)) return false;
                seenUrls.add(normalized);
                return true;
            });

            removedCount += (originalLen - group.tabs.length);
        }

        const finalGroups = groups.filter(g => g.tabs.length > 0);
        await storageService.updateGroups(finalGroups);
        return removedCount;
    }

    // --- DRAG AND DROP LOGIC ---

    async moveGroup(fromId, toIndex) {
        const groups = await storageService.getGroups();
        const fromIndex = groups.findIndex(g => Number(g.id) === Number(fromId));
        
        if (fromIndex === -1) return;

        // Move item in array
        const [movedGroup] = groups.splice(fromIndex, 1);
        groups.splice(toIndex, 0, movedGroup);

        await storageService.updateGroups(groups);
    }

    async moveTab(fromGroupId, fromIndex, toGroupId, toIndex) {
        const groups = await storageService.getGroups();
        const sourceGroup = groups.find(g => Number(g.id) === Number(fromGroupId));
        const targetGroup = groups.find(g => Number(g.id) === Number(toGroupId));

        if (!sourceGroup || !targetGroup) return;
        if (!sourceGroup.tabs[fromIndex]) return;

        // Remove from source
        const [movedTab] = sourceGroup.tabs.splice(fromIndex, 1);

        // Add to target
        // If dropping into the same group, adjust index if needed because of the splice above
        // However, standard splice logic handles this if we are careful with indices.
        // If source === target and fromIndex < toIndex, the splice shifted subsequent items down.
        // We will rely on UI logic to provide the *intended* visual index, but usually
        // DnD logic needs to account for the removed item if same list.
        // For simplicity here, we assume toIndex is calculated based on the *current* state 
        // minus the moved item if strictly necessary, but actually standard insert:
        
        targetGroup.tabs.splice(toIndex, 0, movedTab);

        // Cleanup empty source group if not pinned and not same group
        if (sourceGroup.tabs.length === 0 && !sourceGroup.pinned && sourceGroup.id !== targetGroup.id) {
            const finalGroups = groups.filter(g => g.id !== sourceGroup.id);
            await storageService.updateGroups(finalGroups);
        } else {
            await storageService.updateGroups(groups);
        }
    }
}

export const tabManager = new TabManager();