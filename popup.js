document.addEventListener('DOMContentLoaded', initPopup);

// --- Send Buttons ---
document.getElementById('send-workspace').addEventListener('click', async () => {
  const tabs = await browser.tabs.query({ currentWindow: true, hidden: false, pinned: false });
  await processTabs(tabs);
});

document.getElementById('send-selected').addEventListener('click', async () => {
  const tabs = await browser.tabs.query({ currentWindow: true, highlighted: true, pinned: false });
  await processTabs(tabs);
});

document.getElementById('send-all').addEventListener('click', async () => {
  const tabs = await browser.tabs.query({ currentWindow: true, pinned: false });
  await processTabs(tabs);
});

document.getElementById('open-dashboard').addEventListener('click', () => {
  browser.tabs.create({ url: "options.html" });
  window.close();
});

// --- Filter Logic ---

document.getElementById('toggle-filter').addEventListener('click', toggleDomainStatus);

// Listen for Mode Switcher Change
document.getElementById('mode-select').addEventListener('change', async (e) => {
  currentMode = e.target.value;
  await browser.storage.local.set({ filterMode: currentMode });
  await updateFilterButtonUI(); // Refresh the button text immediately
});

let currentHostname = null;
let currentMode = 'blacklist';

async function initPopup() {
  // 1. Get Mode
  const data = await browser.storage.local.get(['filterMode']);
  currentMode = data.filterMode || 'blacklist';
  
  // Set dropdown value
  document.getElementById('mode-select').value = currentMode;

  // 2. Get Current Tab
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url.startsWith('http')) return;

  try {
    currentHostname = new URL(tab.url).hostname;
    await updateFilterButtonUI();
  } catch (e) {
    console.error("Could not parse hostname");
  }
}

async function updateFilterButtonUI() {
  const btn = document.getElementById('toggle-filter');
  btn.style.display = 'inline-block';

  const listName = currentMode === 'blacklist' ? 'blacklistedDomains' : 'whitelistedDomains';
  const data = await browser.storage.local.get(listName);
  const list = data[listName] || [];
  const isInList = list.includes(currentHostname);

  if (currentMode === 'blacklist') {
    // BLACKLIST MODE
    if (isInList) {
      btn.innerText = `Un-blacklist ${currentHostname}`;
      btn.className = 'btn-action-link bl-remove';
      btn.title = "Allow this site to be saved";
    } else {
      btn.innerText = `Blacklist ${currentHostname}`;
      btn.className = 'btn-action-link bl-add';
      btn.title = "Never save tabs from this site";
    }
  } else {
    // WHITELIST MODE
    if (isInList) {
      btn.innerText = `Un-whitelist ${currentHostname}`;
      btn.className = 'btn-action-link wl-remove';
      btn.title = "Stop saving tabs from this site";
    } else {
      btn.innerText = `Whitelist ${currentHostname}`;
      btn.className = 'btn-action-link wl-add';
      btn.title = "Allow this site to be saved";
    }
  }
}

async function toggleDomainStatus() {
  if (!currentHostname) return;

  const listName = currentMode === 'blacklist' ? 'blacklistedDomains' : 'whitelistedDomains';
  const data = await browser.storage.local.get(listName);
  let list = data[listName] || [];

  if (list.includes(currentHostname)) {
    list = list.filter(d => d !== currentHostname); // Remove
  } else {
    list.push(currentHostname); // Add
    list.sort();
  }

  await browser.storage.local.set({ [listName]: list });
  await updateFilterButtonUI();
}

// --- Process Tabs ---

async function processTabs(tabs) {
  if (tabs.length === 0) return;

  // Fetch settings again to ensure we have the absolute latest state
  const settings = await browser.storage.local.get(['filterMode', 'blacklistedDomains', 'whitelistedDomains']);
  const mode = settings.filterMode || 'blacklist';
  const blacklist = settings.blacklistedDomains || [];
  const whitelist = settings.whitelistedDomains || [];

  const tabsToSave = [];
  const tabsToCloseIds = [];

  for (const tab of tabs) {
    try {
      const hostname = new URL(tab.url).hostname;
      let shouldSave = false;

      if (mode === 'blacklist') {
        shouldSave = !blacklist.includes(hostname);
      } else {
        shouldSave = whitelist.includes(hostname);
      }

      if (shouldSave) {
        tabsToSave.push({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl
        });
        tabsToCloseIds.push(tab.id);
      }
    } catch (e) {
      // Skip internal pages
    }
  }

  if (tabsToSave.length === 0) {
    window.close();
    return;
  }

  await browser.runtime.sendMessage({ action: "saveTabs", tabs: tabsToSave });
  await browser.tabs.remove(tabsToCloseIds);
  window.close();
}