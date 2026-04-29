const fs = require('fs');
const path = require('path');
const mainPath = path.join(__dirname, 'src', 'main', 'main.js');
let content = fs.readFileSync(mainPath, 'utf8');

if (!content.includes('Menu.setApplicationMenu')) {
  // Add Menu to the electron require
  content = content.replace(
    /const \{ app, BrowserWindow, ipcMain \} = require\('electron'\)/,
    "const { app, BrowserWindow, ipcMain, Menu } = require('electron')"
  );

  // Create menu before createWindow
  const menuCode = `
function createMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { ...(isMac ? { role: 'pasteAndMatchStyle' } : {}) },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/* ═══════════════════════════`;

  content = content.replace('/* ═══════════════════════════\n   Window', menuCode + '\n   Window');
  
  content = content.replace('initializeBrain()', 'initializeBrain()\n  createMenu()');
  
  fs.writeFileSync(mainPath, content);
  console.log('Menu added to main.js');
} else {
  console.log('Menu already exists');
}
