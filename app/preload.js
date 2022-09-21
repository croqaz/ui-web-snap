const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', function () {
    let resourcesTotal = 0;
    const mainButton = document.getElementById('btn');
    const inputURL = document.getElementById('inputURL');

    // from UI to server
    //
    contextBridge.exposeInMainWorld('electronAPI', {
        recordUrl: (opts) => {
            resourcesTotal = 0;
            mainButton.innerHTML = '... &nbsp;<span id="resCount" class="badge bg-danger">0</span>';
            mainButton.disabled = true;
            inputURL.disabled = true;
            ipcRenderer.send('record-url', opts);
        },
    });

    // from server to UI
    //
    ipcRenderer.on('record-resource-type', (_ev, resourceType) => {
        resourcesTotal += 1;
        document.getElementById('resCount').innerHTML = resourcesTotal.toString();
        console.log('Res:', resourceType);
    });

    ipcRenderer.on('record-finished', () => {
        mainButton.innerHTML = 'Record';
        mainButton.disabled = false;
        inputURL.disabled = false;
    });
});
