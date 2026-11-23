// Renderer에 노출하는 최소 API (SER-001: contextIsolation + 허용 채널만)
const { contextBridge, ipcRenderer } = require('electron');

const ON_CHANNELS = ['widget:pop', 'bubble:show', 'input:open', 'settings:changed', 'widget:thinking'];

contextBridge.exposeInMainWorld('jarvis', {
  init: () => ipcRenderer.invoke('widget:init'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('widget:set-ignore-mouse', Boolean(ignore)),
  hide: () => ipcRenderer.send('widget:hide'),
  releaseFocus: () => ipcRenderer.send('widget:release-focus'),
  submitChat: (text) => ipcRenderer.invoke('chat:submit', String(text)),
  bubbleAction: (action) => ipcRenderer.send('bubble:action', String(action)),
  networkChanged: (online) => ipcRenderer.send('network:changed', Boolean(online)),
  on: (channel, fn) => {
    if (!ON_CHANNELS.includes(channel)) throw new Error(`허용되지 않은 채널: ${channel}`);
    const listener = (_e, payload) => fn(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
