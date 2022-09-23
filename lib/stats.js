const prettyBytes = require('./prettyBytes');
const { loadSnapshot } = require('./util.js');

module.exports = async function calcStats({ input }) {
    const snap = await loadSnapshot(input);

    if (!snap) {
        console.error('Empty snapshot file! Cannot launch!');
        return;
    }
    if (!((snap.url || snap.base_url) && snap.html && snap.responses)) {
        console.error('Invalid snapshot file! Cannot open!');
        return;
    }

    snap.html = snap.html.length;
    snap.htmlSz = prettyBytes(snap.html, { maximumFractionDigits: 2 });

    // console.log(`HTML body size: ${snap.html}`);
    // console.log(`There are ${Object.keys(snap.responses).length} resources in total`);

    for (const v of Object.values(snap.responses)) {
        if (!v.body) v.body = '';
        v.body = v.body.length;
        v.bodySz = prettyBytes(v.body, { maximumFractionDigits: 2 });
        if (v.headers) {
            if (v.headers['content-type']) v.resType = v.headers['content-type'].split('/')[0];
            else if (v.headers['Content-Type']) v.resType = v.headers['Content-Type'].split('/')[0];
            else v.resType = 'other';
        } else v.resType = 'other';
    }

    return snap;
};
