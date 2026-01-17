# ZenTab

A lightweight, privacy-friendly OneTab alternative built for the Zen (Firefox-based) browser. ZenTab lets you quickly collapse your open tabs into named groups you can search, pin, restore, and manage later — keeping your workspace clean without losing context.

## Highlights

- Save current/selected/workspace/all tabs via context menu and shortcuts
- Restore groups into the current window or a new window
- Pin groups to keep them safe during bulk cleanups
- Rename groups, search across titles and URLs, and open individual tabs
- Optional "consume on open" to remove a tab from the group when opened
- Automatic or manual de-duplication across all groups
- Blacklist/whitelist domain filtering to control what gets saved
- Backup/restore to JSON and OneTab-style import/export
- Everything is stored locally via `browser.storage.local`

## Install (Zen/Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on" and pick this folder's `manifest.json`.
3. The extension will be loaded until you restart the browser.

## Usage

- Toolbar: Click the ZenTab icon to open the Dashboard/Settings.
- Context menu: Right‑click on any page or tab to send tabs:
  - Send Current Tab
  - Send Selected Tabs (multi‑select)
  - Send Workspace Tabs (visible)
  - Send Window Tabs (all in window)
- Keyboard shortcuts:
  - Save Selected: Alt+Shift+S
  - Save All (Window): Alt+Shift+A

## Dashboard

Manage your saved tab groups:

- Restore: Open all tabs in the group (keeps pinned groups; deletes unpinned after restore).
- Restore to New Window: Open all tabs in a fresh window.
- Pin/Unpin: Protect groups from bulk deletion.
- Rename: Click the group title to set a custom name.
- Delete + Undo: Remove a group, then undo from the toast.
- Open Single Tab: Click a tab to open it. If "consume on open" is enabled, it is removed from the group.
- Search: Filter groups by title and tab titles/URLs.
- Clear All: Remove all unpinned groups; pinned groups remain.
- Deduplicate: Remove duplicate URLs across groups, keeping pinned and newer items.

## Filtering

Control what gets saved using blacklist or whitelist mode:

- Blacklist: Domains in the list are never saved.
- Whitelist: Only domains in the list are saved.
- Quick toggle: From the popup, add/remove the current site from the active list.

## Backup & Import/Export

- Export JSON: Manual backup to a `.json` file containing groups and basic filter settings.
- Import JSON: Restore from a backup file; new groups are merged without clobbering IDs.
- Auto Backup: Enable scheduled backups in Settings (hours/days/weeks).
- OneTab Import: Paste OneTab‑style lines (`URL | Title`) to create a new group.
- OneTab Export: Generate OneTab‑style text from your current groups.

## Settings

- Show Favicons: Toggle favicon display in the Dashboard.
- Consume on Open: Remove a tab from its group when you open it.
- Auto Deduplicate: Clean duplicates automatically after new saves.
- Backup: Enable interval, value, and unit; run export now; import from file.
- Filter Mode: Switch between blacklist and whitelist; add/remove domains.

## Permissions

ZenTab requests:

- `tabs`: Query and restore browser tabs.
- `storage`: Persist groups and settings locally.
- `alarms`: Schedule automatic backups.
- `downloads`: Save backup files.
- `contextMenus`: Add right‑click actions.

## Project Structure

- `background.js`: Context menus, commands, message routing, and backup scheduler.
- `popup.html` / `popup.js`: Quick actions and domain filtering toggle.
- `options.html` / `options.js`: Dashboard (groups), search, settings, backup UI.
- `modules/`
  - `tab-manager.js`: Save, restore, delete, pin, rename, dedupe, and filters on URL.
  - `settings-manager.js`: Filter mode, domain lists, general/backup settings.
  - `storage.js`: Local storage read/write and import merge logic.
  - `backup-manager.js`: JSON backup/restore and OneTab import/export.
  - `ui-renderer.js`: DOM helpers for the Dashboard and toasts.
  - `utils.js`: Hostname extraction and debounce.
  - `constants.js`: Keys, defaults, message IDs, command IDs.

## Privacy

- No telemetry. All data lives in your browser’s local extension storage.
- Internal pages (extension dashboard/popup) are never saved or closed.

---

Made for clutter‑free browsing in Zen.