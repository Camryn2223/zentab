import { storageService } from './modules/storage.js';

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveTabs") {
        handleSaveTabs(message.tabs);
    }
    // Return true if we needed to sendResponse asynchronously
});

async function handleSaveTabs(tabs) {
    try {
        await storageService.saveGroup(tabs);
        await browser.runtime.openOptionsPage();
    } catch (error) {
        console.error("Failed to save tabs:", error);
    }
}