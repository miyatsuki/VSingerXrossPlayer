import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/videoPages.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { fetchVideoPages } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('loads beyond 50 videos and merges collaboration records across pages', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return { ok: true, json: async () => calls.length === 1 ? {
      videos: Array.from({ length: 60 }, (_, i) => ({ video_id: String(i), singers: ['A'] })), next_cursor: 'next+=/',
    } : { videos: [{ video_id: '0', singers: ['B'] }], next_cursor: null } };
  });
  const videos = await fetchVideoPages('http://example.test');
  assert.equal(videos.length, 60);
  assert.deepEqual(videos[0].singers, ['A', 'B']);
  assert.equal(new URL(calls[1]).searchParams.get('cursor'), 'next+=/');
});

test('rejects repeated cursors rather than looping', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ videos: [], next_cursor: 'repeat' }) }));
  await assert.rejects(fetchVideoPages('http://example.test'), /Repeated/);
});

test('does not return partial results after a later page fails', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? { ok: true, json: async () => ({ videos: [{ video_id: 'first' }], next_cursor: 'more' }) }
    : { ok: false, status: 503 });
  await assert.rejects(fetchVideoPages('http://example.test'), /503/);
});
