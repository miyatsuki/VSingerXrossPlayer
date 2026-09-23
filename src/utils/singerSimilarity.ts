import type { ApiVideo } from '../api/client';

export interface OriginalSong {
  id: string;
  title: string;
  artist: string;
  aliases?: { title: string; artist: string }[];
  videoIds?: string[];
}

export interface RepertoireSong {
  title: string;
  artist?: string;
  videoId: string;
  provisional: boolean;
}

export interface Repertoire {
  singer: string;
  songs: Map<string, RepertoireSong>;
}

export interface SimilarSinger {
  singer: string;
  score: number;
  songScore: number;
  artistScore: number;
  songCount: number;
  commonSongs: RepertoireSong[];
  commonArtists: string[];
}

export interface SingerMapPoint {
  singer: string;
  x: number;
  y: number;
  songCount: number;
}

export interface SongProfile {
  key: string;
  title: string;
  artist?: string;
  videoId: string;
  singers: Set<string>;
}

export interface SimilarSong {
  key: string;
  title: string;
  artist?: string;
  videoId: string;
  score: number;
  singerCount: number;
  commonSingers: string[];
}

export interface SongMapPoint {
  key: string;
  title: string;
  artist?: string;
  x: number;
  y: number;
  singerCount: number;
}

export interface ArtistProfile {
  key: string;
  name: string;
  songs: Set<string>;
  singers: Set<string>;
  videoId: string;
}

export interface SimilarArtist {
  key: string;
  name: string;
  score: number;
  songCount: number;
  singerCount: number;
  commonSingers: string[];
  videoId: string;
}

export interface ArtistMapPoint {
  key: string;
  name: string;
  x: number;
  y: number;
  singerCount: number;
}

// Only remove confirmed singing voice names when they appear as separate credits.
const vocalSynthVoices = new Set([
  '初音ミク', '鏡音リン', '鏡音レン', '鏡音リン・レン', '巡音ルカ', 'KAITO',
  'GUMI', 'IA', 'flower', 'Ci flower', 'VY1V4',
  '可不', '可不（KAFU）', '星界', '裏命', '重音テト', '花隈千冬',
].map(name => name.normalize('NFKC')));

export function groupOriginalArtist(artist?: string): string | undefined {
  if (!artist?.trim()) return artist;
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const isVoiceList = (value: string) => value.split(/\s*&\s*/)
    .every(name => vocalSynthVoices.has(normalize(name)));
  const parts = artist.split(/\s+\/\s+/).map(part => {
    if (vocalSynthVoices.has(normalize(part))) return '';
    const featured = part.match(/^(.*?)\s+feat\.\s+(.+)$/i);
    return featured && isVoiceList(featured[2]) ? featured[1].trim() : part.trim();
  }).filter(Boolean);
  return parts.length ? parts.join(' / ') : artist.trim();
}

