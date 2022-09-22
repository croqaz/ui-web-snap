window.addEventListener('load', async function () {
    const mainButton = document.getElementById('btn');
    const inputURL = document.getElementById('inputURL');
    const inputWait = document.getElementById('inputWait');
    const inputTimeout = document.getElementById('inputTimeout');
    const inputImgTime = document.getElementById('inputImgTime');
    const inputJS = document.getElementById('inputJS');
    const inputHeadless = document.getElementById('inputHeadless');
    const inputIframes = document.getElementById('inputIframes');
    const inputGzip = document.getElementById('inputGzip');
    const inputMinify = document.getElementById('inputMinify');
    const inputMetas = document.getElementById('inputMetas');

    mainButton.addEventListener('click', () => {
        const url = inputURL.value.trim();
        if (!url || url.length < 4) return;
        window.electronAPI.recordUrl({
            url,
            wait: parseInt(inputWait.value),
            timeout: parseInt(inputTimeout.inputTimeout),
            imgTimeout: parseInt(inputImgTime.inputImgTime),
            js: inputJS.checked,
            headless: inputHeadless.checked,
            iframes: inputIframes.checked,
            gzip: inputGzip.checked,
            minify: inputMinify.checked,
            extraMeta: inputMetas.checked,
        });
    });

    const restoreBtn = document.getElementById('restoreBtn');
    const restoreFile = document.getElementById('restoreFile');
    const iRestoreJS = document.getElementById('iRestoreJS');
    const iRestoreOff = document.getElementById('iRestoreOffline');
    const iRestoreWait = document.getElementById('iRestoreWait');

    const selectRestoreFile = async (ev) => {
        ev.preventDefault();
        const { canceled, filePaths } = await window.electronAPI.openDialog();
        if (!canceled && filePaths.length) {
            restoreFile.value = filePaths[0];
            window.electronAPI.restoreSnap({
                input: filePaths[0],
                js: iRestoreJS.checked,
                offline: iRestoreOff.checked,
                wait: parseInt(iRestoreWait.value),
            });
        }
    };
    restoreBtn.addEventListener('click', selectRestoreFile);
    restoreFile.addEventListener('click', selectRestoreFile);

    // restore last active tab from config
    const activeTab = (await window.electronAPI.getStoreValue('activeTab')) || 'record-body';
    for (const el of document.querySelectorAll('button[data-bs-toggle="tab"]')) {
        if (el.id === activeTab) {
            new bootstrap.Tab(el).show();
        }
        // save active tab on changing value
        el.addEventListener('shown.bs.tab', async (ev) => {
            await window.electronAPI.setStoreValue('activeTab', ev.target.id);
        });
    }

    // enable all tooltips
    for (const el of document.querySelectorAll('span[data-bs-toggle="tooltip"]')) {
        new bootstrap.Tooltip(el);
    }
});
