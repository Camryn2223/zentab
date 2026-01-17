export class UIRenderer {
    
    static createDomainListItem(domain, onRemove) {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const text = document.createElement('span');
        text.innerText = domain;
        text.style.wordBreak = 'break-all';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove-domain';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = "Remove";
        removeBtn.onclick = () => onRemove(domain);

        item.appendChild(text);
        item.appendChild(removeBtn);
        return item;
    }

    /**
     * Creates the group element.
     * @param {Object} group Data
     * @param {Function} onRestore 
     * @param {Function} onDelete 
     * @param {Object} config { showFavicons: boolean }
     */
    static createTabGroupElement(group, onRestore, onDelete, config = { showFavicons: true }) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group';
        groupDiv.dataset.id = group.id;
        
        // Header
        const header = document.createElement('div');
        header.className = 'group-header';
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.innerText = `${group.tabs.length} Tabs - ${group.date}`;

        const btnContainer = document.createElement('div');
        
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn-restore';
        restoreBtn.innerText = 'Restore All';
        restoreBtn.onclick = () => onRestore(group.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerText = 'Delete';
        deleteBtn.onclick = () => onDelete(group.id);

        btnContainer.appendChild(restoreBtn);
        btnContainer.appendChild(deleteBtn);
        header.appendChild(dateSpan);
        header.appendChild(btnContainer);
        groupDiv.appendChild(header);

        // Tabs
        const tabList = document.createElement('div');
        tabList.className = 'tab-list';

        group.tabs.forEach(tab => {
            const link = document.createElement('a');
            link.className = 'tab-link';
            link.href = tab.url;
            link.onclick = (e) => { 
                e.preventDefault(); 
                browser.tabs.create({ url: tab.url, active: false }); 
            };
            
            let iconDisplay = '';
            if (config.showFavicons) {
                const iconSrc = tab.favIconUrl || '';
                iconDisplay = iconSrc 
                    ? `<img src="${iconSrc}" class="favicon" onerror="this.style.display='none'">` 
                    : `<div class="favicon" style="background:#ccc"></div>`;
            }

            link.innerHTML = `${iconDisplay} <span class="tab-title">${tab.title || tab.url}</span>`;
            tabList.appendChild(link);
        });

        groupDiv.appendChild(tabList);
        return groupDiv;
    }

    static updateEmptyState(container, message) {
        container.innerHTML = `<div class="empty-msg">${message}</div>`;
    }
}