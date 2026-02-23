const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isElectron', true);

contextBridge.exposeInMainWorld('electronAPI', {
    getAudioSources: () => ipcRenderer.invoke('audio:get-sources')
});

contextBridge.exposeInMainWorld('spoutAPI', {
  isAvailable: () => ipcRenderer.invoke('spout:check-available'),
  enable: (options) => ipcRenderer.invoke('spout:enable', options),
  disable: () => ipcRenderer.invoke('spout:disable'),
  getStatus: () => ipcRenderer.invoke('spout:get-status'),
  updateName: (name) => ipcRenderer.invoke('spout:update-name', name),
  updateFrameSkip: (skip) => ipcRenderer.invoke('spout:update-frame-skip', skip),
  onStatusChange: (callback) => {
    ipcRenderer.on('spout:status-changed', (event, enabled) => callback(enabled));
  },
  onSceneRequest: (callback) => {
    ipcRenderer.on('spout:request-scene', () => callback());
  },
  syncSettings: (settings) => ipcRenderer.send('sync:settings', settings),
  syncAudio: (audioData) => ipcRenderer.send('sync:audio', audioData),
  syncScene: (sceneType) => ipcRenderer.send('sync:scene', sceneType),
  syncTime: (elapsedTime) => ipcRenderer.send('sync:time', elapsedTime)
});

contextBridge.exposeInMainWorld('spoutSync', {
    onSettings: (callback) => {
        ipcRenderer.on('sync:settings', (event, settings) => callback(settings));
    },
    onAudio: (callback) => {
        ipcRenderer.on('sync:audio', (event, audioData) => callback(audioData));
    },
    onScene: (callback) => {
        ipcRenderer.on('sync:scene', (event, sceneType) => callback(sceneType));
    },
    onTime: (callback) => {
        ipcRenderer.on('sync:time', (event, elapsedTime) => callback(elapsedTime));
    }
});
