/*
 * Record a page.
 */
import fs from 'fs';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { chromium } from 'playwright';
import { minify } from 'html-minifier-next';
import { ipcMain } from 'electron';

// import fetch from 'cross-fetch';
// import { PlaywrightBlocker } from '@cliqz/adblocker-playwright';

import prettyBytes from './prettyBytes.js';
import { delay, requestKey, normalizeURL, toBool, smartSplit, encodeBody } from './util.js';

var browser;

// abort record with the button from UI
ipcMain.on('abort-record', () => {
    browser.close();
});

export default async function recordLogic(opts) {
    const args = Object.assign(
        {},
        {
            gzip: null, // compress final JSON
            headless: null, // visible browser window
            blockAds: null, // enable AdBlocker?
            blockList: null, // block domains from custom list
            extraMeta: null, // extract meta from HTML?
            iframes: null, // capture iframes?
            js: 'on', // disable JS execution and capturing
            minify: null, // min final HTML before save
            purgeCSS: null, // purge unused CSS and generate 1 single CSS file
            timeout: 15, // navigation timeout
            imgTimeout: 15,
            wait: 5, // wait for user interaction (seconds)
            // headers: 'content-type, date', // Content-Type header is pretty important
            headers: 'content-type, content-length, content-range, date, content-language, last-modified', // extended version
            userAgent: '', // custom user agent
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3',
            dropRequests: '', // drop matching requests
            dropStatus: '', // drop matching statuses
            removeElems: '', // remove page elements
            addCSS: '', // add extra CSS
            console: null, // print browser's console msgs
            innerText: null, // extract page's innerText
            printScreen: null, // save page screenshot
            printScreenQuality: 75, // screenshot quality (1-100)
        },
        opts,
    );

    // { snapshot, page, context, browser }
    const { snapshot, page, browser } = await recordPage(args);

    const { getWebContents } = await import('./main.js');
    const webContents = getWebContents();

    if (!snapshot) {
        console.log('Snapshot is empty!');
        webContents.send('record-finished');
        await browser.close();
        return;
    }

    page.on('close', async () => {
        if (args.minify) {
            const s1 = snapshot.html.length;
            try {
                snapshot.html = await minify(snapshot.html, {
                    caseSensitive: true,
                    collapseBooleanAttributes: true,
                    collapseWhitespace: true,
                    conservativeCollapse: true,
                    continueOnParseError: true,
                    processConditionalComments: true,
                    quoteCharacter: "'",
                    removeAttributeQuotes: true,
                    removeStyleLinkTypeAttributes: true,
                    sortAttributes: true,
                    sortClassName: true,
                });
                const s2 = snapshot.html.length;
                const s3 = prettyBytes(s2, { maximumFractionDigits: 2 });
                console.log(
                    `Body HTML minify efficiency ${((s2 / s1) * 100).toFixed(2)}% from ` +
                        `${Intl.NumberFormat('en').format(s1)} to ${Intl.NumberFormat('en').format(s2)} ` +
                        `(${s3})`,
                );
            } catch (err) {
                console.error('Cannot minify HTML!', err);
            }
        }
        if (args.gzip) {
            const record = await promisify(gzip)(JSON.stringify(snapshot));
            await fs.promises.writeFile(args.OUT, record, { encoding: 'utf8' });
        } else {
            await fs.promises.writeFile(args.OUT, JSON.stringify(snapshot, null, 2), { encoding: 'utf8' });
        }

        webContents.send('record-step', `Snapshot file: "${args.OUT}" was saved`);
        webContents.send('record-finished');
        await browser.close();
    });

    webContents.send('record-step', `Waiting ${args.wait / 1000} sec...`);
    await delay(args.wait);

    // Save the text of the page just before closing the browser,
    // if the user requested it
    if (args.innerText) {
        const textPath = args.OUT.replace(/\.json(\.gz)?$/, '.txt');
        const text = await page.locator('body').innerText();
        await fs.promises.writeFile(textPath, text, { encoding: 'utf8' });
        console.log(`Page text was saved as "${textPath}"`);
    }

    // Take a full page screenshot just before closing the browser,
    // if the user requested it
    if (args.printScreen) {
        const imgPath = args.OUT.replace(/\.json(\.gz)?$/, '.jpg');
        await page.screenshot({ path: imgPath, type: 'jpeg', quality: args.printScreenQuality, fullPage: true });
        console.log(`Page screenshot was saved as "${imgPath}"`);
    }

    await browser.close();
}

