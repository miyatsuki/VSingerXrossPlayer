export interface AIStats {
  cool: number;        // かっこいい (0-100)
  cute: number;        // かわいい (0-100)
  energetic: number;   // 元気 (0-100)
  surprising: number;  // 意外性 (0-100)
  emotional: number;   // エモい (0-100)
}

export interface CommentWord {
  word: string;
  importance: number;  // 重要度 (0-100)
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
  comment_cloud?: CommentWord[]; // Top 10-20 characteristic words from comments
  killer_phrase?: string; // Most characteristic phrase for display (future: from backend)
  published_at?: string;
  chorus_start_time?: number;  // サビ開始時間（秒）
  chorus_end_time?: number;    // サビ終了時間（秒）
  original_song_title?: string; // 原曲タイトル
  original_artist_name?: string; // 原曲アーティスト
  view_count?: number; // 再生数
  like_count?: number; // いいね数
  comment_count?: number; // コメント数
  channel_title?: string; // チャンネル名
}

export interface Category {
  id: string;
  title: string;
  icon?: React.ReactNode;
  avatar_url?: string; // For singer categories
  items: (Singer | Song)[];
  type: 'singers' | 'songs' | 'settings' | 'search';
}
