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
            STORAGE_KEYS.GENERAL_SETTINGS,
            STORAGE_KEYS.BACKUP_SETTINGS,
            STORAGE_KEYS.LAST_BACKUP
        ]);

        return {
            mode: data[STORAGE_KEYS.FILTER_MODE] || DEFAULTS.FILTER_MODE,
            blacklist: data[STORAGE_KEYS.BLACKLIST] || DEFAULTS.BLACKLIST,
            whitelist: data[STORAGE_KEYS.WHITELIST] || DEFAULTS.WHITELIST,
            general: { ...DEFAULTS.GENERAL_SETTINGS, ...data[STORAGE_KEYS.GENERAL_SETTINGS] },
            backup: { ...DEFAULTS.BACKUP_SETTINGS, ...data[STORAGE_KEYS.BACKUP_SETTINGS] },
            lastBackup: data[STORAGE_KEYS.LAST_BACKUP] || DEFAULTS.LAST_BACKUP
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

    /**
     * Imports data into storage.
     * @param {Object} data Parsed backup data
     */
    async importData(data) {
        // 1. Merge Groups (avoid ID collisions)
        const currentGroups = await this.getGroups();
        const existingIds = new Set(currentGroups.map(g => g.id));
        
        const newGroups = (data.groups || []).filter(g => !existingIds.has(g.id));
        const combinedGroups = [...newGroups, ...currentGroups];
        
        await this.set({ [STORAGE_KEYS.TAB_GROUPS]: combinedGroups });

        // 2. Import Settings (Optional overwrite)
        if (data.settings) {
            await this.set({
                [STORAGE_KEYS.BLACKLIST]: data.settings.blacklist || [],
                [STORAGE_KEYS.WHITELIST]: data.settings.whitelist || [],
                [STORAGE_KEYS.FILTER_MODE]: data.settings.mode || DEFAULTS.FILTER_MODE
            });
        }
    }
    
    async updateGeneralSettings(newSettings) {
        const current = await this.getSettings();
        const merged = { ...current.general, ...newSettings };
        await this.set({ [STORAGE_KEYS.GENERAL_SETTINGS]: merged });
    }

    async updateBackupSettings(newSettings) {
        const current = await this.getSettings();
        const merged = { ...current.backup, ...newSettings };
        await this.set({ [STORAGE_KEYS.BACKUP_SETTINGS]: merged });
    }
}

export const storageService = new StorageService();