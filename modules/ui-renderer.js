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
     * Creates the DOM element for a tab group.
     * @param {Object} group Data
     * @param {Object} actions { onRestore, onRestoreWin, onDelete, onPin, onTabClick }
     * @param {Object} config { showFavicons: boolean }
     */
    static createTabGroupElement(group, actions, config = { showFavicons: true }) {
        const groupDiv = document.createElement('div');
        groupDiv.className = `group ${group.pinned ? 'pinned' : ''}`;
        groupDiv.dataset.id = group.id;

        // --- Header Section ---
        const header = document.createElement('div');
        header.className = 'group-header';

        // 1. Title Area
        const titleContainer = document.createElement('div');
        titleContainer.className = 'group-title-container';
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.gap = '10px';

        // Pin Icon
        const pinBtn = document.createElement('button');
        pinBtn.className = `btn-pin ${group.pinned ? 'active' : ''}`;
        pinBtn.innerHTML = '📌';
        pinBtn.title = group.pinned ? "Unpin Group" : "Pin Group";
        pinBtn.onclick = () => actions.onPin(group.id);
        titleContainer.appendChild(pinBtn);

        // Title Input
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'group-title-input input-dark';
        titleInput.value = group.customTitle || `${group.tabs.length} Tabs - ${group.date}`;
        Object.assign(titleInput.style, {
            border: '1px solid transparent',
            background: 'transparent',
            width: '300px',
            color: 'var(--text-primary)',
            fontWeight: group.pinned ? 'bold' : 'normal'
        });

        const saveTitle = () => {
            const isDefault = titleInput.value.includes('Tabs -');
            if (titleInput.value && !isDefault) {
                titleInput.dispatchEvent(new CustomEvent('group-rename', {
                    detail: { id: group.id, newTitle: titleInput.value },
                    bubbles: true
                }));
            }
        };

        titleInput.onfocus = () => {
            titleInput.style.borderColor = 'var(--accent-blue)';
            titleInput.style.background = 'var(--bg-base)';
        };
        titleInput.onblur = () => {
            titleInput.style.borderColor = 'transparent';
            titleInput.style.background = 'transparent';
            saveTitle();
        };
        titleInput.onkeypress = (e) => { if (e.key === 'Enter') titleInput.blur(); };

        titleContainer.appendChild(titleInput);
        header.appendChild(titleContainer);

        // 2. Action Buttons
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '8px';

        const restoreWinBtn = document.createElement('button');
        restoreWinBtn.className = 'btn-icon-text';
        restoreWinBtn.innerHTML = '<span>❐</span> Window';
        restoreWinBtn.title = "Restore to new window";
        restoreWinBtn.onclick = () => actions.onRestoreWin(group.id);

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn-restore';
        restoreBtn.innerText = 'Restore';
        restoreBtn.onclick = () => actions.onRestore(group.id);

        btnContainer.appendChild(restoreWinBtn);
        btnContainer.appendChild(restoreBtn);

        if (!group.pinned) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.innerText = 'Delete';
            deleteBtn.onclick = () => actions.onDelete(group.id);
            btnContainer.appendChild(deleteBtn);
        }

        header.appendChild(btnContainer);
        groupDiv.appendChild(header);

        // --- Tabs List Section ---
        const tabList = document.createElement('div');
        tabList.className = 'tab-list';

        group.tabs.forEach((tab, index) => {
            const link = document.createElement('a');
            link.className = 'tab-link';
            link.href = tab.url;
            
            // Delegate click to controller to handle "Consume on Open" logic
            link.onclick = (e) => {
                e.preventDefault();
                actions.onTabClick(group.id, index, tab);
            };

            if (config.showFavicons) {
                const iconContainer = document.createElement('div');
                Object.assign(iconContainer.style, {
                    width: '16px', height: '16px', marginRight: '12px',
                    flexShrink: '0', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center'
                });

                if (tab.favIconUrl) {
                    const img = document.createElement('img');
                    img.src = tab.favIconUrl;
                    img.className = 'favicon';
                    Object.assign(img.style, {
                        width: '100%', height: '100%', objectFit: 'contain'
                    });
                    img.addEventListener('error', () => { img.style.display = 'none'; });
                    iconContainer.appendChild(img);
                } else {
                    iconContainer.style.backgroundColor = '#ccc';
                    iconContainer.style.borderRadius = '2px';
                }
                link.appendChild(iconContainer);
            }

            const titleSpan = document.createElement('span');
            titleSpan.className = 'tab-title';
            titleSpan.innerText = tab.title || tab.url;

            link.appendChild(titleSpan);
            tabList.appendChild(link);
        });

        groupDiv.appendChild(tabList);
        return groupDiv;
    }

    static updateEmptyState(container, message) {
        container.innerHTML = `<div class="empty-msg">${message}</div>`;
    }
}