export const STORAGE_KEYS = {
    TAB_GROUPS: 'tabGroups',
    FILTER_MODE: 'filterMode',
    BLACKLIST: 'blacklistedDomains',
    WHITELIST: 'whitelistedDomains',
    GENERAL_SETTINGS: 'generalSettings',
    BACKUP_SETTINGS: 'backupSettings'
};

export const MODES = {
    BLACKLIST: 'blacklist',
    WHITELIST: 'whitelist'
};

export const MESSAGES = {
    SAVE_TABS: 'saveTabs',
    REFRESH_UI: 'refreshUi',
    SCHEDULE_BACKUP: 'scheduleBackup',
    PERFORM_BACKUP: 'performBackup'
};

export const CM_IDS = {
    SAVE_CURRENT: 'cm-save-current',
    SAVE_SELECTED: 'cm-save-selected',
    SAVE_WORKSPACE: 'cm-save-workspace',
    SAVE_ALL: 'cm-save-all',
    OPEN_DASHBOARD: 'cm-open-dashboard'
};

export const COMMANDS = {
    SAVE_SELECTED: 'save-selected',
    SAVE_ALL: 'save-all'
};

export const DEFAULTS = {
    FILTER_MODE: MODES.BLACKLIST,
    BLACKLIST: [],
    WHITELIST: [],
    TAB_GROUPS: [],
    GENERAL_SETTINGS: {
        showFavicons: true,
        darkMode: true,
        autoDeduplicate: false,
        consumeOnOpen: true
    },
    BACKUP_SETTINGS: {
        enabled: false,
        intervalValue: 1,
        intervalUnit: 'days',
    }
};

export const BACKUP_CONFIG = {
    VERSION: '1.3.0',
    ALARM_NAME: 'zentab-auto-backup'
};