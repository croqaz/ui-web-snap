/*
 * Restore a recorded page.
 */
const { chromium } = require('playwright');

const { delay, requestKey, normalizeURL, toBool, smartSplit, loadSnapshot, decodeBody } = require('./util.js');

module.exports = async function restoreLogic(opts) {
    const args = Object.assign({},
        {
            js: 'yes', // JS execution on restore
            offline: 'yes', // force browser offline
            timeout: 15, // navigation timeout
            wait: 120, // keep the browser open (seconds)
            overwrite: null, // overwrite body HTML with HTML from snapshot
            removeElems: '', // remove page elements
        },
        opts,
    );
    // console.log('ARGS:', args);

    const { page, browser } = await restorePage(args);

    const { getWebContents } = require('./main');
    const webContents = getWebContents();

    page.on('close', () => {
        webContents.send('restore-finished');
        console.log('Restore snap finished');
        browser.close();
    });

    console.log(`Waiting ${args.wait / 1000} sec...`);
    await delay(args.wait);
    await browser.close();
};

async function processArgs(args) {
    args.js = toBool(args.js);
    // args.headless = toBool(args.headless); // debug & tests
    args.offline = toBool(args.offline);
    args.timeout = parseInt(args.timeout) * 1000;
    args.wait = parseInt(args.wait) * 1000;
    args.REMOVE = smartSplit(args.removeElems);

    const snap = args._ ? args._[0] : null || args.input;
    if (snap) {
        args.RECORD = await loadSnapshot(snap);
    }
}

async function restorePage(args) {
    await processArgs(args);
    const record = args.RECORD;

    if (!record || !record.responses) {
        console.error('Invalid snapshot file! Cannot launch!');
        return;
    }

    const URL = normalizeURL(record.url || record.base_url);
    console.log('Restoring URL:', URL);

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--allow-running-insecure-content',
            '--disable-background-networking',
            '--disable-breakpad',
            '--disable-crash-reporter',
            '--disable-default-apps',
            '--disable-demo-mode',
            '--disable-extensions',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
            '--disable-speech-api',
            '--disable-sync',
            '--disable-web-security',
        ],
    });

    const context = await browser.newContext({
        bypassCSP: true,
        acceptInsecureCerts: true,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: args.js,
        offline: args.offline,
        // serviceWorkers: 'block',
        viewport: null,
    });

    const page = await context.newPage();

    page.on('console', async (msg) => {
        if (msg.text().startsWith('Failed to load resource')) return;
        console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
    });

    page.setDefaultTimeout(args.timeout);
    await context.route('**', async (route) => {
        const r = route.request();
        const u = normalizeURL(r.url());

        if (u === URL) {
            console.log(`Restored INDEX from CACHE: ${u}`);
            route.fulfill({
                contentType: 'text/html; charset=utf-8',
                body: record.html,
            });
            return;
        }

        const key = requestKey(r);
        const cached = record.responses[key];
        if (cached && cached.status) {
            // ignore all javascript requests on restore, when JS disabled
            const contentType = cached.headers['content-type'];
            if (
                !args.js &&
                (contentType.startsWith('text/javascript') ||
                    contentType.startsWith('application/javascript') ||
                    contentType.startsWith('application/x-javascript'))
            ) {
                // HTTP 204 = NO CONTENT
                route.fulfill({ status: 204 });
                return;
            }
            console.log(`Restored from CACHE: ${key}`);
            route.fulfill({
                contentType: contentType || '',
                body: decodeBody(cached.body),
                status: record.status,
                headers: cached.headers, // Some headers may be useful here
            });
            return;
        }

        // else
        console.log(`MISSING resource: ${key}`);
        route.continue(); // or abort ??
    });

    // navigate to the resolved URL instead of the user provided one
    await page.goto(record.base_url || record.url, { waitUntil: 'networkidle' });

    // overwrite page content with the one from the snapshot, to fix potential JS issues
    if (args.overwrite && args.js) {
        console.log('REWRITE page content from snapshot..');
        page.setContent(record.html);
    }

    for (const selector of args.REMOVE) {
        console.log('REMOVE element selector:', selector);
        await page.evaluate((s) => {
            for (const el of document.querySelectorAll(s)) {
                el.parentNode.removeChild(el);
            }
        }, selector);
    }

    return { page, context, browser };
}
