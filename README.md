# ZenTab

A lightweight, privacy-friendly OneTab alternative built for the Zen (Firefox-based) browser. ZenTab lets you quickly collapse your open tabs into named groups you can search, pin, restore, and manage later - keeping your workspace clean without losing context.

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

## Build
1. Run `npx web-ext build`
2. The zip file is the built extension.

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

## Privacy

- No telemetry. All data lives in your browser’s local extension storage.
- Internal pages (extension dashboard/popup) are never saved or closed.

---

Made for clutter‑free browsing in Zen.