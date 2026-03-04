// ============================================================
// 🦀 Krab — Desktop Application Entry Point
// ============================================================
import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Main window
let mainWindow: BrowserWindow | null = null;

// Development mode
const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset', // macOS style
    show: false // Don't show until ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create menu
function createMenu(): void {
  const template: any[] = [
    {
      label: '🦀 Krab',
      submenu: [
        {
          label: 'About Krab',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Krab',
              message: '🦀 Krab - AGI Agent Framework\n\nThe lighter, smarter cousin\n\nVersion: ' + process.env.npm_package_version || '1.0.0',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Chat',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('new-chat');
          }
        },
        {
          label: 'Clear History',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            mainWindow?.webContents.send('clear-history');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Voice Settings',
          click: () => {
            mainWindow?.webContents.send('open-voice-settings');
          }
        },
        {
          label: 'Web Tools',
          click: () => {
            mainWindow?.webContents.send('open-web-tools');
          }
        },
        {
          label: 'System Monitor',
          click: () => {
            mainWindow?.webContents.send('open-system-monitor');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.reload();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow?.webContents.setZoomLevel(0);
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const currentZoom = mainWindow?.webContents.getZoomLevel() || 0;
            mainWindow?.webContents.setZoomLevel(currentZoom + 0.5);
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const currentZoom = mainWindow?.webContents.getZoomLevel() || 0;
            mainWindow?.webContents.setZoomLevel(currentZoom - 0.5);
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            mainWindow?.minimize();
          }
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow?.close();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
function setupIpcHandlers(): void {
  // Get app version
  ipcMain.handle('app-version', () => {
    return process.env.npm_package_version || '1.0.0';
  });

  // Get system info
  ipcMain.handle('system-info', async () => {
    const os = await import('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length
    };
  });

  // Execute CLI command
  ipcMain.handle('execute-command', async (event, command: string, args: string[] = []) => {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          output: output.trim(),
          error: errorOutput.trim()
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  });

  // Open external URL
  ipcMain.handle('open-external', (event, url: string) => {
    shell.openExternal(url);
  });

  // Show save dialog
  ipcMain.handle('show-save-dialog', async (event, options: any) => {
    const result = await dialog.showSaveDialog(mainWindow!, options);
    return result;
  });

  // Show open dialog
  ipcMain.handle('show-open-dialog', async (event, options: any) => {
    const result = await dialog.showOpenDialog(mainWindow!, options);
    return result;
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();
  setupIpcHandlers();

  // Set app user model ID for macOS
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      copyright: '© 2026 Krab Team',
      version: process.env.npm_package_version || '1.0.0'
    });
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAll().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle protocol links (krab://)
app.setAsDefaultProtocolClient('krab');

app.on('open-url', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('protocol-url', url);
  }
});

export { mainWindow };
