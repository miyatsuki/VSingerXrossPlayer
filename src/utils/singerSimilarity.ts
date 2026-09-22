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
        artist: catalogSong?.artist || artist,
        videoId: video.video_id,
        provisional: !resolvedId && !artist,
      },
    };
  }
}

export class SingerSimilarity {
  readonly repertoires = new Map<string, Repertoire>();
  private weights = new Map<string, number>();
  private norms = new Map<string, number>();
  private artistVectors = new Map<string, Map<string, { name: string; value: number }>>();
  private artistNorms = new Map<string, number>();

  constructor(videos: ApiVideo[], catalog: OriginalSong[] = []) {
    const resolver = new OriginalSongResolver(catalog);
    for (const video of videos) {
      const resolved = resolver.resolve(video);
      if (!resolved) continue;
      const { key, song } = resolved;
      for (const singer of new Set(video.singers?.filter(name => name.trim()) || [])) {
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

  /** Deterministic force layout: similar repertoires attract, all nodes repel. */
  createMap(): SingerMapPoint[] {
    const singers = Array.from(this.repertoires.keys())
      .sort((a, b) => a.localeCompare(b, 'ja'));
    const size = singers.length;
    if (!size) return [];
    if (size === 1) {
      const singer = singers[0];
      return [{ singer, x: 0.5, y: 0.5, songCount: this.repertoires.get(singer)!.songs.size }];
    }

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const nodes = singers.map((_, index) => {
      const radius = 0.12 + 0.38 * Math.sqrt((index + 1) / size);
      const angle = index * goldenAngle;
      return {
        x: radius * Math.cos(angle), y: radius * Math.sin(angle), vx: 0, vy: 0,
      };
    });
    const edges: { first: number; second: number; score: number }[] = [];
    for (let first = 0; first < size; first += 1) {
      for (let second = first + 1; second < size; second += 1) {
        const score = this.similarityScore(singers[first], singers[second]);
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
    return singers.map((singer, index) => ({
      singer,
      x: scale(nodes[index].x, xValues),
      y: scale(nodes[index].y, yValues),
      songCount: this.repertoires.get(singer)!.songs.size,
    }));
  }
}

function normalizeArtist(artist: string): string {
  return artist.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Exact shared songs remain authoritative. Artist preference can add at most 25
// points and only fills the portion not already explained by exact song matches.
function combineSimilarities(songScore: number, artistScore: number): number {
  return Math.min(1, songScore + (1 - songScore) * artistScore * 0.25);
}
