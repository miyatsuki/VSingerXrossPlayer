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

export async function fetchVideos(): Promise<ApiVideo[]> {
  const res = await fetch(`${API_BASE_URL}/videos`);
  if (!res.ok) {
    throw new Error(`Failed to fetch videos: ${res.status}`);
  }
  const data = (await res.json()) as ApiVideo[];
  return data;
}

