import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const allowedInvokeChannels = new Set([
  "session:start",
  "session:stop",
  "session:cancel",
  "session:reset",
  "session:getState",
  "session:getSession",
  "transcription:isModelReady",
  "transcription:downloadModel",
  "transcription:getConfig",
  "transcription:setConfig",
  "clipboard:write",
  "clipboard:read",
  "recovery:check",
  "recovery:recover",
  "recovery:discard",
  "screenshot:capture",
  "screenshot:getCount",
]);

const allowedOnChannels = new Set([
  "session:stateChanged",
  "transcription:downloadProgress",
  "recovery:found",
  "screenshot:captured",
  "tray:startRecording",
  "tray:openSettings",
]);

const allowedSendChannels = new Set<string>();

const ensureAllowed = (allowed: Set<string>, channel: string) => {
  if (!allowed.has(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
};

const api = {
  send: (channel: string, ...args: unknown[]) => {
    ensureAllowed(allowedSendChannels, channel);
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: unknown[]) => {
    ensureAllowed(allowedInvokeChannels, channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ensureAllowed(allowedOnChannels, channel);
    const subscription = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error - window types not available in preload context
  window.electron = electronAPI;
  // @ts-expect-error - window types not available in preload context
  window.api = api;
}
