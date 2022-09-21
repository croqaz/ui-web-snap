window.addEventListener('load', function () {
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
});
