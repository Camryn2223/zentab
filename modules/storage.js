import { STORAGE_KEYS, DEFAULTS } from './constants.js';

class StorageService {
    constructor() {
        this.storage = browser.storage.local;
    }

    async get(keys) {
        return await this.storage.get(keys);
    }

    async set(data) {
        return await this.storage.set(data);
    }

    async getSettings() {
        const data = await this.get([
            STORAGE_KEYS.FILTER_MODE,
            STORAGE_KEYS.BLACKLIST,
            STORAGE_KEYS.WHITELIST,
            STORAGE_KEYS.GENERAL_SETTINGS
        ]);

        return {
            mode: data[STORAGE_KEYS.FILTER_MODE] || DEFAULTS.FILTER_MODE,
            blacklist: data[STORAGE_KEYS.BLACKLIST] || DEFAULTS.BLACKLIST,
            whitelist: data[STORAGE_KEYS.WHITELIST] || DEFAULTS.WHITELIST,
            general: { ...DEFAULTS.GENERAL_SETTINGS, ...data[STORAGE_KEYS.GENERAL_SETTINGS] }
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
    
    async updateGeneralSettings(newSettings) {
        // Merge with existing to prevent overwriting keys not passed in
        const current = await this.getSettings();
        const merged = { ...current.general, ...newSettings };
        await this.set({ [STORAGE_KEYS.GENERAL_SETTINGS]: merged });
    }
}

export const storageService = new StorageService();