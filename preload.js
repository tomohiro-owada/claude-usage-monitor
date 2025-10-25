const { contextBridge, ipcRenderer } = require('electron');

// Renderer process (settings.html) にAPI を公開
contextBridge.exposeInMainWorld('electronAPI', {
  saveCurlSettings: (curlCommand) => ipcRenderer.invoke('save-curl-settings', curlCommand),
  closeSettings: () => ipcRenderer.send('close-settings')
});