async function processArgs(args) {
    args.gzip = toBool(args.gzip);
    args.js = toBool(args.js);
    args.blockAds = toBool(args.blockAds);
    args.extraMeta = toBool(args.extraMeta);
    args.headless = toBool(args.headless);
    args.iframes = toBool(args.iframes);
    args.minify = toBool(args.minify);
    args.purgeCSS = toBool(args.purgeCSS);

    args.wait = parseInt(args.wait) * 1000;
    args.timeout = parseInt(args.timeout) * 1000;
    args.imgTimeout = parseInt(args.imgTimeout) * 1000;

    args.DROP = smartSplit(args.dropRequests).map((x) => new RegExp(x, 'i'));
    args.HEADERS = smartSplit(args.headers).map((x) => x.toLowerCase());
    args.REMOVE = smartSplit(args.removeElems);
    args.CSS = args.addCSS ? args.addCSS.trim() : '';

    args.DROPST = smartSplit(args.dropStatus).map((x) => new RegExp(x.replace(/x/gi, '\\d')));
    if (args.blockList) {
        const blockList = await fs.promises.readFile(args.blockList, { encoding: 'utf8' });
        args.DROPLI = blockList
            .split('\n')
            .map((x) => x.trim().replace(/\/+$/, ''))
            .filter((x) => x && !x.startsWith('#') && x.length > 5)
            .map((x) => new RegExp(`^https?://(www\.|m\.)?${x}/.+`, 'i'));
        console.log(`Loaded ${args.DROPLI.length} drop list domains from file`);
    }

    args.URI = args._ ? args._[0] : null || args.input || args.url;
    let HOST = new URL(args.URI).host;
    if (HOST.startsWith('www.')) HOST = HOST.slice(4);
    let OUT = args._ ? args._[1] : null || args.output;
    if (!OUT) OUT = `snapshot_${HOST}.json`;
    if (args.gzip && !OUT.endsWith('.gz')) OUT += '.gz';
    args.OUT = OUT;
    // console.log('ARGS:', args);
}

async function recordPage(args) {
    await processArgs(args);

    // only Chromium supported for now
    browser = await chromium.launch({ headless: args.headless });
    const context = await browser.newContext({
        javaScriptEnabled: args.js,
        userAgent: args.userAgent,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        serviceWorkers: 'block',
        viewport: null,
    });
    const page = await context.newPage();

    // if (args.blockAds) {
    //     const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
    //     await blocker.enableBlockingInPage(page);
    // }

    let snapshot;
    try {
        snapshot = await internalRecordPage(args, page);
    } catch {}

    return { snapshot, page, context, browser };
}

