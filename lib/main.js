const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

// const recordLogic = require('./record');
// const restoreLogic = require('./restore');

var mainWindow;

function getMainWindow() {
    return mainWindow;
}

(async () => {
    await app.whenReady();

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });

    // ipcMain.on('record-url', async (_ev, opts) => {
    //     await recordLogic(opts);
    // });
    // ipcMain.on('restore-url', async (_ev, opts) => {
    //     await restoreLogic(opts);
    // });

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../app/preload.js'),
        },
    });

    mainWindow.loadFile('../app/index.html');
})();

module.exports = { getMainWindow };
