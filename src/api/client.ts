const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ApiVideo {
  video_id: string;
  video_title: string;
  channel_id?: string;
  description?: string;
  duration?: number;
  published_at?: string;
  song_title?: string;
  singers?: string[];
  tags?: string[];
  ai_stats?: ApiAIStats;
  comment_cloud?: ApiCommentWord[];
  chorus_start_time?: number;  // サビ開始時間（秒）
  chorus_end_time?: number;    // サビ終了時間（秒）
  thumbnail_url?: string;
}

export interface ApiAIStats {
  cool: number;        // かっこいい (0-100)
  cute: number;        // かわいい (0-100)
  energetic: number;   // 元気 (0-100)
  surprising: number;  // 意外性 (0-100)
  emotional: number;   // エモい (0-100)
}

export interface ApiCommentWord {
  word: string;
  importance: number;  // 重要度 (0-100)
}

export interface ApiSinger {
  id: string;
  name: string;
  avatar_url: string;
  description?: string;
  ai_characteristics?: ApiAIStats;
}

export interface ApiSong {
  id: string;
  title: string;
  video_url: string;
  singer_id: string;
  thumbnail_url?: string;
  ai_tags?: string[];
  ai_stats?: ApiAIStats;
  average_stats?: ApiAIStats;
  published_at?: string;
}

export interface ApiSingerSummary {
  name: string;
  video_count: number;
  latest_video_id?: string;
  avatar_url?: string;
}

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await fetch(`${API_BASE_URL}/videos`);
  if (!res.ok) {
    throw new Error(`Failed to fetch videos: ${res.status}`);
  }
  const data = (await res.json()) as ApiVideo[];
  return data;
}

export async function fetchSingers(): Promise<ApiSingerSummary[]> {
  const res = await fetch(`${API_BASE_URL}/singers`);
  if (!res.ok) {
    throw new Error(`Failed to fetch singers: ${res.status}`);
  }
  const data = (await res.json()) as ApiSingerSummary[];
  return data;
}
