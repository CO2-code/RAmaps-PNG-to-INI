// Preload script for RAnderer Electron Desktop App
// Exposes secure IPC communication channels between React renderer and Node.js main process

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  validateTinyPng: (apiKey) => ipcRenderer.invoke('tinypng-validate', apiKey),
  compressTinyPng: (payload) => ipcRenderer.invoke('tinypng-compress', payload),
  exitApp: () => ipcRenderer.invoke('app-exit'),
});
