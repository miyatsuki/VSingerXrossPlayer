import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/singerSimilarity.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { SingerSimilarity } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const video = (song_title, singers, video_id = song_title) => ({ song_title, singers, video_id, video_title: 'video title' });

test('deduplicates covers and normalizes width, whitespace and case; includes collaborators', () => {
  const index = new SingerSimilarity([
    video(' ＡＢＣ ', ['A', 'B', 'B'], 'first'),
    video('abc', ['A'], 'repeat'),
    video('Other', ['C']),
  ]);
  assert.equal(index.repertoires.get('A').songs.size, 1);
  const [match] = index.findSimilar('A');
  assert.equal(match.singer, 'B');
  assert.equal(match.score, 1);
  assert.equal(match.commonSongs[0].videoId, 'first');
  assert.equal(match.commonSongs.length, 1);
});

test('does not infer originals from video titles or merge punctuation', () => {
  const index = new SingerSimilarity([
    video(undefined, ['A']), video(' ', ['B']), video('Song!', ['C']), video('Song', ['D']),
  ]);
  assert.equal(index.repertoires.has('A'), false);
  assert.equal(index.repertoires.has('B'), false);
  assert.deepEqual(index.findSimilar('C'), []);
  assert.deepEqual(index.findSimilar('missing'), []);
});

test('weights uncommon shared songs above ubiquitous songs', () => {
  const index = new SingerSimilarity([
    video('Popular', ['A', 'B', 'D', 'E']), video('Rare', ['A', 'C']),
  ]);
  const matches = index.findSimilar('A');
  assert.equal(matches[0].singer, 'C');
  assert.ok(matches[0].score > matches[1].score);
  assert.equal(matches.some(match => match.singer === 'A'), false);
  assert.equal(index.findSimilar('A', 1).length, 1);
});

test('normalizes repertoire size and keeps symmetric similarity', () => {
  const index = new SingerSimilarity([
    video('Shared', ['A', 'B']), video('Unique', ['B']),
  ]);
  const [a] = index.findSimilar('A');
  const [b] = index.findSimilar('B');
  assert.ok(a.score > 0 && a.score < 1);
  assert.equal(a.score, b.score);
  assert.equal(a.songCount, 2);
  assert.equal(b.songCount, 1);
});

const withOriginal = (title, singer, artist, id) => ({
  ...video(title, [singer], singer), original_artist_name: artist, original_song_id: id,
});
const catalog = [{
  id: 'song-a', title: '正式曲名', artist: '原作者',
  aliases: [{ title: '別名', artist: '別表記の原作者' }], videoIds: ['known-video'],
}];

test('separates homonymous originals and unknown artists', () => {
  const index = new SingerSimilarity([
    withOriginal('同名曲', 'A', '作者A'), withOriginal('同名曲', 'B', '作者B'),
    withOriginal('同名曲', 'C', ' 作者Ａ '), withOriginal('同名曲', 'D'),
  ]);
  assert.deepEqual(index.findSimilar('A').map(match => match.singer), ['C']);
  assert.deepEqual(index.findSimilar('D'), []);
});

test('unifies curated aliases and video mappings with explicit IDs', () => {
  const index = new SingerSimilarity([
    withOriginal('正式曲名', 'A', '原作者'),
    withOriginal('別名', 'B', '別表記の原作者'),
    withOriginal('異なる表示名', 'C', undefined, 'song-a'),
    { ...video(undefined, ['D'], 'known-video') },
  ], catalog);
  const matches = index.findSimilar('A');
  assert.equal(matches.length, 3);
  for (const match of matches) {
    assert.equal(match.score, 1);
    assert.equal(match.commonSongs[0].title, '正式曲名');
    assert.equal(match.commonSongs[0].artist, '原作者');
    assert.equal(match.commonSongs[0].provisional, false);
  }
});

test('explicit IDs take priority over aliases and prevent same-name collisions', () => {
  const index = new SingerSimilarity([
    withOriginal('正式曲名', 'A', '原作者', 'different-id'),
    withOriginal('正式曲名', 'B', '原作者'),
  ], catalog);
  const [match] = index.findSimilar('A');
  assert.equal(match.commonSongs.length, 0);
  assert.deepEqual(match.commonArtists, ['原作者']);
  assert.equal(match.score, 0.25);
});

test('uses original artist preference as a bounded fallback for different songs', () => {
  const index = new SingerSimilarity([
    withOriginal('曲A', 'A', '同じ作者', 'song-a'),
    withOriginal('曲B', 'B', '同じ作者', 'song-b'),
    withOriginal('曲C', 'C', '別の作者', 'song-c'),
  ]);
  const matches = index.findSimilar('A');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].singer, 'B');
  assert.equal(matches[0].songScore, 0);
  assert.equal(matches[0].artistScore, 1);
  assert.equal(matches[0].score, 0.25);
  assert.deepEqual(matches[0].commonArtists, ['同じ作者']);
});

