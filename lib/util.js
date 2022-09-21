/*
 * Common utils
 */
const fs = require('fs');
const { gunzip } = require('zlib');
const { promisify } = require('util');

const { encode, decode } = require('./quopri.js');

function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function requestKey(r) {
    return `${r.method()}:${r.url()}`;
}

function normalizeURL(url) {
    if (!url) return '';
    const u = new URL(url.replace(/\/+$/, ''));
    u.hash = '';
    return u.toString();
}

function toBool(str) {
    if (!str) return !!str;
    if (typeof str !== 'string') return str;
    str = str.toLowerCase();
    if (str === 'false' || str === 'off' || str === 'no' || str === '0') return false;
    return true;
}

function smartSplit(str) {
    if (!str) return [];
    if (typeof str !== 'string') return str;
    const split = [];
    for (let s of str.split(/[,; ]+/)) {
        if (s.trim()) {
            split.push(s);
        }
    }
    return split;
}

async function loadSnapshot(fname) {
    let record = await fs.promises.readFile(fname);
    if (fname.endsWith('.gz')) {
        record = await promisify(gunzip)(record);
    }
    try {
        return JSON.parse(record);
    } catch (err) {
        console.error(err);
    }
}

function encodeBody(resourceType, contentType, buffer) {
    if (!buffer || buffer.length === 0) return '';
    if (
        resourceType === 'document' ||
        resourceType === 'stylesheet' ||
        resourceType === 'script' ||
        resourceType === 'manifest'
    ) {
        return `QUOPRI:${encode(buffer)}`;
    }
    if (contentType &&
        (contentType.startsWith('text/') ||
            contentType.startsWith('image/svg+xml') ||
            contentType.startsWith('application/json'))
    ) {
        return `QUOPRI:${encode(buffer)}`;
    }
    return `BASE64:${buffer.toString('base64')}`;
}

function decodeBody(body) {
    if (!body || body.length === 0) return '';
    if (body.startsWith('QUOPRI:')) return decode(body.slice(7));
    if (body.startsWith('BASE64:')) return Buffer.from(body.slice(7), 'base64');
    return Buffer.from(body, 'base64');
}

module.exports = { delay, requestKey, normalizeURL, toBool, smartSplit, loadSnapshot, encodeBody, decodeBody };
