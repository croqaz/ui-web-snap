const path = require('path');
const { app, dialog, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');

const calcStats = require('./stats');
const recordLogic = require('./record');
const restoreLogic = require('./restore');

var mainWindow;

function getWebContents() {
    return mainWindow.webContents;
}

(async () => {
    app.name = 'ui-web-snap';
    app.productName = 'UI web-snap';

    await app.whenReady();

    Store.initRenderer();
    const store = new Store({ name: 'ui-config' });

    // Open a window if none are open, macOS
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });

    // UI config store
    ipcMain.handle('get-store-value', (_ev, key) => {
        return store.get(key);
    });
    ipcMain.handle('set-store-value', (_ev, key, value) => {
        return store.set(key, value);
    });

    // record & restore logic
    ipcMain.on('record-url', async (_ev, opts) => {
        await recordLogic(opts);
    });
    ipcMain.on('restore-snap', async (_ev, opts) => {
        await restoreLogic(opts);
    });
    ipcMain.handle('snap-stats', async (_ev, opts) => {
        return await calcStats(opts);
    });

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../app/preload.js'),
        },
    });

    // manage dialog windows
    ipcMain.handle('show-open-dialog', async (_ev, opts = {}) => {
        opts.properties = ['openFile'];
        return await dialog.showOpenDialog(mainWindow, opts);
    });

    mainWindow.loadFile(path.join(__dirname, '../app/index.html'));
})();

module.exports = { getWebContents };
