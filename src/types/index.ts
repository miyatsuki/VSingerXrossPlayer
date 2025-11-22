export interface AIStats {
  energy: number;
  mood: number;
  vocal: number;
  instrumental: number;
}

export interface Singer {
  id: string;
  name: string;
  avatar_url: string;
  description?: string;
  ai_characteristics?: AIStats;
}

export interface Song {
  id: string;
  title: string;
  video_url: string; // YouTube Video ID
  singer_id: string;
  thumbnail_url?: string;
  ai_tags?: string[];
  ai_stats?: AIStats;
  average_stats?: AIStats; // Average stats for this song across all covers
  published_at?: string;
}

export interface Category {
  id: string;
  title: string;
  icon?: React.ReactNode;
  avatar_url?: string; // For singer categories
  items: (Singer | Song)[];
  type: 'singers' | 'songs' | 'settings' | 'search';
}
