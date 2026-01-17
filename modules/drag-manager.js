import { store } from './store.js';

export class DragManager {
    constructor() {
        this.draggedType = null;
        this.draggedData = null; // { id, index, groupId }
        this.placeholder = null;
    }

    init(container) {
        container.addEventListener('dragstart', this.handleDragStart.bind(this));
        container.addEventListener('dragover', this.handleDragOver.bind(this));
        container.addEventListener('drop', this.handleDrop.bind(this));
        container.addEventListener('dragend', this.handleDragEnd.bind(this));
        // We use dragenter/leave purely for visual cleanup if needed, but dragover handles most
    }

    handleDragStart(e) {
        const target = e.target;
        
        // Determine if Group or Tab
        if (target.dataset.type === 'group') {
            this.draggedType = 'group';
            this.draggedData = {
                id: Number(target.dataset.id),
                index: Number(target.dataset.index)
            };
            e.dataTransfer.effectAllowed = 'move';
            target.classList.add('dragging');
        } 
        else if (target.dataset.type === 'tab') {
            this.draggedType = 'tab';
            this.draggedData = {
                groupId: Number(target.dataset.id),
                index: Number(target.dataset.index)
            };
            e.dataTransfer.effectAllowed = 'move';
            target.classList.add('dragging');
        }
    }

    handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping

        const container = document.getElementById('container');
        
        if (this.draggedType === 'group') {
            const afterElement = this.getDragAfterElement(container, e.clientY, '[data-type="group"]');
            this.updateDropIndicator(container, afterElement, 'group');
        } 
        else if (this.draggedType === 'tab') {
            // Find the closest group or tab list we are hovering over
            const groupList = e.target.closest('.tab-list');
            if (groupList) {
                const afterElement = this.getDragAfterElement(groupList, e.clientY, '[data-type="tab"]');
                this.updateDropIndicator(groupList, afterElement, 'tab');
            }
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        this.cleanupIndicators();
        
        if (!this.draggedData) return;

        // GROUP DROP
        if (this.draggedType === 'group') {
            const container = document.getElementById('container');
            const afterElement = this.getDragAfterElement(container, e.clientY, '[data-type="group"]');
            
            // Calculate new index
            // groups array is 0-indexed.
            // If afterElement is null, we are at the end.
            
            let newIndex;
            if (afterElement) {
                newIndex = Number(afterElement.dataset.index);
                // If dragging downwards, the target index shifts because the removed item changes indices
                if (this.draggedData.index < newIndex) newIndex--; 
            } else {
                newIndex = store.state.groups.length - 1;
            }

            if (newIndex !== this.draggedData.index) {
                await store.moveGroup(this.draggedData.id, newIndex);
            }
        }
        
        // TAB DROP
        else if (this.draggedType === 'tab') {
            const groupList = e.target.closest('.tab-list');
            if (groupList) {
                const targetGroupId = Number(groupList.dataset.groupId);
                const afterElement = this.getDragAfterElement(groupList, e.clientY, '[data-type="tab"]');
                
                let newIndex;
                const targetGroupTabsCount = groupList.querySelectorAll('[data-type="tab"]').length;

                if (afterElement) {
                    newIndex = Number(afterElement.dataset.index);
                    // Adjustment if moving within same group downwards
                    if (this.draggedData.groupId === targetGroupId && this.draggedData.index < newIndex) {
                        newIndex--;
                    }
                } else {
                    newIndex = targetGroupTabsCount; // Append to end
                    // Adjustment if moving within same group to the very end
                    if (this.draggedData.groupId === targetGroupId) {
                        newIndex = targetGroupTabsCount - 1;
                    }
                }

                if (this.draggedData.groupId !== targetGroupId || this.draggedData.index !== newIndex) {
                    await store.moveTab(
                        this.draggedData.groupId, 
                        this.draggedData.index, 
                        targetGroupId, 
                        newIndex
                    );
                }
            }
        }
    }

    handleDragEnd(e) {
        if (e.target) e.target.classList.remove('dragging');
        this.cleanupIndicators();
        this.draggedType = null;
        this.draggedData = null;
    }

    // --- HELPER LOGIC ---

    /**
     * Finds the element immediately after the mouse cursor position.
     */
    getDragAfterElement(container, y, selector) {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // offset: distance from the center of the child
            const offset = y - box.top - box.height / 2;
            
            // We want the element where we are *above* its center (negative offset),
            // but closest to 0 (the largest negative number).
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateDropIndicator(container, afterElement, type) {
        this.cleanupIndicators();

        if (afterElement) {
            afterElement.classList.add('drop-target-top');
        } else {
            // If no after element, we are appending to the bottom of the container
            container.classList.add('drop-target-bottom');
        }
    }

    cleanupIndicators() {
        document.querySelectorAll('.drop-target-top').forEach(el => el.classList.remove('drop-target-top'));
        document.querySelectorAll('.drop-target-bottom').forEach(el => el.classList.remove('drop-target-bottom'));
    }
}