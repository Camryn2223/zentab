import { tabManager } from './modules/tab-manager.js';
import { MESSAGES } from './modules/constants.js';

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === MESSAGES.SAVE_TABS) {
        handleSaveTabs(message.tabs);
    }
    // Return false as we don't need to keep the channel open for a response
    return false;
});

async function handleSaveTabs(tabs) {
    try {
        await tabManager.saveTabGroup(tabs);
        await browser.runtime.openOptionsPage();
    } catch (error) {
        console.error("ZenTab Error: Failed to save tabs", error);
    }
}