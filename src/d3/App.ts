import { Category, Singer, Song } from '../types';
import { fetchVideos, fetchSingers } from '../api/client';
import { NavigationController } from './NavigationController';
import { XMBInterface } from './XMBInterface';
import { VideoDetailCard } from './VideoDetailCard';
import { RadarChart } from './RadarChart';
import { WordCloud } from './WordCloud';

export class App {
  private navigation: NavigationController | null = null;
  private xmbInterface: XMBInterface | null = null;
  private videoDetailCard: VideoDetailCard | null = null;
  private radarChart: RadarChart | null = null;
  private wordCloud: WordCloud | null = null;

  private categories: Category[] = [];
  private singers: Singer[] = [];
  private mode: 'songs' | 'singers' = 'songs';

  async init() {
    console.log('[App] Initializing...');

    try {
      // Load data
      await this.loadData();
      console.log('[App] Data loaded:', {
        categories: this.categories.length,
        singers: this.singers.length,
      });

      // Initialize navigation
      this.navigation = new NavigationController(this.categories);

      // Initialize XMB interface
      this.xmbInterface = new XMBInterface('app', this.navigation);
      this.xmbInterface.setCategories(this.categories);

      // Initialize video detail card
      const appContainer = document.getElementById('app');
      if (appContainer) {
        this.videoDetailCard = new VideoDetailCard(appContainer);
      }

      // Listen to navigation changes
      this.navigation.addListener(this.handleItemSelection);

      console.log('[App] Initialization complete');
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      this.showError('Failed to load data from backend');
    }
  }

  private async loadData() {
    const [apiVideos, apiSingers] = await Promise.all([
      fetchVideos(),
      fetchSingers(),
    ]);

    // Build singer map
    const singerMap = new Map<string, Singer>();
    apiSingers.forEach(s => {
      singerMap.set(s.name, {
        id: s.name,
        name: s.name,
        avatar_url: s.avatar_url || '',
      });
    });

    // Ensure all singers from videos exist
    const ensureSinger = (name: string): Singer => {
      if (singerMap.has(name)) {
        return singerMap.get(name)!;
      }
      const newSinger: Singer = {
        id: name,
        name,
        avatar_url: '',
      };
      singerMap.set(name, newSinger);
      return newSinger;
    };

    // Convert API videos to songs
    const songs: Song[] = apiVideos.map(v => {
      const songTitle = v.song_title || v.video_title;
      const youtubeId = v.video_id;
      const primarySingerName = v.singers && v.singers.length > 0 ? v.singers[0] : 'Unknown';
      const singer = ensureSinger(primarySingerName);

      return {
        id: youtubeId,
        title: songTitle,
        video_url: youtubeId,
        singer_id: singer.id,
        published_at: v.published_at,
        ai_stats: v.ai_stats,
        comment_cloud: v.comment_cloud,
        chorus_start_time: v.chorus_start_time,
        chorus_end_time: v.chorus_end_time,
        thumbnail_url: v.thumbnail_url,
      };
    });

    this.singers = Array.from(singerMap.values());

    // Build song categories
    const uniqueTitles = Array.from(new Set(songs.map(s => s.title)));
    const songCategories: Category[] = uniqueTitles.map(title => {
      const covers = songs.filter(s => s.title === title);
      const items = covers.map(cover => {
        const singer = this.singers.find(s => s.id === cover.singer_id);
        return {
          ...cover,
          singer_name: singer?.name,
          singer_avatar: singer?.avatar_url,
        };
      });
      return {
        id: `cat_song_${title}`,
        title: title,
        items: items,
        type: 'songs',
        icon: '🎵',
      };
    });

    this.categories = songCategories;
  }

  private handleItemSelection = (_state: any, currentItem: Song | null) => {
    console.log('[App] Item selected:', currentItem?.id);

    if (!currentItem || !('video_url' in currentItem)) {
      this.videoDetailCard?.hide();
      this.destroyVisualizations();
      return;
    }

    const song = currentItem as Song;
    const singer = this.singers.find(s => s.id === song.singer_id);

    // Show detail card
    this.videoDetailCard?.show(song, singer);

    // Render visualizations
    this.renderVisualizations(song);
  };

  private renderVisualizations(song: Song) {
    // Destroy previous visualizations
    this.destroyVisualizations();

    // Render radar chart
    const radarContainer = this.videoDetailCard?.getRadarChartContainer();
    if (radarContainer && song.ai_stats) {
      this.radarChart = new RadarChart(radarContainer, 140, 140);
      this.radarChart.render(song.ai_stats, song.average_stats);
    }

    // Render word cloud
    const wordCloudContainer = this.videoDetailCard?.getWordCloudContainer();
    if (wordCloudContainer && song.comment_cloud) {
      this.wordCloud = new WordCloud(wordCloudContainer, 280, 180);
      this.wordCloud.render(song.comment_cloud);
    }
  }

  private destroyVisualizations() {
    if (this.radarChart) {
      this.radarChart.destroy();
      this.radarChart = null;
    }
    if (this.wordCloud) {
      this.wordCloud.destroy();
      this.wordCloud = null;
    }
  }

  private showError(message: string) {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="
          color: white;
          padding: 20px;
          background: #1d1d1d;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ">
          <div style="text-align: center;">
            <h1 style="font-size: 24px; margin-bottom: 20px;">Error</h1>
            <p style="font-size: 16px; color: rgba(255,255,255,0.8);">${message}</p>
          </div>
        </div>
      `;
    }
  }

  destroy() {
    this.navigation?.destroy();
    this.xmbInterface?.destroy();
    this.videoDetailCard?.destroy();
    this.destroyVisualizations();
  }
}
