import type { ApiVideo } from '../api/client';

export async function fetchVideoPages(baseUrl: string): Promise<ApiVideo[]> {
  const videos = new Map<string, ApiVideo>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('cursor', cursor);
    const response = await fetch(`${baseUrl}/video-pages?${query}`);
    if (!response.ok) throw new Error(`Failed to fetch videos: ${response.status}`);
    const page = await response.json() as { videos: ApiVideo[]; next_cursor: string | null };
    if (!Array.isArray(page.videos) || (page.next_cursor !== null && typeof page.next_cursor !== 'string')) {
      throw new Error('Invalid video page');
    }
    for (const video of page.videos) {
      const previous = videos.get(video.video_id);
      videos.set(video.video_id, {
        ...video,
        singers: Array.from(new Set([...(previous?.singers || []), ...(video.singers || [])])),
      });
    }
    cursor = page.next_cursor;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error('Repeated video cursor');
      cursors.add(cursor);
    }
  } while (cursor);
  return Array.from(videos.values());
}
