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
}

export interface ApiAIStats {
  energy: number;
  mood: number;
  vocal: number;
  instrumental: number;
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

export interface ApiMasterData {
  singers: ApiSinger[];
  reference_songs: ApiSong[];
  song_averages: Record<string, ApiAIStats>;
}

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await fetch(`${API_BASE_URL}/videos`);
  if (!res.ok) {
    throw new Error(`Failed to fetch videos: ${res.status}`);
  }
  const data = (await res.json()) as ApiVideo[];
  return data;
}

export async function fetchMasterData(): Promise<ApiMasterData> {
  const res = await fetch(`${API_BASE_URL}/master`);
  if (!res.ok) {
    throw new Error(`Failed to fetch master data: ${res.status}`);
  }
  const data = (await res.json()) as ApiMasterData;
  return data;
}