test('uses original title before display title and labels title-only matching', () => {
  const index = new SingerSimilarity([
    { ...video('cover title', ['A']), original_song_title: 'Original' },
    video('Original', ['B']),
  ]);
  assert.equal(index.findSimilar('A')[0].commonSongs[0].provisional, true);
});

test('projects every singer into a deterministic two-dimensional similarity map', () => {
  const index = new SingerSimilarity([
    video('Shared one', ['A', 'B']),
    video('Shared two', ['A', 'B']),
    video('Different', ['C']),
  ]);
  const first = index.createMap();
  const second = index.createMap();
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(point => point.singer), ['A', 'B', 'C']);
  for (const point of first) {
    assert.ok(point.x >= 0 && point.x <= 1);
    assert.ok(point.y >= 0 && point.y <= 1);
  }
  const bySinger = new Map(first.map(point => [point.singer, point]));
  const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  assert.ok(distance(bySinger.get('A'), bySinger.get('B'))
    < distance(bySinger.get('A'), bySinger.get('C')));
});

test('maps one or two singers without unstable empty eigenvectors', () => {
  const one = new SingerSimilarity([video('Song', ['A'])]).createMap();
  assert.deepEqual(one, [{ singer: 'A', x: 0.5, y: 0.5, songCount: 1 }]);
  const two = new SingerSimilarity([video('Song', ['A', 'B'])]).createMap();
  assert.equal(two.length, 2);
  assert.ok(two.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test('transposes singer-song data to find songs covered by the same singers', () => {
  const index = new SingerSimilarity([
    video('Song A', ['A', 'B'], 'video-a'),
    video('Song B', ['A'], 'video-b'),
    video('Song C', ['C'], 'video-c'),
  ]);
  const key = index.songKeyForVideo('video-a');
  const [match] = index.findSimilarSongs(key);
  assert.equal(match.title, 'Song B');
  assert.deepEqual(match.commonSingers, ['A']);
  assert.ok(match.score > 0 && match.score < 1);
  assert.equal(index.findSimilarSongs(index.songKeyForVideo('video-c')).length, 0);
});

test('maps every transposed song deterministically and includes collaborators', () => {
  const index = new SingerSimilarity([
    video('Song A', ['A', 'B'], 'video-a'),
    video('Song B', ['A'], 'video-b'),
    video('Song C', ['C'], 'video-c'),
  ]);
  const first = index.createSongMap();
  assert.deepEqual(first, index.createSongMap());
  assert.equal(first.length, 3);
  assert.equal(first.find(point => point.title === 'Song A').singerCount, 2);
  assert.ok(first.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test('groups original artists by covering singers and keeps unknown artists out of the map', () => {
  const index = new SingerSimilarity([
    { ...video('First', ['A'], 'first'), original_artist_name: 'Artist One' },
    { ...video('Second', ['B'], 'second'), original_artist_name: 'Artist One' },
    { ...video('Third', ['A'], 'third'), original_artist_name: 'Artist Two' },
    { ...video('Fourth', ['C'], 'fourth'), original_artist_name: 'Artist Three' },
    video('Unknown', ['A'], 'unknown'),
  ]);
  const key = index.artistKeyForVideo('first');
  assert.equal(key, 'artist one');
  assert.equal(index.artistKeyForVideo('unknown'), undefined);
  assert.equal(index.artistProfiles.get(key).songs.size, 2);
  assert.deepEqual([...index.artistProfiles.get(key).singers].sort(), ['A', 'B']);
  const [match] = index.findSimilarArtists(key);
  assert.equal(match.name, 'Artist Two');
  assert.deepEqual(match.commonSingers, ['A']);
  assert.ok(match.score > 0 && match.score < 1);
  assert.deepEqual(index.createArtistMap(), index.createArtistMap());
  assert.equal(index.createArtistMap().length, 3);
});

test('spreads artists covered by the same singer across distinct map positions', () => {
  const index = new SingerSimilarity(Array.from({ length: 30 }, (_, number) => ({
    ...video(`Song ${number}`, ['A'], `video-${number}`),
    original_artist_name: `Artist ${number}`,
  })));
  const points = index.createArtistMap();
  assert.equal(points.length, 30);
  assert.equal(new Set(points.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)}`)).size, 30);
  assert.deepEqual(points, index.createArtistMap());
});

test('rejects conflicting catalog aliases, video assignments and IDs', () => {
  const another = { id: 'song-b', title: '別曲', artist: '別作者' };
  assert.throws(() => new SingerSimilarity([], [catalog[0], { ...another, aliases: [{ title: '正式曲名', artist: '原作者' }] }]));
  assert.throws(() => new SingerSimilarity([], [catalog[0], { ...another, videoIds: ['known-video'] }]));
  assert.throws(() => new SingerSimilarity([], [catalog[0], { ...another, id: 'song-a' }]));
  assert.throws(() => new SingerSimilarity([], [{ ...another, aliases: [null] }]));
});
