/**
 * FeedbackFlow - Main Process Entry Point
 *
 * Handles:
 * - Window management
 * - Global hotkey registration
 * - IPC communication with renderer
 * - Coordination between capture modules
 */

import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { join } from 'path';
import { IPC_CHANNELS, DEFAULT_SETTINGS, type AppSettings } from '../shared/types';

// Module imports (to be implemented)
// import { CaptureManager } from './capture';
// import { AudioManager } from './audio';
// import { TranscriptionManager } from './transcription';
// import { OutputManager } from './output';
// import { SettingsManager } from './settings';

let mainWindow: BrowserWindow | null = null;
let settings: AppSettings = { ...DEFAULT_SETTINGS };

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerGlobalHotkey(): void {
  const hotkey = settings.globalHotkey || 'CommandOrControl+Shift+F';

  globalShortcut.register(hotkey, () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SESSION_STATUS, { action: 'toggle' });
    }
  });
}

function setupIPC(): void {
  // Session control
  ipcMain.handle(IPC_CHANNELS.START_SESSION, async () => {
    console.log('[Main] Starting feedback session...');
    // TODO: Implement session start
    return { success: true, sessionId: Date.now().toString() };
  });

  ipcMain.handle(IPC_CHANNELS.STOP_SESSION, async () => {
    console.log('[Main] Stopping feedback session...');
    // TODO: Implement session stop
    return { success: true };
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_, newSettings: Partial<AppSettings>) => {
    settings = { ...settings, ...newSettings };
    // Re-register hotkey if changed
    if (newSettings.globalHotkey) {
      globalShortcut.unregisterAll();
      registerGlobalHotkey();
    }
    return settings;
  });

  // Clipboard
  ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, async (_, text: string) => {
    const { clipboard } = await import('electron');
    clipboard.writeText(text);
    return { success: true };
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  registerGlobalHotkey();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
