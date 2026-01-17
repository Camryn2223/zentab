import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { storageService } from './modules/storage.js';
import { MESSAGES } from './modules/constants.js';

console.log("ZenTab: Background script started.");

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});

const BACKUP_ALARM_NAME = "zentab-auto-backup";

// Alarm Handler (Auto Backup)
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BACKUP_ALARM_NAME) {
        console.log("ZenTab: Alarm triggered backup.");
        await performFileBackup();
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // We return a Promise chain to keep the channel open and acknowledge receipt
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
            // Send a success response back to options.js
            sendResponse({ status: "success" });
        } catch (err) {
            console.error("ZenTab: Error in background message handler", err);
            sendResponse({ status: "error", message: err.toString() });
        }
    })();

    return true; // IMPORTANT: Indicates we will send a response asynchronously
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

    // Clear existing
    await browser.alarms.clear(BACKUP_ALARM_NAME);

    if (enabled && intervalValue > 0) {
        let periodInMinutes = 60; // default 1 hour
        
        if (intervalUnit === 'hours') periodInMinutes = intervalValue * 60;
        if (intervalUnit === 'days') periodInMinutes = intervalValue * 60 * 24;
        if (intervalUnit === 'weeks') periodInMinutes = intervalValue * 60 * 24 * 7;

        browser.alarms.create(BACKUP_ALARM_NAME, {
            periodInMinutes: periodInMinutes
        });
        console.log(`ZenTab: Backup scheduled every ${periodInMinutes} minutes.`);
    } else {
        console.log("ZenTab: Auto-backup disabled.");
    }
}

async function performFileBackup() {
    try {
        console.log("ZenTab: Performing file backup...");
        const groups = await storageService.getGroups();
        const settings = await settingsManager.getSettings();

        const backupData = {
            version: '1.2.0',
            exportedAt: new Date().toISOString(),
            groups: groups,
            settings: {
                blacklist: settings.blacklist,
                whitelist: settings.whitelist,
                mode: settings.mode
            }
        };

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