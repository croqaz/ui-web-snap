const path = require('path');
const { app, dialog, BrowserWindow, ipcMain } = require('electron');

const recordLogic = require('./record');
const restoreLogic = require('./restore');

var mainWindow;

function getWebContents() {
    return mainWindow.webContents;
}

(async () => {
    await app.whenReady();

    // // Open a window if none are open, macOS
    // app.on('activate', () => {
    //     if (BrowserWindow.getAllWindows().length === 0) createWindow();
    // });

    // // Quit when all windows are closed, except on macOS
    // app.on('window-all-closed', function () {
    //     if (process.platform !== 'darwin') app.quit();
    // });

    ipcMain.on('record-url', async (_ev, opts) => {
        await recordLogic(opts);
    });
    ipcMain.on('restore-snap', async (_ev, opts) => {
        await restoreLogic(opts);
    });

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../app/preload.js'),
        },
    });

    ipcMain.handle('show-open-dialog', async (_ev, opts = {}) => {
        opts.properties = ['openFile'];
        return await dialog.showOpenDialog(mainWindow, opts);
    });

    mainWindow.loadFile('../app/index.html');
})();

module.exports = { getWebContents };
