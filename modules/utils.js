/**
 * Extracts the hostname from a URL string.
 * @param {string} url 
 * @returns {string|null} The hostname or null if invalid/internal.
 */
export function getHostname(url) {
    if (!url || !url.startsWith('http')) return null;
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

/**
 * Simple debounce function for search inputs.
 * @param {Function} func 
 * @param {number} wait 
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Helper to create DOM elements with attributes and children.
 * Removed 'html' support to prevent innerHTML validation warnings.
 * @param {string} tag - HTML tag
 * @param {Object} [attributes] - Class, ID, styles, event listeners
 * @param {Array<HTMLElement|string>} [children] - Child elements or text
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'text') {
            el.textContent = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(el.dataset, value);
        } else {
            // Standard attributes (href, src, draggable, etc.)
            el.setAttribute(key, value);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });

    return el;
}