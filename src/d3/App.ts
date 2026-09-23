import { Category, Singer, Song } from '../types';
import { fetchVideos, fetchSingers, fetchOriginalSongs, fetchSingerMetadata, SingerMetadata } from '../api/client';
import { NavigationController } from './NavigationController';
import { XMBInterface } from './XMBInterface';
import { VideoDetailCard } from './VideoDetailCard';
import { RadarChart } from './RadarChart';
import { WordCloud } from './WordCloud';
import { SingerSimilarity, groupOriginalArtist } from '../utils/singerSimilarity';
import { SingerDiscovery } from './SingerDiscovery';
import { ColumnPlaylist, columnVideoIds } from './ColumnPlaylist';
import { loadGoogleIdentity } from '../utils/youtubePlaylist';
import './browseControls.css';

export class App {
  private navigation: NavigationController | null = null;
  private xmbInterface: XMBInterface | null = null;
  private videoDetailCard: VideoDetailCard | null = null;
  private radarChart: RadarChart | null = null;
  private wordCloud: WordCloud | null = null;

  private categories: Category[] = [];
  private categorySets: Record<'songs' | 'artists' | 'singers', Category[]> = { songs: [], artists: [], singers: [] };
  private browseMode: 'songs' | 'singers' = 'songs';
  private songGrouping: 'songs' | 'artists' = 'songs';
  private transposeButton: HTMLButtonElement | null = null;
  private controls: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private tagSelect: HTMLSelectElement | null = null;
  private artistSelect: HTMLSelectElement | null = null;
  private groupingSelect: HTMLSelectElement | null = null;
  private resultCount: HTMLSpanElement | null = null;
  private playlistButton: HTMLButtonElement | null = null;
  private columnPlaylist: ColumnPlaylist | null = null;
  private searchText = '';
  private selectedTag = '';
  private selectedArtist = '';
  private singers: Singer[] = [];
  private similarity = new SingerSimilarity([]);
  private singerDiscovery: SingerDiscovery | null = null;

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
        this.createTransposeButton(appContainer);
        this.createBrowseControls(appContainer);
        const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
        this.columnPlaylist = new ColumnPlaylist(appContainer, () => {
          this.navigation?.enable();
          this.playlistButton?.focus();
        }, clientId);
        if (clientId) void loadGoogleIdentity().catch(() => undefined);
        this.videoDetailCard = new VideoDetailCard(appContainer);
        this.singerDiscovery = new SingerDiscovery(appContainer, this.similarity,
          () => this.navigation?.disable(), () => this.navigation?.enable());
      }

      // Listen to navigation changes
      this.navigation.addListener(this.handleItemSelection);
      this.handleItemSelection(this.navigation.getState(), this.navigation.getCurrentItem());

      console.log('[App] Initialization complete');
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
      this.showError('Failed to load data from backend');
    }
  }

  private async loadData() {
    const [rawVideos, apiSingers, originalSongs, metadata] = await Promise.all([
      fetchVideos(),
      fetchSingers(),
      fetchOriginalSongs(),
      fetchSingerMetadata(),
    ]);

    const apiVideos = rawVideos.map(video => ({
      ...video,
      singers: this.expandSingers(video.singers || [], metadata),
    }));

    this.similarity = new SingerSimilarity(apiVideos, originalSongs);

    // Build singer map
    const singerMap = new Map<string, Singer>();
    apiSingers.filter(s => !metadata.units[s.name]).forEach(s => {
      const name = metadata.aliases[s.name] || s.name;
      const previous = singerMap.get(name);
      singerMap.set(name, {
        id: name,
        name,
        avatar_url: previous?.avatar_url || s.avatar_url || '',
        tags: metadata.tags[name] || [],
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
        tags: metadata.tags[name] || [],
      };
      singerMap.set(name, newSinger);
      return newSinger;
    };

    // Convert API videos to songs
    const songsByVideo = new Map<string, Song>();
    apiVideos.forEach(v => {
      const songTitle = v.song_title || v.video_title;
      const originalArtist = groupOriginalArtist(v.original_artist_name);
      const youtubeId = v.video_id;
      const primarySingerName = v.singers && v.singers.length > 0 ? v.singers[0] : 'Unknown';
      v.singers?.forEach(ensureSinger);
      const singer = ensureSinger(primarySingerName);

      songsByVideo.set(v.video_id, {
        id: youtubeId,
        title: songTitle,
        video_url: youtubeId,
        singer_id: singer.id,
        singers: v.singers,
        published_at: v.published_at,
        ai_stats: v.ai_stats,
        comment_cloud: v.comment_cloud,
        chorus_start_time: v.chorus_start_time,
        chorus_end_time: v.chorus_end_time,
        thumbnail_url: v.thumbnail_url,
        original_song_title: v.original_song_title,
        original_artist_name: originalArtist,
        artist_tags: metadata.artistTags[originalArtist || ''] || metadata.tags[originalArtist || ''] || [],
      });
    });
    const songs = Array.from(songsByVideo.values());

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
        artist: covers[0]?.original_artist_name || '',
        tags: Array.from(new Set(covers.flatMap(cover => cover.artist_tags || []))),
        icon: '🎵',
      };
    });

    const videosBySinger = new Map<string, Song[]>();
    for (const video of apiVideos) {
      const baseSong = songsByVideo.get(video.video_id)!;
      for (const singerName of new Set(video.singers?.filter(name => name.trim()) || [])) {
        const singer = ensureSinger(singerName);
        const singerSongs = videosBySinger.get(singer.id) || [];
        singerSongs.push({ ...baseSong, singer_id: singer.id });
        videosBySinger.set(singer.id, singerSongs);
      }
    }
    const singerCategories: Category[] = this.singers
      .filter(singer => videosBySinger.has(singer.id))
      .map(singer => ({
        id: `cat_singer_${singer.id}`,
        title: singer.name,
        avatar_url: singer.avatar_url,
        tags: singer.tags,
        items: videosBySinger.get(singer.id)!,
        type: 'singers',
        icon: '🎤',
      }));

    const videosByArtist = new Map<string, Song[]>();
    for (const song of songs) {
      const artist = song.original_artist_name?.trim() || '原曲アーティスト不明';
      const artistSongs = videosByArtist.get(artist) || [];
      artistSongs.push({ ...song, singer_name: singerMap.get(song.singer_id)?.name });
      videosByArtist.set(artist, artistSongs);
    }
    const artistCategories: Category[] = Array.from(videosByArtist, ([artist, items]) => ({
      id: `cat_artist_${artist}`,
      title: artist,
      artist,
      tags: items[0]?.artist_tags || [],
      items,
      type: 'artists',
      icon: '🎼',
    }));

    this.categorySets = { songs: songCategories, artists: artistCategories, singers: singerCategories };
    this.categories = songCategories;
  }

  private expandSingers(names: string[], metadata: SingerMetadata): string[] {
    return Array.from(new Set(names.flatMap(name => {
      const canonical = metadata.aliases[name.trim()] || name.trim();
      return metadata.units[canonical] || [canonical];
    }).filter(Boolean)));
  }

  private createTransposeButton(parent: HTMLElement) {
    this.transposeButton = document.createElement('button');
    this.transposeButton.type = 'button';
    this.transposeButton.className = 'transpose-trigger';
    this.transposeButton.onclick = () => {
      this.browseMode = this.browseMode === 'songs' ? 'singers' : 'songs';
      this.updateBrowseControls();
      this.applyFilters();
      this.updateTransposeButton();
    };
    this.updateTransposeButton();
    parent.appendChild(this.transposeButton);
  }

  private createBrowseControls(parent: HTMLElement) {
    this.controls = document.createElement('div');
    this.controls.className = 'browse-controls';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = '曲名・歌い手・アーティストを検索';
    this.searchInput.setAttribute('aria-label', '曲名、歌い手、原曲アーティストを検索');
    this.searchInput.oninput = () => {
      this.searchText = this.searchInput?.value.trim().normalize('NFKC').toLocaleLowerCase() || '';
      this.applyFilters();
    };

    this.groupingSelect = this.makeSelect('XMBの表示単位', [
      ['songs', '楽曲ごと'], ['artists', '原曲アーティストごと'], ['singers', '歌い手ごと'],
    ], value => {
      this.browseMode = value === 'singers' ? 'singers' : 'songs';
      if (value !== 'singers') this.songGrouping = value === 'artists' ? 'artists' : 'songs';
      this.updateTransposeButton();
      this.applyFilters();
    });
    this.tagSelect = this.makeSelect('所属・ユニット・レーベル', [
      ['', 'すべてのタグ'],
      ...Array.from(new Set([
        ...this.singers.flatMap(singer => singer.tags || []),
        ...this.categorySets.artists.flatMap(category => category.tags || []),
      ]))
        .sort((a, b) => a.localeCompare(b, 'ja')).map(tag => [tag, tag] as [string, string]),
    ], value => {
      this.selectedTag = value;
      this.applyFilters();
    });
    this.artistSelect = this.makeSelect('原曲アーティスト', [
      ['', 'すべての原曲アーティスト'],
      ...this.categorySets.artists.map(category => [category.title, category.title] as [string, string]),
    ], value => {
      this.selectedArtist = value;
      this.applyFilters();
    });
    this.resultCount = document.createElement('span');
    this.resultCount.className = 'browse-result-count';
    this.resultCount.setAttribute('aria-live', 'polite');
    this.playlistButton = document.createElement('button');
    this.playlistButton.type = 'button';
    this.playlistButton.className = 'column-playlist-trigger';
    this.playlistButton.onclick = () => {
      const category = this.navigation?.getCurrentCategory();
      const videoIds = columnVideoIds(category || null);
      if (!category || !videoIds.length) return;
      this.navigation?.disable();
      this.columnPlaylist?.show(category, videoIds);
    };
    this.controls.append(this.searchInput, this.groupingSelect, this.tagSelect, this.artistSelect, this.resultCount, this.playlistButton);
    parent.appendChild(this.controls);
    this.updateBrowseControls();
    this.applyFilters();
  }

  private makeSelect(label: string, options: [string, string][], onChange: (value: string) => void): HTMLSelectElement {
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    for (const [value, text] of options) select.add(new Option(text, value));
    select.onchange = () => onChange(select.value);
    return select;
  }

  private updateBrowseControls() {
    if (this.groupingSelect) this.groupingSelect.value = this.browseMode === 'singers' ? 'singers' : this.songGrouping;
  }

  private applyFilters() {
    const mode = this.browseMode === 'singers' ? 'singers' : this.songGrouping;
    const source = this.categorySets[mode];
    const matches = (value: string) => value.normalize('NFKC').toLocaleLowerCase().includes(this.searchText);
    this.categories = source.flatMap(category => {
      if (mode === 'singers' && this.selectedTag && !category.tags?.includes(this.selectedTag)) return [];
      const items = category.items.filter(item => {
        if (!('video_url' in item)) return false;
        const song = item as Song;
        if (this.selectedArtist && song.original_artist_name !== this.selectedArtist) return false;
        if (this.selectedTag && !song.artist_tags?.includes(this.selectedTag)
          && !song.singers?.some(name => this.singers.find(singer => singer.name === name)?.tags?.includes(this.selectedTag))) return false;
        if (!this.searchText) return true;
        const singer = this.singers.find(value => value.id === song.singer_id);
        return [category.title, song.title, song.original_artist_name || '', singer?.name || '',
          ...(song.singers || []),
          ...(category.tags || [])].some(matches);
      });
      return items.length ? [{ ...category, items }] : [];
    });
    if (this.resultCount) this.resultCount.textContent = `${this.categories.length}件${this.categories.length ? '' : ' — 該当なし'}`;
    this.navigation?.updateCategories(this.categories);
    this.xmbInterface?.setCategories(this.categories);
    this.updatePlaylistButton();
  }

  private updatePlaylistButton() {
    if (!this.playlistButton) return;
    const category = this.navigation?.getCurrentCategory() || this.categories[0] || null;
    const count = columnVideoIds(category).length;
    this.playlistButton.disabled = count === 0;
    this.playlistButton.textContent = count ? `この列を連続再生（${count}本）` : 'この列を連続再生';
    this.playlistButton.title = count ? `${category?.title} の動画を順番に再生` : '再生できる動画がありません';
  }

  private updateTransposeButton() {
    if (!this.transposeButton) return;
    const target = this.browseMode === 'songs' ? '歌手' : '楽曲';
    this.transposeButton.textContent = `縦横を転置：${target}ごと`;
    this.transposeButton.setAttribute('aria-label', `トップビューを${target}ごとの表示に切り替える`);
  }

  private handleItemSelection = (_state: any, currentItem: Song | null) => {
    console.log('[App] Item selected:', currentItem?.id);
    this.updatePlaylistButton();

    if (!currentItem || !('video_url' in currentItem)) {
      this.videoDetailCard?.hide();
      this.destroyVisualizations();
      return;
    }

    const song = currentItem as Song;
    const singer = this.singers.find(s => s.id === song.singer_id);

    if (singer) this.singerDiscovery?.setSinger(singer.name);
    this.singerDiscovery?.setSong(song.id);

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
    this.singerDiscovery?.destroy();
    this.columnPlaylist?.destroy();
    this.transposeButton?.remove();
    this.controls?.remove();
    this.destroyVisualizations();
  }
}
