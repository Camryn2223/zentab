import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { backupManager } from './modules/backup-manager.js';
import { MESSAGES, BACKUP_CONFIG } from './modules/constants.js';

console.log("ZenTab: Background script started.");

// Open options on toolbar click
browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});

// Alarm Handler (Auto Backup)
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BACKUP_CONFIG.ALARM_NAME) {
        console.log("ZenTab: Alarm triggered backup.");
        await performFileBackup();
    }
});

// Message Routing
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case MESSAGES.SAVE_TABS:
                    await handleSaveTabs(message.tabs);
                    break;
                case MESSAGES.SCHEDULE_BACKUP:
                    await scheduleBackupAlarm();
                    break;
                case MESSAGES.PERFORM_BACKUP:
                    await performFileBackup();
                    break;
            }
            sendResponse({ status: "success" });
        } catch (err) {
            console.error("ZenTab: Error in background message handler", err);
            sendResponse({ status: "error", message: err.toString() });
        }
    })();
    return true; // Async response
});

async function handleSaveTabs(tabs) {
    try {
        await tabManager.saveTabGroup(tabs);
        await browser.runtime.openOptionsPage();
    } catch (error) {
        console.error("ZenTab Error: Failed to save tabs", error);
    }
}

async function scheduleBackupAlarm() {
    const settings = await settingsManager.getSettings();
    const { enabled, intervalValue, intervalUnit } = settings.backup;

    await browser.alarms.clear(BACKUP_CONFIG.ALARM_NAME);

    if (enabled && intervalValue > 0) {
        let periodInMinutes = 60; 
        
        if (intervalUnit === 'hours') periodInMinutes = intervalValue * 60;
        if (intervalUnit === 'days') periodInMinutes = intervalValue * 60 * 24;
        if (intervalUnit === 'weeks') periodInMinutes = intervalValue * 60 * 24 * 7;

        browser.alarms.create(BACKUP_CONFIG.ALARM_NAME, {
            periodInMinutes: periodInMinutes
        });
        console.log(`ZenTab: Backup scheduled every ${periodInMinutes} minutes.`);
    } else {
        console.log("ZenTab: Auto-backup disabled.");
    }
}

/**
 * Generates and downloads the backup file.
 * Requires "downloads" permission.
 */
async function performFileBackup() {
    try {
        console.log("ZenTab: Performing file backup...");
        
        // Delegate data creation to the manager
        const backupData = await backupManager.createBackupData();

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = `zentab-backup-${new Date().toISOString().slice(0, 10)}.json`;

        await browser.downloads.download({
            url: url,
            filename: filename,
            saveAs: false // Auto save without prompting
        });

        console.log("ZenTab: Backup downloaded: " + filename);
    } catch (e) {
        console.error("ZenTab: Backup failed", e);
    }
}

// Initial check on load
scheduleBackupAlarm();