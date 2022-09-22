const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', function () {
    let resourcesTotal = 0;
    const mainButton = document.getElementById('btn');
    const inputURL = document.getElementById('inputURL');
    const inputAddon = document.getElementById('inputAddon');
    const restoreFile = document.getElementById('restoreFile');

    // from UI to server
    //
    contextBridge.exposeInMainWorld('electronAPI', {
        recordUrl: (opts) => {
            resourcesTotal = 0;
            inputAddon.classList.remove('d-none');
            mainButton.classList.remove('btn-primary');
            mainButton.classList.add('btn-danger');
            mainButton.innerHTML = 'Abort';
            inputURL.disabled = true;
            ipcRenderer.send('record-url', opts);
        },
        restoreSnap: (opts) => {
            restoreFile.disabled = true;
            ipcRenderer.send('restore-snap', opts);
        },
        getStoreValue: (k) => ipcRenderer.invoke('get-store-value', k),
        setStoreValue: (k, v) => ipcRenderer.invoke('set-store-value', k, v),
        openDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
    });

    // from server to UI
    //
    ipcRenderer.on('record-resource-type', (_ev, resourceType) => {
        resourcesTotal += 1;
        inputAddon.innerText = resourcesTotal.toString();
        console.log('Res:', resourceType);
    });

    ipcRenderer.on('record-finished', () => {
        inputAddon.classList.add('d-none');
        mainButton.classList.remove('btn-danger');
        mainButton.classList.add('btn-primary');
        mainButton.innerHTML = 'Record';
        inputURL.disabled = false;
    });

    ipcRenderer.on('restore-finished', () => {
        restoreFile.disabled = false;
    });
});
