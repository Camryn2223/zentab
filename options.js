document.addEventListener('DOMContentLoaded', () => {
  renderGroups();
  initSettings();
});

// --- LIST MANAGEMENT VARIABLES ---
let currentMode = 'blacklist'; // 'blacklist' or 'whitelist'

// --- INITIALIZATION ---
async function initSettings() {
  const data = await browser.storage.local.get('filterMode');
  currentMode = data.filterMode || 'blacklist';
  
  const select = document.getElementById('mode-select');
  select.value = currentMode;
  
  updateDescription();
  renderDomainList();

  // Listen for mode change
  select.addEventListener('change', async (e) => {
    currentMode = e.target.value;
    await browser.storage.local.set({ filterMode: currentMode });
    updateDescription();
    renderDomainList();
    
    // Clear inputs on switch
    document.getElementById('add-input').value = '';
    document.getElementById('search-input').value = '';
  });
}

function updateDescription() {
  const desc = document.getElementById('mode-desc');
  const addInput = document.getElementById('add-input');
  
  if (currentMode === 'blacklist') {
    desc.innerText = "Sites in this list will NEVER be saved.";
    addInput.placeholder = "Block domain (e.g. google.com)";
  } else {
    desc.innerText = "ONLY sites in this list will be saved.";
    addInput.placeholder = "Allow domain (e.g. work.com)";
  }
}

// --- DOMAIN LIST LOGIC ---

document.getElementById('search-input').addEventListener('input', (e) => {
  renderDomainList(e.target.value);
});

document.getElementById('add-btn').addEventListener('click', addDomain);
document.getElementById('add-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDomain();
});

async function addDomain() {
  const input = document.getElementById('add-input');
  let rawValue = input.value.trim();
  if (!rawValue) return;

  // Extract hostname
  let hostname = rawValue;
  try {
    if (!rawValue.startsWith('http')) {
      hostname = new URL('https://' + rawValue).hostname;
    } else {
      hostname = new URL(rawValue).hostname;
    }
  } catch (e) { hostname = rawValue; }

  // Determine which list to update
  const listName = currentMode === 'blacklist' ? 'blacklistedDomains' : 'whitelistedDomains';
  
  const data = await browser.storage.local.get(listName);
  const list = data[listName] || [];

  if (!list.includes(hostname)) {
    list.push(hostname);
    list.sort();
    await browser.storage.local.set({ [listName]: list });
    input.value = '';
    renderDomainList();
  } else {
    alert("Domain already in " + currentMode + "!");
  }
}

async function renderDomainList(filterText = '') {
  const listContainer = document.getElementById('domain-list');
  listContainer.innerHTML = '';

  const listName = currentMode === 'blacklist' ? 'blacklistedDomains' : 'whitelistedDomains';
  const data = await browser.storage.local.get(listName);
  const list = data[listName] || [];

  const filtered = list.filter(domain => 
    domain.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    listContainer.innerHTML = `<div class="empty-msg">No ${currentMode} domains found.</div>`;
    return;
  }

  filtered.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const text = document.createElement('span');
    text.innerText = domain;
    text.style.wordBreak = 'break-all';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-domain';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = "Remove";
    
    removeBtn.onclick = async () => {
      const newData = await browser.storage.local.get(listName);
      const currentList = newData[listName] || [];
      const updated = currentList.filter(d => d !== domain);
      await browser.storage.local.set({ [listName]: updated });
      
      const currentSearch = document.getElementById('search-input').value;
      renderDomainList(currentSearch);
    };

    item.appendChild(text);
    item.appendChild(removeBtn);
    listContainer.appendChild(item);
  });
}

// --- STANDARD TAB LOGIC (Same as before) ---
document.getElementById('clear-all').addEventListener('click', async () => {
  if(confirm("Delete all saved history?")) {
    await browser.storage.local.set({ tabGroups: [] });
    renderGroups();
  }
});

async function renderGroups() {
  const container = document.getElementById('container');
  container.innerHTML = '';
  const data = await browser.storage.local.get("tabGroups");
  const groups = data.tabGroups || [];

  if (groups.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#6c7086; margin-top:50px;">No tabs saved yet.</div>';
    return;
  }

  groups.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group';
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <span class="date">${group.tabs.length} Tabs - ${group.date}</span>
      <div><button class="btn-restore">Restore All</button><button class="btn-delete">Delete</button></div>
    `;
    
    header.querySelector('.btn-restore').onclick = async () => {
      for (const tab of group.tabs) { await browser.tabs.create({ url: tab.url, active: false }); }
      deleteGroup(group.id);
    };
    header.querySelector('.btn-delete').onclick = () => deleteGroup(group.id);
    groupDiv.appendChild(header);

    group.tabs.forEach(tab => {
      const link = document.createElement('a');
      link.className = 'tab-link';
      link.href = tab.url;
      link.onclick = (e) => { e.preventDefault(); browser.tabs.create({ url: tab.url, active: false }); };
      const icon = tab.favIconUrl ? `<img src="${tab.favIconUrl}" class="favicon">` : `<div class="favicon" style="background:#ccc"></div>`;
      link.innerHTML = `${icon} <span>${tab.title}</span>`;
      groupDiv.appendChild(link);
    });
    container.appendChild(groupDiv);
  });
}

async function deleteGroup(id) {
  const data = await browser.storage.local.get("tabGroups");
  const groups = data.tabGroups || [];
  const newGroups = groups.filter(g => g.id !== id);
  await browser.storage.local.set({ tabGroups: newGroups });
  renderGroups();
}