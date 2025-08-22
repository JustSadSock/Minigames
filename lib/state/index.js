// Global state manager for DeepFly
// This module provides simple helpers for managing theme and account data
// across games. It wraps localStorage operations and exposes reactive
// getters/setters for the hub and modules.

const STORAGE_PREFIX = 'deepfly.';

export const state = {
  // Returns the saved account name or a default value
  getAccountName(defaultName = 'Игрок') {
    try {
      const v = localStorage.getItem(`${STORAGE_PREFIX}account.name`);
      return v ? JSON.parse(v) : defaultName;
    } catch (_) {
      return defaultName;
    }
  },
  // Persists the account name
  setAccountName(name) {
    localStorage.setItem(`${STORAGE_PREFIX}account.name`, JSON.stringify(name));
  },
  // Clears the account name
  clearAccountName() {
    localStorage.removeItem(`${STORAGE_PREFIX}account.name`);
  },
  // Gets the current theme (dark/alt). Defaults to 'dark'.
  getTheme(defaultTheme = 'dark') {
    try {
      const v = localStorage.getItem(`${STORAGE_PREFIX}settings.theme`);
      return v ? JSON.parse(v) : defaultTheme;
    } catch (_) {
      return defaultTheme;
    }
  },
  // Saves the current theme
  setTheme(name) {
    localStorage.setItem(`${STORAGE_PREFIX}settings.theme`, JSON.stringify(name));
  }
};