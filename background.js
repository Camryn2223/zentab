import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { backupManager } from './modules/backup-manager.js';
import { MESSAGES, BACKUP_CONFIG, CM_IDS, COMMANDS } from './modules/constants.js';

console.log("ZenTab: Background script started.");

// --- INITIALIZATION ---

// Runs when extension is installed or updated
browser.runtime.onInstalled.addListener(async () => {
    await setupContextMenus();
    await scheduleBackupAlarm(); // Initialize the schedule
    await checkAndRunMissedBackup(); // Check if we missed a backup during update/install process
});

// Runs when the browser starts up (profile loaded)
browser.runtime.onStartup.addListener(async () => {
    await checkAndRunMissedBackup();
});

async function setupContextMenus() {
    await browser.contextMenus.removeAll();

    const create = (id, title, contexts = ["page", "tab"]) => {
        browser.contextMenus.create({ id, title, contexts });
    };

    create(CM_IDS.SAVE_CURRENT, "Send Current Tab");
    create(CM_IDS.SAVE_SELECTED, "Send Selected Tabs");
    
    browser.contextMenus.create({ id: "sep-1", type: "separator", contexts: ["page", "tab"] });

    create(CM_IDS.SAVE_WORKSPACE, "Send Workspace Tabs");
    create(CM_IDS.SAVE_WINDOW, "Send Window Tabs");
    
    browser.contextMenus.create({ id: "sep-2", type: "separator", contexts: ["page", "tab", "action"] });
    
    create(CM_IDS.OPEN_DASHBOARD, "Open Dashboard", ["action", "page", "tab"]);
}

// --- EVENT LISTENERS ---

// Context Menus
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        switch (info.menuItemId) {
            case CM_IDS.SAVE_CURRENT:
                if (tab) {
                    const shouldSave = await settingsManager.shouldSaveUrl(tab.url);
                    if (shouldSave) {
                        await executeAction({ idsToClose: [tab.id], tabsToSave: [tab] });
                    }
                }
                break;
            case CM_IDS.SAVE_SELECTED:
                await performQueryAndSave({ currentWindow: true, highlighted: true, pinned: false });
                break;
            case CM_IDS.SAVE_WORKSPACE:
                await performQueryAndSave({ currentWindow: true, hidden: false, pinned: false });
                break;
            case CM_IDS.SAVE_WINDOW:
                await performQueryAndSave({ currentWindow: true, pinned: false });
                break;
            case CM_IDS.OPEN_DASHBOARD:
                browser.runtime.openOptionsPage();
                break;
        }
    } catch (e) {
        console.error("ZenTab: Context menu action failed", e);
    }
});

// Keyboard Commands
browser.commands.onCommand.addListener(async (command) => {
    try {
        if (command === COMMANDS.SAVE_SELECTED) {
            await performQueryAndSave({ currentWindow: true, highlighted: true, pinned: false });
        } else if (command === COMMANDS.SAVE_ALL) {
            await performQueryAndSave({ currentWindow: true, pinned: false });
        }
    } catch (e) {
        console.error("ZenTab: Command failed", e);
    }
});

// Toolbar Click
browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage(); 
});

// Alarm Handler (Auto-Backup)
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BACKUP_CONFIG.ALARM_NAME) {
        await performFileBackup();
    }
});

// Message Routing
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Keep handlers async to avoid blocking
    (async () => {
        try {
            switch (message.action) {
                case MESSAGES.SAVE_TABS:
                    await tabManager.saveTabGroup(message.tabs);
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
            console.error("ZenTab: Message handler error", err);
            sendResponse({ status: "error", message: err.toString() });
        }
    })();
    return true; // Required for async sendResponse
});

// --- HELPER FUNCTIONS ---

async function performQueryAndSave(query) {
    const result = await tabManager.getTabsForAction(query);
    await executeAction(result);
}

async function executeAction(result) {
    if (result.tabsToSave.length > 0) {
        await tabManager.saveTabGroup(result.tabsToSave);
        if (result.idsToClose && result.idsToClose.length > 0) {
            await browser.tabs.remove(result.idsToClose);
        }
    }
}

/**
 * Checks if the configured backup interval has passed since the last backup.
 * If yes, runs a backup immediately and resets the periodic alarm.
 */
async function checkAndRunMissedBackup() {
    try {
        const settings = await settingsManager.getSettings();
        const { enabled, intervalValue, intervalUnit } = settings.backup;

        if (!enabled) return;

        // Calculate required interval in Milliseconds
        let periodInMinutes = 60;
        if (intervalUnit === 'hours') periodInMinutes = intervalValue * 60;
        if (intervalUnit === 'days') periodInMinutes = intervalValue * 60 * 24;
        if (intervalUnit === 'weeks') periodInMinutes = intervalValue * 60 * 24 * 7;
        
        const intervalMs = periodInMinutes * 60 * 1000;
        const lastBackupTime = settings.lastBackup ? new Date(settings.lastBackup).getTime() : 0;
        const now = Date.now();

        // If lastBackupTime is 0, it's likely a fresh install, so we adhere to the standard schedule.
        // If lastBackupTime > 0, we check if we missed the window.
        if (lastBackupTime > 0 && (now - lastBackupTime) > intervalMs) {
            console.log(`ZenTab: Missed backup detected (Overdue by ${((now - lastBackupTime) - intervalMs) / 1000}s). Running catch-up...`);
            
            // 1. Reset the schedule FIRST.
            // This ensures that when the backup finishes and triggers a UI update,
            // the new alarm time is already established.
            await scheduleBackupAlarm(); 

            // 2. Run the backup
            await performFileBackup();
        }
    } catch (e) {
        console.error("ZenTab: Error checking missed backups", e);
    }
}

async function scheduleBackupAlarm() {
    try {
        const settings = await settingsManager.getSettings();
        const { enabled, intervalValue, intervalUnit } = settings.backup;

        // Always clear existing first to reset the timer logic
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
            console.log("ZenTab: Auto-backup disabled or invalid interval.");
        }
    } catch (e) {
        console.error("ZenTab: Failed to schedule backup", e);
    }
}

async function performFileBackup() {
    try {
        const backupData = await backupManager.createBackupData();
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = `zentab-backup-${new Date().toISOString().slice(0, 10)}.json`;

        await browser.downloads.download({
            url: url,
            filename: filename,
            saveAs: false // Auto-save to default folder
        });

        // Update timestamp after success
        // This triggers the browser.storage.onChanged event which updates the UI
        await backupManager.updateLastBackupTimestamp();
        
        console.log("ZenTab: Backup completed.");
    } catch (e) {
        console.error("ZenTab: Backup generation failed", e);
    }
}