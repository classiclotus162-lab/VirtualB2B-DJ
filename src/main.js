const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#080b10',
    autoHideMenuBar: true,
    title: 'Virtual B2B DJ',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Electron 38 sandboxes preload scripts by default. The preload needs
      // access to the packaged socket.io-client module.
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
