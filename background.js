import { tabManager } from './modules/tab-manager.js';
import { settingsManager } from './modules/settings-manager.js';
import { backupManager } from './modules/backup-manager.js';
import { MESSAGES, BACKUP_CONFIG, CM_IDS, COMMANDS } from './modules/constants.js';

console.log("ZenTab: Background script started.");

// --- INITIALIZATION ---
browser.runtime.onInstalled.addListener(async () => {
    await setupContextMenus();
});

async function setupContextMenus() {
    // Clear existing to prevent duplicates/errors on reload
    await browser.contextMenus.removeAll();

    // 1. Current Tab
    browser.contextMenus.create({
        id: CM_IDS.SAVE_CURRENT,
        title: "Send Current Tab",
        contexts: ["page", "tab"]
    });

    // 2. Selected Tabs (Highlighted/Multi-select)
    browser.contextMenus.create({
        id: CM_IDS.SAVE_SELECTED,
        title: "Send Selected Tabs",
        contexts: ["page", "tab"]
    });

    // Separator
    browser.contextMenus.create({
        id: "sep-1",
        type: "separator",
        contexts: ["page", "tab"]
    });

    // 3. Workspace Tabs (Visible Only - useful if some are hidden/folded)
    browser.contextMenus.create({
        id: CM_IDS.SAVE_WORKSPACE,
        title: "Send Workspace Tabs",
        contexts: ["page", "tab"]
    });
    
    // 4. Window Tabs (All in current window, even if hidden)
    browser.contextMenus.create({
        id: CM_IDS.SAVE_WINDOW,
        title: "Send Window Tabs",
        contexts: ["page", "tab"]
    });

    // Separator
    browser.contextMenus.create({
        id: "sep-2",
        type: "separator",
        contexts: ["page", "tab", "action"]
    });

    // 5. Dashboard Link
    browser.contextMenus.create({
        id: CM_IDS.OPEN_DASHBOARD,
        title: "Open Dashboard",
        contexts: ["action", "page", "tab"]
    });
}

// --- EVENT LISTENERS ---

// Context Menus
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case CM_IDS.SAVE_CURRENT:
            if (tab) {
                // Fix: Validate URL before saving (prevents saving dashboard/popup)
                const shouldSave = await settingsManager.shouldSaveUrl(tab.url);
                if (shouldSave) {
                    await executeAction({ idsToClose: [tab.id], tabsToSave: [tab] });
                } else {
                    console.log("ZenTab: blocked saving internal/restricted page.");
                }
            }
            break;
            
        case CM_IDS.SAVE_SELECTED:
            // Query: Current Window + Highlighted
            performQueryAndSave({ currentWindow: true, highlighted: true, pinned: false });
            break;

        case CM_IDS.SAVE_WORKSPACE:
            // Query: Current Window + Visible (Not hidden)
            performQueryAndSave({ currentWindow: true, hidden: false, pinned: false });
            break;

        case CM_IDS.SAVE_WINDOW:
            // Query: Current Window (Everything)
            performQueryAndSave({ currentWindow: true, pinned: false });
            break;

        case CM_IDS.OPEN_DASHBOARD:
            browser.runtime.openOptionsPage();
            break;
    }
});

// Keyboard Commands
browser.commands.onCommand.addListener((command) => {
    if (command === COMMANDS.SAVE_SELECTED) {
        performQueryAndSave({ currentWindow: true, highlighted: true, pinned: false });
    } else if (command === COMMANDS.SAVE_ALL) {
        performQueryAndSave({ currentWindow: true, pinned: false });
    }
});

// Toolbar Click
browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage(); 
});

// Alarm Handler
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BACKUP_CONFIG.ALARM_NAME) {
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
    return true;
});

// --- HELPER FUNCTIONS ---

async function performQueryAndSave(query) {
    try {
        const result = await tabManager.getTabsForAction(query);
        await executeAction(result);
    } catch (e) {
        console.error("ZenTab: Command failed", e);
    }
}

async function executeAction(result) {
    if (result.tabsToSave.length > 0) {
        await tabManager.saveTabGroup(result.tabsToSave);
        if (result.idsToClose && result.idsToClose.length > 0) {
            await browser.tabs.remove(result.idsToClose);
        }
    }
}

async function handleSaveTabs(tabs) {
    try {
        await tabManager.saveTabGroup(tabs);
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
            saveAs: false
        });
    } catch (e) {
        console.error("ZenTab: Backup failed", e);
    }
}

scheduleBackupAlarm();