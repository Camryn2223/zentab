import { STORAGE_KEYS, DEFAULTS } from './constants.js';

class StorageService {
    constructor() {
        this.storage = browser.storage.local;
    }

    /**
     * Generic getter for storage keys.
     * @param {string|string[]} keys 
     * @returns {Promise<Object>}
     */
    async get(keys) {
        return await this.storage.get(keys);
    }

    /**
     * Generic setter for storage.
     * @param {Object} data 
     * @returns {Promise<void>}
     */
    async set(data) {
        return await this.storage.set(data);
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

    async saveGroup(groupData) {
        const groups = await this.getGroups();
        groups.unshift(groupData);
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: groups });
    }

    async updateGroups(newGroupsList) {
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: newGroupsList });
    }
}

export const storageService = new StorageService();