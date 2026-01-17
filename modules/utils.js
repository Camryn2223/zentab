/**
 * Extracts the hostname from a URL string or object.
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