import { storageService } from './storage.js';
import { MODES, STORAGE_KEYS } from './constants.js';
import { getHostname } from './utils.js';

class SettingsManager {
    
    async getSettings() {
        return await storageService.getSettings();
    }

    async setMode(mode) {
        await storageService.set({ [STORAGE_KEYS.FILTER_MODE]: mode });
    }

    /**
     * Checks if a specific URL should be saved based on current settings.
     * @param {string} url 
     * @param {Object} [cachedSettings] Optional optimization to avoid async fetch
     * @returns {Promise<boolean>}
     */
    async shouldSaveUrl(url, cachedSettings = null) {
        const hostname = getHostname(url);
        if (!hostname) return false;

        const settings = cachedSettings || await this.getSettings();
        const { mode, blacklist, whitelist } = settings;

        if (mode === MODES.BLACKLIST) {
            return !blacklist.includes(hostname);
        } else if (mode === MODES.WHITELIST) {
            return whitelist.includes(hostname);
        }
        return true;
    }

    /**
     * Adds or removes a domain from the ACTIVE list (based on current mode).
     * @param {string} hostname 
     */
    async toggleCurrentDomain(hostname) {
        if (!hostname) return;

        const settings = await this.getSettings();
        const { mode } = settings;
        
        const listKey = mode === MODES.BLACKLIST ? STORAGE_KEYS.BLACKLIST : STORAGE_KEYS.WHITELIST;
        const currentList = mode === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;

        let newList;
        if (currentList.includes(hostname)) {
            newList = currentList.filter(d => d !== hostname);
        } else {
            newList = [...currentList, hostname].sort();
        }

        await storageService.set({ [listKey]: newList });
    }

    async removeDomain(domain, listType) {
        const settings = await this.getSettings();
        const listKey = listType === MODES.BLACKLIST ? STORAGE_KEYS.BLACKLIST : STORAGE_KEYS.WHITELIST;
        const currentList = listType === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;

        const newList = currentList.filter(d => d !== domain);
        await storageService.set({ [listKey]: newList });
    }

    async addDomain(domainInput, listType) {
        // Normalize input
        const hostname = getHostname(domainInput) || getHostname(`http://${domainInput}`) || domainInput;
        if (!hostname) return;

        const settings = await this.getSettings();
        const listKey = listType === MODES.BLACKLIST ? STORAGE_KEYS.BLACKLIST : STORAGE_KEYS.WHITELIST;
        const currentList = listType === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;

        if (currentList.includes(hostname)) return; // No duplicate

        const newList = [...currentList, hostname].sort();
        await storageService.set({ [listKey]: newList });
    }
}

export const settingsManager = new SettingsManager();