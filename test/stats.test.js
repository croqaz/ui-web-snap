import test from 'ava';
import { fileURLToPath } from 'url';
import calcStats from '../lib/stats.js';

test('calculate stats for example domain', async (t) => {
    const input = fileURLToPath(new URL('./fixtures/snapshot_example.com.json', import.meta.url));
    const stats = await calcStats({ input });

    t.truthy(stats);
    t.is(stats.url, 'https://example.com');
    t.is(stats.base_url, 'https://example.com/');
    t.is(typeof stats.html, 'number');
    t.true(stats.html > 100);
    t.is(typeof stats.htmlSz, 'string');
});
