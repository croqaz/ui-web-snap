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

    snap.html = prettyBytes(snap.html.length, { minimumFractionDigits: 2 });

    console.log(`HTML body size: ${snap.html}`);
    console.log(`There are ${Object.keys(snap.responses).length} resources in total`);

    for (const v of Object.values(snap.responses)) {
        if (!v.body) v.body = '';
        v.body = prettyBytes(v.body.length, { minimumFractionDigits: 2 });
    }

    return snap;
};
