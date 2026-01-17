import { createElement } from './utils.js';

/**
 * View Layer.
 * Purely functional DOM generation. 
 * Relies on Data Attributes for Event Delegation in the Controller.
 */
export class UIRenderer {

    /**
     * Renders a list of groups into a container.
     */
    static renderDashboard(container, groups, settings) {
        container.innerHTML = '';

        if (groups.length === 0) {
            container.appendChild(createElement('div', { 
                className: 'empty-msg', 
                text: 'No tabs found.' 
            }));
            return;
        }

        const fragment = document.createDocumentFragment();
        
        groups.forEach((group, index) => {
            fragment.appendChild(this._createTabGroupElement(group, index, settings));
        });

        container.appendChild(fragment);
    }

    static _createTabGroupElement(group, index, settings) {
        const groupDiv = createElement('div', {
            className: `group ${group.pinned ? 'pinned' : ''}`,
            draggable: 'true', // DnD
            dataset: { 
                id: group.id,
                type: 'group',
                index: index
            }
        });

        groupDiv.appendChild(this._createGroupHeader(group));
        
        const tabList = this._createTabList(group, settings);
        groupDiv.appendChild(tabList);
        
        return groupDiv;
    }

    static _createGroupHeader(group) {
        // Pin Button
        const pinBtn = createElement('button', {
            className: `btn-pin ${group.pinned ? 'active' : ''}`,
            text: '📌', // Changed from html to text
            title: group.pinned ? "Unpin Group" : "Pin Group",
            dataset: { action: 'pin', id: group.id }
        });

        // Title Input
        const titleInput = createElement('input', {
            type: 'text',
            className: 'group-title-input input-dark',
            value: group.customTitle || `${group.tabs.length} Tabs - ${group.date}`,
            dataset: { action: 'rename', id: group.id }
        });

        const titleContainer = createElement('div', { className: 'group-title-container' }, [
            pinBtn,
            titleInput
        ]);

        // Action Buttons
        const btns = [
            createElement('button', {
                className: 'btn-icon-text',
                // Replaced html string with child nodes
                title: "Restore to new window",
                dataset: { action: 'restore-win', id: group.id }
            }, [
                createElement('span', { text: '❐' }),
                ' Window'
            ]),
            
            createElement('button', {
                className: 'btn-restore',
                text: 'Restore',
                dataset: { action: 'restore', id: group.id }
            })
        ];

        if (!group.pinned) {
            btns.push(createElement('button', {
                className: 'btn-delete',
                text: 'Delete',
                dataset: { action: 'delete', id: group.id }
            }));
        }

        const btnContainer = createElement('div', { className: 'group-actions-container' }, btns);

        // Header itself is a drag handle for the group, but we rely on the parent div draggable
        return createElement('div', { className: 'group-header' }, [titleContainer, btnContainer]);
    }

    static _createTabList(group, settings) {
        // The tab-list is a drop zone for tabs
        const list = createElement('div', { 
            className: 'tab-list',
            dataset: {
                type: 'tab-list',
                groupId: group.id
            }
        });

        group.tabs.forEach((tab, index) => {
            const children = [];

            // Favicon
            if (settings.general.showFavicons) {
                const iconContent = tab.favIconUrl 
                    ? createElement('img', { 
                        src: tab.favIconUrl, 
                        className: 'favicon',
                        onError: (e) => { e.target.style.display = 'none'; } 
                      })
                    : null;
                children.push(createElement('div', { className: 'favicon-container' }, iconContent ? [iconContent] : []));
            }

            // Title
            children.push(createElement('span', { className: 'tab-title', text: tab.title || tab.url }));

            // Link Wrapper
            const link = createElement('a', {
                className: 'tab-link',
                href: tab.url,
                draggable: 'true', // DnD
                dataset: { 
                    action: 'open-tab', 
                    id: group.id, 
                    url: tab.url,
                    index: index,
                    type: 'tab' // Important for DnD
                }
            }, children);

            list.appendChild(link);
        });

        return list;
    }

    static createDomainListItem(domain, mode) {
        return createElement('div', { className: 'list-item' }, [
            createElement('span', { text: domain, style: { wordBreak: 'break-all' } }),
            createElement('button', {
                className: 'btn-remove-domain',
                text: '×', // Replaced &times; entity with unicode char
                title: "Remove",
                dataset: { action: 'remove-domain', domain: domain, mode: mode }
            })
        ]);
    }

    // --- UTILS ---

    static showToast(message, actionLabel = null, onAction = null, duration = 4000) {
        const existing = document.getElementById('zentab-toast');
        if (existing) existing.remove();

        const children = [createElement('span', { text: message })];

        if (actionLabel && onAction) {
            children.push(createElement('button', {
                className: 'toast-action-btn',
                text: actionLabel,
                onClick: () => {
                    onAction();
                    document.getElementById('zentab-toast')?.remove();
                }
            }));
        }

        const toast = createElement('div', {
            id: 'zentab-toast',
            className: 'toast-notification'
        }, children);

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}