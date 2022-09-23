window.addEventListener('load', async function () {
    const mainButton = document.getElementById('btn');
    const inputURL = document.getElementById('inputURL');
    const inputWait1 = document.getElementById('inputWait1');
    const inputTimeout = document.getElementById('inputTimeout');
    const inputImgTime = document.getElementById('inputImgTime');
    const inputJS1 = document.getElementById('inputJS1');
    const inputHeadless = document.getElementById('inputHeadless');
    const inputIframes = document.getElementById('inputIframes');
    const inputGzip = document.getElementById('inputGzip');
    const inputMinify = document.getElementById('inputMinify');
    const inputMetas = document.getElementById('inputMetas');

    mainButton.addEventListener('click', () => {
        const url = inputURL.value.trim();
        if (mainButton.innerText === 'Abort') {
            window.electronAPI.abortRecord();
            return;
        }
        if (!url || !/^https?:\/\/[^ "]+\./.test(url)) {
            inputURL.classList.add('is-invalid');
            return;
        };
        inputURL.classList.remove('is-invalid');
        window.electronAPI.recordUrl({
            url,
            wait: parseInt(inputWait1.value),
            timeout: parseInt(inputTimeout.inputTimeout),
            imgTimeout: parseInt(inputImgTime.inputImgTime),
            js: inputJS1.checked,
            headless: inputHeadless.checked,
            iframes: inputIframes.checked,
            gzip: inputGzip.checked,
            minify: inputMinify.checked,
            extraMeta: inputMetas.checked,
        });
    });

    const restoreBtn = document.getElementById('restoreBtn');
    const restoreFile = document.getElementById('restoreFile');
    const inputJS2 = document.getElementById('inputJS2');
    const inputWait2 = document.getElementById('inputWait2');
    const inputOffline = document.getElementById('inputOffline');

    const selectRestoreFile = async (ev) => {
        ev.preventDefault();
        const { canceled, filePaths } = await window.electronAPI.openDialog();
        if (!canceled && filePaths.length) {
            const txtInput = ev.target.parentElement.querySelector('input[type="text"]');
            txtInput.value = filePaths[0];
            window.electronAPI.restoreSnap({
                input: filePaths[0],
                js: inputJS2.checked,
                offline: inputOffline.checked,
                wait: parseInt(inputWait2.value),
            });
        }
    };

    restoreBtn.addEventListener('click', selectRestoreFile);
    restoreFile.addEventListener('click', selectRestoreFile);

    const statsBtn = document.getElementById('statsBtn');
    const statsFile = document.getElementById('statsFile');
    const snapStats = document.getElementById('snapStats');
    const resBySize = document.getElementById('resBySize');
    const resByType = document.getElementById('resByType');

    const selectStatsFile = async (ev) => {
        ev.preventDefault();
        const { canceled, filePaths } = await window.electronAPI.openDialog();
        if (canceled || !filePaths.length) {
            return;
        }
        const txtInput = ev.target.parentElement.querySelector('input[type="text"]');
        txtInput.value = filePaths[0];
        const snap = await window.electronAPI.snapStats({ input: filePaths[0] });

        let resourceTypes = {};
        let maxValue = Math.max(...Object.values(snap.responses).map((v) => v.body));
        const data = Object.entries(snap.responses)
            .map(([k, v]) => {
                const t = v.resType;
                if (resourceTypes[t]) resourceTypes[t] += 1;
                else resourceTypes[t] = 1;
                return [k, v.body, v.bodySz];
            })
            .filter(([_, v]) => v >= maxValue / 20 && v > 100);
        data.push(['GET:HTML body', snap.html, snap.htmlSz]);

        let html = '';
        if (snap.url)
            html += `<li class="list-group-item">User URL: <a href="${snap.url}" rel="noopener" target="_blank">${snap.url}</a></li>`;
        if (snap.base_url)
            html += `<li class="list-group-item">Base URL: <a href="${snap.base_url}" rel="noopener" target="_blank">${snap.base_url}</a></li>`;
        if (snap.title) html += `<li class="list-group-item">Title: ${snap.title}</li>`;
        if (snap.date) html += `<li class="list-group-item">Date: ${snap.date}</li>`;
        html += `<li class="list-group-item">HTML body size: ${snap.htmlSz}</li>`;
        html += `<li class="list-group-item">No of resources: ${Object.keys(snap.responses).length}</li>`;
        snapStats.innerHTML = html;

        // top resources by size
        data.sort((a, b) => b[1] - a[1]);
        html = '';
        for (const [txt, nr, sz] of data.slice(0, 10)) {
            let http = txt.split(':').slice(1).join(':');
            http = http.replace(/^https?:\/\/(w+?\.)?/, '');
            if (http.length > 85) http = http.slice(0, 80) + ' ... ' + http.slice(-5);
            const barLength = (nr * 100) / maxValue;
            html += `<small class="text-muted">${http}</small> <small>(${sz})</small><div class="progress mb-1">
              <div class="progress-bar" role="progressbar" style="width:${barLength}%;" aria-valuenow="${nr}" aria-valuemin="0" aria-valuemax="${maxValue}"></div>
            </div>`;
        }
        resBySize.innerHTML = html;
        resBySize.parentElement.classList.remove('d-none');

        // resources by type
        resourceTypes = Array.from(Object.entries(resourceTypes));
        resourceTypes.sort((a, b) => b[1] - a[1]);
        maxValue = resourceTypes[0][1];
        html = '';
        for (const [txt, nr] of resourceTypes) {
            const barLength = (nr * 100) / maxValue;
            html += `<span>${txt}</span><div class="progress mb-1">
              <div class="progress-bar" role="progressbar" style="width:${barLength}%;" aria-valuenow="${nr}" aria-valuemin="0" aria-valuemax="${maxValue}">${nr}</div>
            </div>`;
        }
        resByType.innerHTML = html;
        resByType.parentElement.classList.remove('d-none');
    };

    statsBtn.addEventListener('click', selectStatsFile);
    statsFile.addEventListener('click', selectStatsFile);

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

    // persist input values on disk, on change
    for (const el of document.getElementsByTagName('input')) {
        if (el.type !== 'checkbox' && el.type !== 'number') continue;
        // restore old value
        const value = await window.electronAPI.getStoreValue(el.id);
        if (value !== null && value !== undefined) {
            if (el.type === 'checkbox') el.checked = value;
            else if (el.type === 'number') el.value = value;
        }
        // wait for changes
        el.addEventListener('change', async (ev) => {
            if (ev.currentTarget.type === 'checkbox') {
                const { id, checked } = ev.currentTarget;
                await window.electronAPI.setStoreValue(id, checked);
            } else if (ev.currentTarget.type === 'number') {
                const { id, value } = ev.currentTarget;
                await window.electronAPI.setStoreValue(id, value);
            }
        });
    }

    // enable all tooltips
    for (const el of document.querySelectorAll('span[data-bs-toggle="tooltip"]')) {
        new bootstrap.Tooltip(el);
    }
});
