/**
 * FeedbackFlow - Preload Script
 *
 * Exposes a safe API to the renderer process via contextBridge.
 * This is the only way the renderer can communicate with the main process.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type AppSettings, type SessionStatus } from '../shared/types';

/**
 * API exposed to the renderer process
 */
const api = {
  // Session control
  startSession: (): Promise<{ success: boolean; sessionId?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.START_SESSION);
  },

  stopSession: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STOP_SESSION);
  },

  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
  },

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings);
  },

  // Clipboard
  copyToClipboard: (text: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text);
  },

  // Event listeners
  onSessionStatus: (callback: (status: { action: string; status?: SessionStatus }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { action: string; status?: SessionStatus }) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.SESSION_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_STATUS, handler);
  },

  onTranscriptionUpdate: (callback: (data: { text: string; isFinal: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { text: string; isFinal: boolean }) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_UPDATE, handler);
  },

  onScreenshotCaptured: (callback: (data: { id: string; timestamp: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { id: string; timestamp: number }) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.SCREENSHOT_CAPTURED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCREENSHOT_CAPTURED, handler);
  },

  onOutputReady: (callback: (data: { markdown: string; sessionId: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { markdown: string; sessionId: string }) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.OUTPUT_READY, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_READY, handler);
  },

  onOutputError: (callback: (error: { message: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, error: { message: string }) => {
      callback(error);
    };
    ipcRenderer.on(IPC_CHANNELS.OUTPUT_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_ERROR, handler);
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('feedbackflow', api);

// Type declaration for the renderer
declare global {
  interface Window {
    feedbackflow: typeof api;
  }
}
