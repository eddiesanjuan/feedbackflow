/**
 * Settings Module
 *
 * Handles:
 * - Persistent settings storage
 * - Default values
 * - Settings validation
 */

import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

export class SettingsManager {
  private settingsPath: string;
  private settings: AppSettings;

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'settings.json');
    this.settings = this.load();
  }

  /**
   * Load settings from disk
   */
  private load(): AppSettings {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf-8');
        const loaded = JSON.parse(data);
        // Merge with defaults to ensure all keys exist
        return { ...DEFAULT_SETTINGS, ...loaded };
      }
    } catch (error) {
      console.error('[SettingsManager] Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to disk
   */
  private save(): void {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('[SettingsManager] Failed to save settings:', error);
    }
  }

  /**
   * Get all settings
   */
  getAll(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Update settings
   */
  update(updates: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updates };
    this.save();
    return this.getAll();
  }

  /**
   * Reset to defaults
   */
  reset(): AppSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    return this.getAll();
  }

  /**
   * Validate settings
   */
  validate(settings: Partial<AppSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.screenshotQuality !== undefined) {
      if (settings.screenshotQuality < 1 || settings.screenshotQuality > 100) {
        errors.push('Screenshot quality must be between 1 and 100');
      }
    }

    if (settings.pauseThresholdMs !== undefined) {
      if (settings.pauseThresholdMs < 500 || settings.pauseThresholdMs > 5000) {
        errors.push('Pause threshold must be between 500ms and 5000ms');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default SettingsManager;