async function internalRecordPage(args, page) {
    const { URI, DROP, DROPLI, DROPST, HEADERS, REMOVE, CSS } = args;

    if ((DROP && DROP.length) || (DROPLI && DROPLI.length)) {
        const block = [...DROP, ...DROPLI];
        page.route('**', async (route) => {
            const r = route.request();
            const u = normalizeURL(r.url());
            for (const re of block) {
                if (re.test(u)) {
                    console.warn('Drop matching request:', re, u);
                    route.abort();
                    return;
                }
            }
            route.continue();
        });
    }

    let snapshot = { url: URI, base_url: '', html: '', responses: {} };
    if (args.extraMeta) {
        snapshot = {
            url: URI,
            base_url: '',
            canonical_url: '',
            date: new Date().toISOString(),
            title: '',
            html: '',
            responses: {},
        };
    }

    const { getWebContents } = await import('./main.js');
    const webContents = getWebContents();

    page.on('response', async (response) => {
        const r = response.request();
        const u = normalizeURL(r.url());
        if (u.startsWith('data:')) {
            return;
        }
        // ignore the index page, it will be saved at the end
        if (u === normalizeURL(URI)) return;

        const status = response.status();
        if (DROPST && DROPST.length) {
            for (const re of DROPST) {
                if (re.test(status.toString())) {
                    console.warn('Drop matching status:', re, status);
                    return;
                }
            }
        } else {
            // ignore redirect requests, they will be saved after resolved
            if (status >= 300 && status < 400) {
                console.warn('Redirect from:', u, 'to:', response.headers()['location']);
                return;
            }
            // allow all the other statuses
        }

        const key = requestKey(r);
        console.log('Response:', status, key);

        // restrict headers to subset
        let headers = Object.entries(response.headers()).filter(([key]) => HEADERS.includes(key));
        headers = Object.fromEntries(headers);
        const contentType = headers['content-type'];
        const resourceType = r.resourceType();

        let body;
        try {
            const buffer = await response.body();
            body = encodeBody(resourceType, contentType, buffer);
        } catch (err) {
            const frame = page.frame({ url: u });
            if (frame && args.iframes) {
                console.log('Capture IFRAME content for:', frame.url());
                const content = (await frame.content()).trim();
                body = encodeBody(resourceType, contentType, new Buffer.from(content, 'utf-8'));
            } else if (status !== 204) {
                console.error('ERR saving response for:', status, u, err);
            }
        }

        // emit to client
        webContents.send('record-resource-type', resourceType);

        // if the request was NOT cached, or it WAS cached
        // and the new request is successful (overwrite with fresh data)
        if (!snapshot.responses[key] || (snapshot.responses[key] && snapshot.responses[key].status === 200)) {
            snapshot.responses[key] = {
                body,
                headers,
                request_url: u,
                status,
            };
            if (u !== response.url()) {
                snapshot.responses[key] = {
                    response_url: response.url(),
                };
            }
        }
    });

    // emit to client
    webContents.send('record-step', 'Started recording...');

    try {
        console.log('Waiting for the page to load...');
        await page.goto(URI, { timeout: args.timeout, waitUntil: 'networkidle' });
    } catch (err) {
        console.error('Wait timeout:', err);
    }

    webContents.send('record-step', 'Navigation finished, waiting for images...');

    // initial snapshot
    try {
        snapshot.html = (await page.content()).trim();
    } catch (err) {
        throw `Cannot capture page HTML: ${err}`;
    }

    const imgCount = await page.locator('img').count();
    if (imgCount > 0) {
        try {
            console.log('Waiting for images to load...');
            await page.waitForSelector('img', { timeout: args.imgTimeout });
        } catch (err) {
            console.error('Images timeout:', err);
        }
    }

    webContents.send('record-step', 'Images loaded, post-processing...');

    // resolved base URL
    snapshot.base_url = await page.evaluate('document.baseURI');

    if (args.extraMeta) {
        snapshot.title = (await page.title()).trim();
        // resolved canonical URL
        snapshot.canonical_url = await page.evaluate(
            `(document.querySelector("link[rel='canonical']") || document.createElement('link')).getAttribute('href')`,
        );
        if (!snapshot.canonical_url) delete snapshot.canonical_url;
    }

    // delete possible index duplicates, when user URL != resolved URL
    let baseKey = `GET:${snapshot.base_url}`;
    if (snapshot.responses[baseKey] && snapshot.responses[baseKey].body) {
        delete snapshot.responses[baseKey];
    }
    if (snapshot.canonical_url) {
        baseKey = `GET:${snapshot.canonical_url}`;
        if (snapshot.responses[baseKey] && snapshot.responses[baseKey].body) {
            delete snapshot.responses[baseKey];
        }
    }
    baseKey = null;

    for (const selector of REMOVE) {
        console.log('Removing element selector:', selector);
        await page.evaluate((s) => {
            for (const el of document.querySelectorAll(s)) {
                el.parentNode.removeChild(el);
            }
        }, selector);
    }

    if (CSS && CSS.length) {
        console.log('Adding custom CSS...');
        await page.evaluate((css) => {
            const cssHack = document.createElement('style');
            cssHack.className = 'hack';
            cssHack.innerText = css;
            document.head.appendChild(cssHack);
        }, CSS);
    }

    // second snapshot
    try {
        snapshot.html = (await page.content()).trim();
    } catch (err) {
        console.log(`Cannot capture page HTML: ${err}`);
        return snapshot;
    }

    if (args.purgeCSS) {
        console.log('Purging unused CSS...');
        // TODO
    }

    return snapshot;
}
