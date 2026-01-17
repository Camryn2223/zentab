browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveTabs") {
    saveGroup(message.tabs);
  }
});

async function saveGroup(newTabs) {
  const data = await browser.storage.local.get("tabGroups");
  const groups = data.tabGroups || [];
  
  const newGroup = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    tabs: newTabs
  };
  
  // Add new group to the top
  groups.unshift(newGroup);
  
  await browser.storage.local.set({ tabGroups: groups });
  
  // Open the dashboard page to show the user
  browser.runtime.openOptionsPage();
}