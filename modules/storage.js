import { STORAGE_KEYS, DEFAULTS } from './constants.js';

class StorageService {
    async get(keys) {
        return await browser.storage.local.get(keys);
    }

    async set(data) {
        return await browser.storage.local.set(data);
    }

    async getSettings() {
        const data = await this.get([
            STORAGE_KEYS.FILTER_MODE,
            STORAGE_KEYS.BLACKLIST,
            STORAGE_KEYS.WHITELIST
        ]);

        return {
            mode: data[STORAGE_KEYS.FILTER_MODE] || DEFAULTS.FILTER_MODE,
            blacklist: data[STORAGE_KEYS.BLACKLIST] || DEFAULTS.BLACKLIST,
            whitelist: data[STORAGE_KEYS.WHITELIST] || DEFAULTS.WHITELIST
        };
    }

    async getGroups() {
        const data = await this.get(STORAGE_KEYS.TAB_GROUPS);
        return data[STORAGE_KEYS.TAB_GROUPS] || DEFAULTS.TAB_GROUPS;
    }

    async saveGroup(tabs) {
        const groups = await this.getGroups();
        
        const newGroup = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            tabs: tabs
        };

        groups.unshift(newGroup);
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: groups });
    }

    async updateDomainList(listName, list) {
        await this.set({ [listName]: list });
    }

    async setMode(mode) {
        await this.set({ [STORAGE_KEYS.FILTER_MODE]: mode });
    }

    async deleteGroup(id) {
        const groups = await this.getGroups();
        const newGroups = groups.filter(g => g.id !== id);
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: newGroups });
    }

    async clearAllGroups() {
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: [] });
    }
}

export const storageService = new StorageService();