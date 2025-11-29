import { Singer, Song } from '../types';
import { formatPublishedDate, formatViewCount } from '../utils/format';

export class VideoDetailCard {
  private container: HTMLDivElement;
  private currentSong: Song | null = null;
  private radarChartContainer: HTMLDivElement | null = null;
  private wordCloudContainer: HTMLDivElement | null = null;

  constructor(parentElement: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'video-detail-card';
    this.hide(); // Start hidden

    this.applyStyles();
    parentElement.appendChild(this.container);
  }

  private applyStyles() {
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '5%',
      right: '5%',
      width: '550px',
      height: '310px',
      maxWidth: '90vw',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      zIndex: '100',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    });
  }

  show(song: Song, singer?: Singer) {
    this.currentSong = song;
    this.render(song, singer);
    this.container.style.display = 'block';
  }

  hide() {
    this.container.style.display = 'none';
    this.currentSong = null;
  }

  getRadarChartContainer(): HTMLDivElement | null {
    return this.radarChartContainer;
  }

  getWordCloudContainer(): HTMLDivElement | null {
    return this.wordCloudContainer;
  }

  private render(song: Song, singer?: Singer) {
    const backgroundUrl = song.thumbnail_url || `https://i.ytimg.com/vi/${song.video_url}/hqdefault.jpg`;
    if (backgroundUrl) {
      this.container.style.backgroundImage = `
        linear-gradient(
          to right,
          rgba(15, 15, 15, 0.95) 0%,
          rgba(15, 15, 15, 0.85) 50%,
          rgba(15, 15, 15, 0.75) 100%
        ),
        url(${backgroundUrl})
      `;
    }

    // Clear existing content
    this.container.innerHTML = '';

    // Word cloud area
    this.wordCloudContainer = this.createDiv({
      position: 'absolute',
      top: '20px',
      left: '20px',
      width: '280px',
      height: '180px',
    });
    this.container.appendChild(this.wordCloudContainer);

    // Killer phrase
    const killerPhrase = song.comment_cloud?.[0]?.word;
    if (killerPhrase) {
      const phraseDiv = this.createDiv({
        position: 'absolute',
        top: '50%',
        left: '30px',
        transform: 'translateY(-50%)',
        fontSize: '28px',
        fontWeight: 'bold',
        color: 'white',
        textShadow: '0 4px 8px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8)',
        maxWidth: '250px',
        lineHeight: '1.3',
        zIndex: '10',
        pointerEvents: 'none',
      });
      phraseDiv.textContent = killerPhrase;
      this.container.appendChild(phraseDiv);
    }

    // Singer avatar
    const avatarContainer = this.createDiv({
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '74px',
      height: '74px',
      borderRadius: '50%',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      background: 'rgba(255, 255, 255, 0.05)',
    });
    const avatarImg = document.createElement('img');
    avatarImg.src = singer?.avatar_url || song.thumbnail_url || '/default-avatar.png';
    avatarImg.alt = singer?.name || 'Channel';
    Object.assign(avatarImg.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    });
    avatarContainer.appendChild(avatarImg);
    this.container.appendChild(avatarContainer);

    // Radar chart container
    this.radarChartContainer = this.createDiv({
      position: 'absolute',
      top: '105px',
      right: '15px',
      width: '140px',
      height: '140px',
    });
    this.container.appendChild(this.radarChartContainer);

    // Metadata box
    const metadataBox = this.createDiv({
      position: 'absolute',
      bottom: '15px',
      left: '15px',
      width: '300px',
      minHeight: '80px',
      background: 'rgba(0, 0, 0, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '11px',
      color: 'rgba(255, 255, 255, 0.9)',
    });

    const addMetadataLine = (label: string, value: string) => {
      const line = document.createElement('div');
      line.style.cssText = `
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      line.innerHTML = `<strong style="color: white; font-weight: 600;">${label}:</strong> ${value}`;
      metadataBox.appendChild(line);
    };

    addMetadataLine('動画名', song.title);
    if (singer?.name) {
      addMetadataLine('チャンネル', singer.name);
    }
    if (song.published_at) {
      addMetadataLine('投稿日', formatPublishedDate(song.published_at));
    }
    if (song.view_count !== undefined) {
      addMetadataLine('再生数', `${formatViewCount(song.view_count)}回`);
    }

    this.container.appendChild(metadataBox);
  }

  private createDiv(styles: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const div = document.createElement('div');
    Object.assign(div.style, styles);
    return div;
  }

  destroy() {
    this.container.remove();
  }
}
