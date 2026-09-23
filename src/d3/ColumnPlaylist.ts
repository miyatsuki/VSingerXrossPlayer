import { Category, Song } from '../types';
import { PlaylistSaveError, saveYoutubePlaylist } from '../utils/youtubePlaylist';

const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;

export function columnVideoIds(category: Category | null): string[] {
  if (!category) return [];
  return Array.from(new Set(category.items.flatMap(item => {
    if (!('video_url' in item)) return [];
    const videoId = (item as Song).video_url;
    return youtubeIdPattern.test(videoId) ? [videoId] : [];
  })));
}

export class ColumnPlaylist {
  private overlay: HTMLDivElement;
  private player: HTMLIFrameElement;
  private title: HTMLHeadingElement;
  private count: HTMLParagraphElement;
  private saveButton: HTMLButtonElement | null = null;
  private saveStatus: HTMLParagraphElement | null = null;
  private category: Category | null = null;
  private videoIds: string[] = [];
  private saving = false;
  private onClose: () => void;

  constructor(parent: HTMLElement, onClose: () => void, private clientId?: string) {
    this.onClose = onClose;
    this.overlay = document.createElement('div');
    this.overlay.className = 'column-playlist-overlay';
    this.overlay.hidden = true;
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'column-playlist-title');
    this.overlay.onclick = event => {
      if (event.target === this.overlay) this.hide();
    };

    const panel = document.createElement('div');
    panel.className = 'column-playlist-panel';
    const header = document.createElement('div');
    header.className = 'column-playlist-header';
    this.title = document.createElement('h2');
    this.title.id = 'column-playlist-title';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '閉じる';
    closeButton.onclick = () => this.hide();
    header.append(this.title, closeButton);

    this.count = document.createElement('p');
    this.count.className = 'column-playlist-count';
    this.player = document.createElement('iframe');
    this.player.title = '選択中の列の YouTube 動画';
    this.player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    this.player.allowFullscreen = true;
    panel.append(header, this.count, this.player);
    if (clientId) {
      this.saveButton = document.createElement('button');
      this.saveButton.type = 'button';
      this.saveButton.className = 'column-playlist-save';
      this.saveButton.textContent = 'YouTube に保存（非公開）';
      this.saveButton.onclick = () => { void this.save(); };
      this.saveStatus = document.createElement('p');
      this.saveStatus.className = 'column-playlist-save-status';
      this.saveStatus.setAttribute('aria-live', 'polite');
      panel.append(this.saveButton, this.saveStatus);
    }
    this.overlay.appendChild(panel);
    parent.appendChild(this.overlay);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  show(category: Category, videoIds: string[]) {
    this.category = category;
    this.videoIds = videoIds;
    this.title.textContent = category.type === 'songs' ? `${category.title} の歌ってみた`
      : category.type === 'artists' ? `${category.title} の楽曲を歌った動画`
        : `${category.title} の歌ってみた`;
    this.count.textContent = `${videoIds.length}本 · 現在の絞り込みを反映 · この画面での再生はログイン不要`;
    if (this.saveButton) this.saveButton.disabled = false;
    if (this.saveStatus) this.saveStatus.textContent = '';
    const params = new URLSearchParams({ playsinline: '1' });
    if (videoIds.length > 1) params.set('playlist', videoIds.slice(1).join(','));
    this.player.src = `https://www.youtube.com/embed/${videoIds[0]}?${params}`;
    this.overlay.hidden = false;
    this.overlay.querySelector('button')?.focus();
  }

  hide() {
    if (this.overlay.hidden || this.saving) return;
    this.overlay.hidden = true;
    this.player.removeAttribute('src');
    this.onClose();
  }

  private async save() {
    if (!this.clientId || !this.category || !this.videoIds.length || !this.saveButton || !this.saveStatus) return;
    this.saving = true;
    this.saveButton.disabled = true;
    this.saveStatus.textContent = 'Google アカウントで認証しています… 保存処理中は画面を閉じられません。';
    try {
      const playlistId = await saveYoutubePlaylist(this.clientId, this.title.textContent || this.category.title,
        this.videoIds, (saved, total) => {
          if (this.saveStatus) this.saveStatus.textContent = `YouTube に追加中: ${saved} / ${total}本`;
        });
      this.showSavedLink(playlistId, `${this.videoIds.length}本を非公開プレイリストに保存しました。`);
    } catch (error) {
      if (error instanceof PlaylistSaveError) {
        this.showSavedLink(error.playlistId, `${error.savedCount}本まで保存しました。残りは追加できませんでした: ${error.message}`);
      } else {
        this.saveStatus.textContent = error instanceof Error ? error.message : '保存に失敗しました';
        this.saveButton.disabled = false;
      }
    } finally {
      this.saving = false;
    }
  }

  private showSavedLink(playlistId: string, message: string) {
    if (!this.saveStatus) return;
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'YouTube でプレイリストを開く';
    this.saveStatus.replaceChildren(document.createTextNode(`${message} `), link);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !this.overlay.hidden) {
      event.preventDefault();
      this.hide();
    }
  };

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.player.removeAttribute('src');
    this.overlay.remove();
  }
}