// Keep punctuation: removing it can merge distinct titles.
export function normalizeSongTitle(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// The catalog is curated: ambiguous aliases must be fixed, never resolved by order.
export function parseOriginalSongs(value: unknown): OriginalSong[] {
  if (!Array.isArray(value)) throw new Error('原曲対応表は配列で指定してください');
  const ids = new Set<string>();
  const aliases = new Map<string, string>();
  const videos = new Map<string, string>();
  const validText = (text: unknown): text is string => typeof text === 'string' && !!text.trim();
  for (const entry of value) {
    if (!entry || !validText(entry.id) || !validText(entry.title) || !validText(entry.artist)
      || entry.id !== entry.id.trim() || ids.has(entry.id)) {
      throw new Error('原曲対応表のID・曲名・アーティストを確認してください');
    }
    ids.add(entry.id);
    if ((entry.aliases !== undefined && !Array.isArray(entry.aliases))
      || (entry.videoIds !== undefined && !Array.isArray(entry.videoIds))) {
      throw new Error('原曲対応表のaliases・videoIdsは配列で指定してください');
    }
    for (const alias of [entry, ...(entry.aliases || [])]) {
      if (!alias || !validText(alias.title) || !validText(alias.artist)) {
        throw new Error('別名には曲名と原曲アーティストが必要です');
      }
      const key = songPair(alias.title, alias.artist);
      if (aliases.has(key) && aliases.get(key) !== entry.id) {
        throw new Error('同じ別名が複数の原曲IDに割り当てられています');
      }
      aliases.set(key, entry.id);
    }
    for (const videoId of entry.videoIds || []) {
      if (!validText(videoId) || videoId !== videoId.trim()
        || (videos.has(videoId) && videos.get(videoId) !== entry.id)) {
        throw new Error('動画IDの原曲割り当てが不正または重複しています');
      }
      videos.set(videoId, entry.id);
    }
  }
  return value as OriginalSong[];
}

function songPair(title: string, artist: string): string {
  return JSON.stringify([normalizeSongTitle(title), normalizeSongTitle(artist)]);
}

export class OriginalSongResolver {
  private byId = new Map<string, OriginalSong>();
  private byAlias = new Map<string, OriginalSong>();
  private byVideo = new Map<string, OriginalSong>();

  constructor(catalog: OriginalSong[] = []) {
    for (const song of parseOriginalSongs(catalog)) {
      this.byId.set(song.id, song);
      for (const alias of [song, ...(song.aliases || [])]) {
        this.byAlias.set(songPair(alias.title, alias.artist), song);
      }
      for (const videoId of song.videoIds || []) this.byVideo.set(videoId, song);
    }
  }

  resolve(video: ApiVideo): { key: string; song: RepertoireSong } | null {
    const id = video.original_song_id?.trim();
    const title = video.original_song_title?.trim() || video.song_title?.trim();
    const artist = video.original_artist_name?.trim();
    const catalogSong = id ? this.byId.get(id) : this.byVideo.get(video.video_id)
      || (title && artist ? this.byAlias.get(songPair(title, artist)) : undefined);
    const displayTitle = catalogSong?.title || title;
    if (!displayTitle) return null;
    const resolvedId = id || catalogSong?.id;
    const key = resolvedId ? `id:${resolvedId}` : artist
      ? `pair:${songPair(displayTitle, artist)}` : `title:${normalizeSongTitle(displayTitle)}`;
    return {
      key,
      song: {
        title: displayTitle,
        artist: groupOriginalArtist(catalogSong?.artist || artist),
        videoId: video.video_id,
        provisional: !resolvedId && !artist,
      },
    };
  }
}

export class SingerSimilarity {
  readonly repertoires = new Map<string, Repertoire>();
  readonly songProfiles = new Map<string, SongProfile>();
  readonly artistProfiles = new Map<string, ArtistProfile>();
  private weights = new Map<string, number>();
  private norms = new Map<string, number>();
  private artistVectors = new Map<string, Map<string, { name: string; value: number }>>();
  private artistNorms = new Map<string, number>();
  private songSingerWeights = new Map<string, number>();
  private songNorms = new Map<string, number>();
  private artistSingerWeights = new Map<string, number>();
  private artistProfileNorms = new Map<string, number>();
  private videoToSongKey = new Map<string, string>();

  constructor(videos: ApiVideo[], catalog: OriginalSong[] = []) {
    const resolver = new OriginalSongResolver(catalog);
    for (const video of videos) {
      const resolved = resolver.resolve(video);
      if (!resolved) continue;
      const { key, song } = resolved;
      const singers = new Set(video.singers?.filter(name => name.trim()) || []);
      if (singers.size) {
        let profile = this.songProfiles.get(key);
        if (!profile) {
          profile = { key, title: song.title, artist: song.artist, videoId: song.videoId, singers: new Set() };
          this.songProfiles.set(key, profile);
        }
        singers.forEach(singer => profile!.singers.add(singer));
        this.videoToSongKey.set(video.video_id, key);
      }
      for (const singer of singers) {
        let repertoire = this.repertoires.get(singer);
        if (!repertoire) {
          repertoire = { singer, songs: new Map() };
          this.repertoires.set(singer, repertoire);
        }
        if (!repertoire.songs.has(key)) {
          repertoire.songs.set(key, song);
        }
      }
    }

    const frequencies = new Map<string, number>();
    for (const { songs } of this.repertoires.values()) {
      for (const key of songs.keys()) frequencies.set(key, (frequencies.get(key) || 0) + 1);
    }
    for (const [key, count] of frequencies) {
      this.weights.set(key, Math.log((1 + this.repertoires.size) / (1 + count)) + 1);
    }
    for (const { singer, songs } of this.repertoires.values()) {
      this.norms.set(singer, Math.sqrt(Array.from(songs.keys()).reduce(
        (sum, key) => sum + this.weights.get(key)! ** 2, 0,
      )));
    }

    const artistCounts = new Map<string, Map<string, { name: string; count: number }>>();
    const artistFrequencies = new Map<string, number>();
    for (const { singer, songs } of this.repertoires.values()) {
      const counts = new Map<string, { name: string; count: number }>();
      for (const song of songs.values()) {
        if (!song.artist?.trim()) continue;
        const key = normalizeArtist(song.artist);
        const current = counts.get(key);
        counts.set(key, { name: current?.name || song.artist.trim(), count: (current?.count || 0) + 1 });
      }
      artistCounts.set(singer, counts);
      for (const key of counts.keys()) {
        artistFrequencies.set(key, (artistFrequencies.get(key) || 0) + 1);
      }
    }
    for (const [singer, counts] of artistCounts) {
      const vector = new Map<string, { name: string; value: number }>();
      for (const [key, artist] of counts) {
        const idf = Math.log((1 + this.repertoires.size) / (1 + artistFrequencies.get(key)!)) + 1;
        vector.set(key, { name: artist.name, value: (1 + Math.log(artist.count)) * idf });
      }
      this.artistVectors.set(singer, vector);
      this.artistNorms.set(singer, Math.sqrt(Array.from(vector.values()).reduce(
        (sum, artist) => sum + artist.value ** 2, 0,
      )));
    }

    for (const { singer, songs } of this.repertoires.values()) {
      this.songSingerWeights.set(
        singer,
        Math.log((1 + this.songProfiles.size) / (1 + songs.size)) + 1,
      );
    }
    for (const [key, song] of this.songProfiles) {
      this.songNorms.set(key, Math.sqrt(Array.from(song.singers).reduce(
        (sum, singer) => sum + (this.songSingerWeights.get(singer) || 0) ** 2, 0,
      )));

      if (song.artist?.trim()) {
        const artistKey = normalizeArtist(song.artist);
        let artist = this.artistProfiles.get(artistKey);
        if (!artist) {
          artist = { key: artistKey, name: song.artist.trim(), songs: new Set(), singers: new Set(), videoId: song.videoId };
          this.artistProfiles.set(artistKey, artist);
        }
        artist.songs.add(key);
        song.singers.forEach(singer => artist!.singers.add(singer));
      }
    }

    const singerArtistCounts = new Map<string, number>();
    for (const artist of this.artistProfiles.values()) {
      for (const singer of artist.singers) {
        singerArtistCounts.set(singer, (singerArtistCounts.get(singer) || 0) + 1);
      }
    }
    for (const [singer, count] of singerArtistCounts) {
      this.artistSingerWeights.set(singer, Math.log((1 + this.artistProfiles.size) / (1 + count)) + 1);
    }
    for (const [key, artist] of this.artistProfiles) {
      this.artistProfileNorms.set(key, Math.sqrt(Array.from(artist.singers).reduce(
        (sum, singer) => sum + this.artistSingerWeights.get(singer)! ** 2, 0,
      )));
    }
  }

  findSimilar(singer: string, limit = 5): SimilarSinger[] {
    const source = this.repertoires.get(singer);
    if (!source) return [];
    const matches: SimilarSinger[] = [];
    for (const target of this.repertoires.values()) {
      if (target.singer === singer) continue;
      const commonKeys = Array.from(source.songs.keys()).filter(key => target.songs.has(key));
      const songScore = this.songSimilarity(singer, target.singer);
      const artistScore = this.artistSimilarity(singer, target.singer);
      const score = combineSimilarities(songScore, artistScore);
      if (!score) continue;
      const sourceArtists = this.artistVectors.get(singer) || new Map();
      const targetArtists = this.artistVectors.get(target.singer) || new Map();
      const commonArtists = Array.from(sourceArtists.entries())
        .filter(([key]) => targetArtists.has(key))
        .sort(([, first], [, second]) => second.value - first.value || first.name.localeCompare(second.name, 'ja'))
        .map(([, artist]) => artist.name);
      matches.push({
        singer: target.singer,
        score,
        songScore,
        artistScore,
        songCount: target.songs.size,
        commonSongs: commonKeys.map(key => target.songs.get(key)!),
        commonArtists,
      });
    }
    return matches.sort((a, b) => b.score - a.score
      || b.commonSongs.length - a.commonSongs.length
      || b.artistScore - a.artistScore
      || a.singer.localeCompare(b.singer, 'ja')).slice(0, Math.max(0, limit));
  }

  similarityScore(first: string, second: string): number {
    if (first === second) return this.repertoires.has(first) ? 1 : 0;
    return combineSimilarities(
      this.songSimilarity(first, second),
      this.artistSimilarity(first, second),
    );
  }

  private songSimilarity(first: string, second: string): number {
    const source = this.repertoires.get(first);
    const target = this.repertoires.get(second);
    const sourceNorm = this.norms.get(first);
    const targetNorm = this.norms.get(second);
    if (!source || !target || !sourceNorm || !targetNorm) return 0;
    let dot = 0;
    for (const key of source.songs.keys()) {
      if (target.songs.has(key)) dot += this.weights.get(key)! ** 2;
    }
    return Math.min(1, dot / (sourceNorm * targetNorm));
  }

  private artistSimilarity(first: string, second: string): number {
    const source = this.artistVectors.get(first);
    const target = this.artistVectors.get(second);
    const sourceNorm = this.artistNorms.get(first);
    const targetNorm = this.artistNorms.get(second);
    if (!source || !target || !sourceNorm || !targetNorm) return 0;
    let dot = 0;
    for (const [key, artist] of source) {
      const targetArtist = target.get(key);
      if (targetArtist) dot += artist.value * targetArtist.value;
    }
    return Math.min(1, dot / (sourceNorm * targetNorm));
  }

  songKeyForVideo(videoId: string): string | undefined {
    return this.videoToSongKey.get(videoId);
  }

  artistKeyForVideo(videoId: string): string | undefined {
    const songKey = this.videoToSongKey.get(videoId);
    const artist = songKey ? this.songProfiles.get(songKey)?.artist : undefined;
    return artist ? normalizeArtist(artist) : undefined;
  }

  findSimilarSongs(key: string, limit = 5): SimilarSong[] {
    const source = this.songProfiles.get(key);
    if (!source) return [];
    const matches: SimilarSong[] = [];
    for (const target of this.songProfiles.values()) {
      if (target.key === key) continue;
      const commonSingers = Array.from(source.singers)
        .filter(singer => target.singers.has(singer))
        .sort((a, b) => a.localeCompare(b, 'ja'));
      if (!commonSingers.length) continue;
      matches.push({
        key: target.key,
        title: target.title,
        artist: target.artist,
        videoId: target.videoId,
        score: this.songSimilarityScore(key, target.key),
        singerCount: target.singers.size,
        commonSingers,
      });
    }
    return matches.sort((a, b) => b.score - a.score
      || b.commonSingers.length - a.commonSingers.length
      || a.title.localeCompare(b.title, 'ja')).slice(0, Math.max(0, limit));
  }

  songSimilarityScore(first: string, second: string): number {
    if (first === second) return this.songProfiles.has(first) ? 1 : 0;
    const source = this.songProfiles.get(first);
    const target = this.songProfiles.get(second);
    const sourceNorm = this.songNorms.get(first);
    const targetNorm = this.songNorms.get(second);
    if (!source || !target || !sourceNorm || !targetNorm) return 0;
    let dot = 0;
    for (const singer of source.singers) {
      if (target.singers.has(singer)) dot += this.songSingerWeights.get(singer)! ** 2;
    }
    return Math.min(1, dot / (sourceNorm * targetNorm));
  }

  findSimilarArtists(key: string, limit = 5): SimilarArtist[] {
    const source = this.artistProfiles.get(key);
    if (!source) return [];
    const matches: SimilarArtist[] = [];
    for (const target of this.artistProfiles.values()) {
      if (target.key === key) continue;
      const commonSingers = Array.from(source.singers)
        .filter(singer => target.singers.has(singer))
        .sort((a, b) => a.localeCompare(b, 'ja'));
      if (!commonSingers.length) continue;
      matches.push({
        key: target.key,
        name: target.name,
        score: this.artistProfileSimilarityScore(key, target.key),
        songCount: target.songs.size,
        singerCount: target.singers.size,
        commonSingers,
        videoId: target.videoId,
      });
    }
    return matches.sort((a, b) => b.score - a.score
      || b.commonSingers.length - a.commonSingers.length
      || a.name.localeCompare(b.name, 'ja')).slice(0, Math.max(0, limit));
  }

  artistProfileSimilarityScore(first: string, second: string): number {
    if (first === second) return this.artistProfiles.has(first) ? 1 : 0;
    const source = this.artistProfiles.get(first);
    const target = this.artistProfiles.get(second);
    const sourceNorm = this.artistProfileNorms.get(first);
    const targetNorm = this.artistProfileNorms.get(second);
    if (!source || !target || !sourceNorm || !targetNorm) return 0;
    let dot = 0;
    for (const singer of source.singers) {
      if (target.singers.has(singer)) dot += this.artistSingerWeights.get(singer)! ** 2;
    }
    return Math.min(1, dot / (sourceNorm * targetNorm));
  }

  /** Deterministic force layout: similar repertoires attract, all nodes repel. */
  createMap(): SingerMapPoint[] {
    const layout = createSimilarityMap(
      Array.from(this.repertoires.keys()).map(singer => ({
        id: singer, label: singer, count: this.repertoires.get(singer)!.songs.size,
      })),
      (first, second) => this.similarityScore(first, second),
    );
    return layout.map(point => ({
      singer: point.id,
      x: point.x,
      y: point.y,
      songCount: point.count,
    }));
  }

  createSongMap(): SongMapPoint[] {
    const layout = createSimilarityMap(
      Array.from(this.songProfiles.values()).map(song => ({
        id: song.key, label: `${song.title}\u0000${song.artist || ''}`, count: song.singers.size,
      })),
      (first, second) => this.songSimilarityScore(first, second),
    );
    return layout.map(point => {
      const song = this.songProfiles.get(point.id)!;
      return {
        key: song.key,
        title: song.title,
        artist: song.artist,
        x: point.x,
        y: point.y,
        singerCount: point.count,
      };
    });
  }

  createArtistMap(): ArtistMapPoint[] {
    const singers = new Map(this.createMap().map(point => [point.singer, point]));
    const artists = Array.from(this.artistProfiles.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    const groupOffsets = new Map<string, number>();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const clamp = (value: number) => Math.max(0.06, Math.min(0.94, value));
    const points = artists.map(artist => {
      const singerNames = Array.from(artist.singers).sort((a, b) => a.localeCompare(b, 'ja'));
      const positions = singerNames.map(name => singers.get(name)!);
      const anchorX = positions.reduce((sum, point) => sum + point.x, 0) / positions.length;
      const anchorY = positions.reduce((sum, point) => sum + point.y, 0) / positions.length;
      const group = singerNames.join('\u0000');
      const offset = groupOffsets.get(group) || 0;
      groupOffsets.set(group, offset + 1);
      const radius = 0.025 * Math.sqrt(offset);
      return {
        artist,
        anchorX,
        anchorY,
        x: clamp(anchorX + radius * Math.cos(offset * goldenAngle)),
        y: clamp(anchorY + radius * Math.sin(offset * goldenAngle)),
      };
    });
    for (let iteration = 0; iteration < 100; iteration += 1) {
      for (let first = 0; first < points.length; first += 1) {
        for (let second = first + 1; second < points.length; second += 1) {
          const left = points[first];
          const right = points[second];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 1e-8) {
            const angle = (first + second + 1) * goldenAngle;
            dx = Math.cos(angle) * 1e-4;
            dy = Math.sin(angle) * 1e-4;
            distance = 1e-4;
          }
          if (distance >= 0.028) continue;
          const push = (0.028 - distance) * 0.3;
          left.x -= dx / distance * push;
          left.y -= dy / distance * push;
          right.x += dx / distance * push;
          right.y += dy / distance * push;
        }
      }
      for (const point of points) {
        point.x = clamp(point.x + (point.anchorX - point.x) * 0.008);
        point.y = clamp(point.y + (point.anchorY - point.y) * 0.008);
      }
    }
    return points.map(point => ({
      key: point.artist.key,
      name: point.artist.name,
      x: point.x,
      y: point.y,
      singerCount: point.artist.singers.size,
    }));
  }
}

interface SimilarityMapItem {
  id: string;
  label: string;
  count: number;
}

function createSimilarityMap(
  unsortedItems: SimilarityMapItem[],
  similarity: (first: string, second: string) => number,
) {
  const items = [...unsortedItems].sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  const size = items.length;
  if (!size) return [];
  if (size === 1) return [{ ...items[0], x: 0.5, y: 0.5 }];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes = items.map((_, index) => {
    const radius = 0.12 + 0.38 * Math.sqrt((index + 1) / size);
    const angle = index * goldenAngle;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), vx: 0, vy: 0 };
  });
  const edges: { first: number; second: number; score: number }[] = [];
  for (let first = 0; first < size; first += 1) {
    for (let second = first + 1; second < size; second += 1) {
      const score = similarity(items[first].id, items[second].id);
      if (score > 0) edges.push({ first, second, score });
    }
  }
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const force = nodes.map(node => ({ x: -node.x * 0.003, y: -node.y * 0.003 }));
    for (let first = 0; first < size; first += 1) {
      for (let second = first + 1; second < size; second += 1) {
        let dx = nodes[second].x - nodes[first].x;
        let dy = nodes[second].y - nodes[first].y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 1e-8) {
          const angle = (first + second + 1) * goldenAngle;
          dx = Math.cos(angle) * 0.001;
          dy = Math.sin(angle) * 0.001;
          distanceSquared = dx * dx + dy * dy;
        }
        const distance = Math.sqrt(distanceSquared);
        const repulsion = 0.00022 / (distanceSquared + 0.0004);
        const fx = dx / distance * repulsion;
        const fy = dy / distance * repulsion;
        force[first].x -= fx;
        force[first].y -= fy;
        force[second].x += fx;
        force[second].y += fy;
      }
    }
    for (const edge of edges) {
      const first = nodes[edge.first];
      const second = nodes[edge.second];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.max(1e-6, Math.hypot(dx, dy));
      const desired = 0.06 + 0.3 * (1 - edge.score);
      const attraction = (distance - desired) * (0.02 + 0.06 * edge.score);
      const fx = dx / distance * attraction;
      const fy = dy / distance * attraction;
      force[edge.first].x += fx;
      force[edge.first].y += fy;
      force[edge.second].x -= fx;
      force[edge.second].y -= fy;
    }
    const cooling = 1 - iteration / 650;
    nodes.forEach((node, index) => {
      node.vx = (node.vx + force[index].x * cooling) * 0.78;
      node.vy = (node.vy + force[index].y * cooling) * 0.78;
      node.x += node.vx;
      node.y += node.vy;
    });
  }
  const xValues = nodes.map(node => node.x);
  const yValues = nodes.map(node => node.y);
  const scale = (value: number, values: number[]) => {
    const minimum = Math.min(...values);
    const span = Math.max(...values) - minimum;
    return span < 1e-12 ? 0.5 : 0.07 + 0.86 * (value - minimum) / span;
  };
  return items.map((item, index) => ({
    ...item,
    x: scale(nodes[index].x, xValues),
    y: scale(nodes[index].y, yValues),
  }));
}

function normalizeArtist(artist: string): string {
  return artist.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Exact shared songs remain authoritative. Artist preference can add at most 25
// points and only fills the portion not already explained by exact song matches.
function combineSimilarities(songScore: number, artistScore: number): number {
  return Math.min(1, songScore + (1 - songScore) * artistScore * 0.25);
}
