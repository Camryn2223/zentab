import { storageService } from './storage.js';
import { settingsManager } from './settings-manager.js';
import { BACKUP_CONFIG } from './constants.js';

class BackupManager {

    /**
     * Generates the complete JSON object for a full backup.
     * @returns {Promise<Object>}
     */
    async createBackupData() {
        const groups = await storageService.getGroups();
        const settings = await settingsManager.getSettings();

        return {
            version: BACKUP_CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            groups: groups,
            settings: {
                blacklist: settings.blacklist,
                whitelist: settings.whitelist,
                mode: settings.mode
            }
        };
    }

    /**
     * Validates and imports a JSON string or object.
     * @param {string|Object} input 
     * @returns {Promise<Object>} Result status
     */
    async importBackupData(input) {
        try {
            const data = typeof input === 'string' ? JSON.parse(input) : input;
            
            if (!data.groups || !Array.isArray(data.groups)) {
                throw new Error("Invalid format: 'groups' array missing.");
            }

            await storageService.importData(data);
            return { success: true, count: data.groups.length };
        } catch (e) {
            console.error("Import failed:", e);
            throw e;
        }
    }

    /**
     * Parses OneTab-style text (URL | Title) into a tab group structure.
     * @param {string} text 
     * @returns {Array} Array of tab objects
     */
    parseOneTabImport(text) {
        if (!text) return [];

        const lines = text.split('\n');
        const tabs = [];

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // Format: https://url.com | Title
            // Handle cases where title might be missing
            const parts = cleanLine.split('|');
            const url = parts[0].trim();
            const title = parts[1] ? parts[1].trim() : url;

            if (url) {
                tabs.push({
                    url: url,
                    title: title,
                    favIconUrl: '' // Icons are lost in text-only import
                });
            }
        });

        return tabs;
    }

    /**
     * Generates a OneTab-style text string from current groups.
     * @returns {Promise<string>}
     */
    async generateOneTabExport() {
        const groups = await storageService.getGroups();
        let exportText = "";

        groups.forEach(group => {
            group.tabs.forEach(tab => {
                exportText += `${tab.url} | ${tab.title}\n`;
            });
            exportText += '\n';
        });

        return exportText.trim();
    }
}

export const backupManager = new BackupManager();