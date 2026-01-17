import { MODES } from './constants.js';
import { getHostname } from './utils.js';

export class FilterService {
    /**
     * Determines if a specific tab should be saved based on current settings.
     * @param {string} url 
     * @param {Object} settings ({ mode, blacklist, whitelist })
     * @returns {boolean}
     */
    static shouldSave(url, settings) {
        const hostname = getHostname(url);
        if (!hostname) return false; // Don't save internal pages or invalid URLs

        const { mode, blacklist, whitelist } = settings;

        if (mode === MODES.BLACKLIST) {
            return !blacklist.includes(hostname);
        } else if (mode === MODES.WHITELIST) {
            return whitelist.includes(hostname);
        }
        
        return true; // Default fallback
    }

    /**
     * Toggles a domain in the appropriate list.
     * @param {string} hostname 
     * @param {Object} currentSettings 
     * @returns {Promise<void>}
     */
    static async toggleDomain(hostname, currentSettings, storageService) {
        if (!hostname) return;

        const { mode } = currentSettings;
        // Map mode to specific storage key
        const listName = mode === MODES.BLACKLIST ? 'blacklistedDomains' : 'whitelistedDomains';
        
        // Get current list from settings
        let list = currentSettings[mode === MODES.BLACKLIST ? 'blacklist' : 'whitelist'];
        
        if (list.includes(hostname)) {
            list = list.filter(d => d !== hostname); // Remove
        } else {
            list.push(hostname); // Add
            list.sort();
        }

        await storageService.updateDomainList(listName, list);
    }
}