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

    async updateGeneralSetting(key, value) {
        await storageService.updateGeneralSettings({ [key]: value });
    }

    async saveBackupConfig(config) {
        await storageService.updateBackupSettings(config);
    }

    /**
     * Determines if a URL should be saved based on current filter mode.
     * @param {string} url 
     * @param {Object|null} cachedSettings Optional optimization to avoid async lookup
     * @returns {Promise<boolean>}
     */
    async shouldSaveUrl(url, cachedSettings = null) {
        if (!url) return false;

        // 1. SELF-PRESERVATION CHECK
        // Prevent the extension from saving/closing its own dashboard or popup.
        // browser.runtime.getURL("") returns "moz-extension://<uuid>/"
        if (url.startsWith(browser.runtime.getURL(""))) {
            return false;
        }

        // 2. Hostname extraction
        const hostname = getHostname(url);
        // Do not save internal, file, or invalid schemes (handled by utils.js usually)
        if (!hostname) return false;

        const settings = cachedSettings || await this.getSettings();
        const { mode, blacklist, whitelist } = settings;

        if (mode === MODES.BLACKLIST) {
            return !blacklist.includes(hostname);
        } else if (mode === MODES.WHITELIST) {
            return whitelist.includes(hostname);
        }
        
        // Fallback safety
        return true;
    }

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
        // Try to normalize input (e.g., user pastes full url vs just domain)
        const hostname = getHostname(domainInput) || getHostname(`http://${domainInput}`) || domainInput;
        if (!hostname) return;

        const settings = await this.getSettings();
        const listKey = listType === MODES.BLACKLIST ? STORAGE_KEYS.BLACKLIST : STORAGE_KEYS.WHITELIST;
        const currentList = listType === MODES.BLACKLIST ? settings.blacklist : settings.whitelist;

        if (currentList.includes(hostname)) return; 

        const newList = [...currentList, hostname].sort();
        await storageService.set({ [listKey]: newList });
    }
}

export const settingsManager = new SettingsManager();