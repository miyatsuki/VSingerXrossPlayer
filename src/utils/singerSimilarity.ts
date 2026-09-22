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
  songCount: number;
  commonSongs: RepertoireSong[];
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
  }

  findSimilar(singer: string, limit = 5): SimilarSinger[] {
    const source = this.repertoires.get(singer);
    if (!source) return [];
    const matches: SimilarSinger[] = [];
    for (const target of this.repertoires.values()) {
      if (target.singer === singer) continue;
      const commonKeys = Array.from(source.songs.keys()).filter(key => target.songs.has(key));
      if (!commonKeys.length) continue;
      const dot = commonKeys.reduce((sum, key) => sum + this.weights.get(key)! ** 2, 0);
      matches.push({
        singer: target.singer,
        score: Math.min(1, dot / (this.norms.get(singer)! * this.norms.get(target.singer)!)),
        songCount: target.songs.size,
        commonSongs: commonKeys.map(key => target.songs.get(key)!),
      });
    }
    return matches.sort((a, b) => b.score - a.score
      || b.commonSongs.length - a.commonSongs.length
      || a.singer.localeCompare(b.singer, 'ja')).slice(0, Math.max(0, limit));
  }
}
