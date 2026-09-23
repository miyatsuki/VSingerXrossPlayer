import { SingerSimilarity } from '../utils/singerSimilarity';
import './singerDiscovery.css';

type DiscoveryMode = 'singers' | 'songs' | 'artists';

interface MapPoint {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  countLabel: string;
}

interface MapMatch {
  id: string;
  score: number;
}

export class SingerDiscovery {
  private trigger = document.createElement('button');
  private dialog = document.createElement('dialog');
  private heading = document.createElement('h2');
  private modeButton = document.createElement('button');
  private selectLabel = document.createTextNode('');
  private select = document.createElement('select');
  private results = document.createElement('div');
  private mode: DiscoveryMode = 'singers';
  private selectedSinger = '';
  private selectedSong = '';
  private selectedArtist = '';

  constructor(parent: HTMLElement, private similarity: SingerSimilarity, onOpen: () => void, onClose: () => void) {
    this.trigger.className = 'discovery-trigger';
    this.trigger.textContent = '選曲類似マップ';
    this.trigger.type = 'button';
    this.trigger.disabled = similarity.repertoires.size === 0;
    this.trigger.onclick = () => {
      this.populateSelect();
      this.render();
      this.dialog.showModal();
      onOpen();
    };
    this.dialog.className = 'singer-discovery';
    this.dialog.setAttribute('aria-labelledby', 'discovery-title');
    this.heading.id = 'discovery-title';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '閉じる';
    close.onclick = () => this.dialog.close();
    this.modeButton.type = 'button';
    this.modeButton.onclick = () => {
      this.mode = this.mode === 'singers' ? 'songs' : this.mode === 'songs' ? 'artists' : 'singers';
      this.populateSelect();
      this.render();
    };
    const actions = document.createElement('div');
    actions.className = 'discovery-header-actions';
    actions.append(this.modeButton, close);
    const header = document.createElement('header');
    header.append(this.heading, actions);
    const label = document.createElement('label');
    this.select.onchange = () => {
      if (this.mode === 'singers') this.selectedSinger = this.select.value;
      else if (this.mode === 'songs') this.selectedSong = this.select.value;
      else this.selectedArtist = this.select.value;
      this.render();
    };
    label.append(this.selectLabel, this.select);
    this.results.setAttribute('aria-live', 'polite');
    this.dialog.append(header, label, this.results);
    this.dialog.addEventListener('close', () => {
      onClose();
      this.trigger.focus();
    });
    parent.append(this.trigger, this.dialog);
  }

  setSinger(singer: string) {
    if (!this.similarity.repertoires.has(singer)) return;
    this.selectedSinger = singer;
    if (this.mode === 'singers') this.select.value = singer;
  }

  setSong(videoId: string) {
    const key = this.similarity.songKeyForVideo(videoId);
    if (!key) return;
    this.selectedSong = key;
    const artist = this.similarity.artistKeyForVideo(videoId);
    if (artist) this.selectedArtist = artist;
    if (this.mode === 'songs') this.select.value = key;
    if (this.mode === 'artists') this.select.value = this.selectedArtist;
  }

  private populateSelect() {
    const selected = this.mode === 'singers' ? this.selectedSinger
      : this.mode === 'songs' ? this.selectedSong : this.selectedArtist;
    this.select.replaceChildren();
    const options = this.mode === 'singers'
      ? Array.from(this.similarity.repertoires.keys()).map(value => ({ value, label: value }))
      : this.mode === 'songs' ? Array.from(this.similarity.songProfiles.values()).map(song => ({
        value: song.key,
        label: `${song.title}${song.artist ? ` / ${song.artist}` : ''}`,
      })) : Array.from(this.similarity.artistProfiles.values()).map(artist => ({
        value: artist.key, label: artist.name,
      }));
    options.sort((a, b) => a.label.localeCompare(b.label, 'ja'));
    for (const item of options) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      this.select.appendChild(option);
    }
    if (selected && options.some(option => option.value === selected)) this.select.value = selected;
    if (this.mode === 'singers') this.selectedSinger = this.select.value;
    else if (this.mode === 'songs') this.selectedSong = this.select.value;
    else this.selectedArtist = this.select.value;
  }

  private render() {
    if (this.mode === 'singers') this.renderSingers();
    else if (this.mode === 'songs') this.renderSongs();
    else this.renderArtists();
  }

  private updateModeText() {
    const settings = {
      singers: ['選曲が近い歌手', '楽曲へ転置', '基準にする歌手 '],
      songs: ['選ぶ歌手が近い楽曲', '原曲アーティストへ', '基準にする楽曲 '],
      artists: ['歌い手が近い原曲アーティスト', '歌手へ転置', '基準にする原曲アーティスト '],
    }[this.mode];
    this.heading.textContent = settings[0];
    this.modeButton.textContent = settings[1];
    this.modeButton.setAttribute('aria-label', `${settings[1]}切り替える`);
    this.selectLabel.textContent = settings[2];
  }

  private renderSingers() {
    this.updateModeText();
    this.results.replaceChildren();
    const singer = this.select.value;
    const count = this.similarity.repertoires.get(singer)?.songs.size || 0;
    const matches = this.similarity.findSimilar(singer);
    const points: MapPoint[] = this.similarity.createMap().map(point => ({
      id: point.singer,
      label: point.singer,
      count: point.songCount,
      x: point.x,
      y: point.y,
      countLabel: `${point.songCount}曲`,
    }));
    this.appendSummaryAndMap(
      `${points.length}人を全体配置。${singer}：比較できる登録曲 ${count}曲。`,
      '全歌手の選曲類似度を二次元に近似したマップ',
      points,
      matches.map(match => ({ id: match.singer, score: match.score })),
      singer,
      3,
      false,
    );
    if (!matches.length) {
      this.appendEmpty('この歌手と共通の原曲または原曲アーティストが登録されている歌手はまだいません。');
      return;
    }
    const list = document.createElement('ol');
    for (const match of matches) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${match.singer} · 類似度 ${Math.round(match.score * 100)}/100`;
      const reason = document.createElement('p');
      reason.textContent = `共通 ${match.commonSongs.length}曲`;
      if (match.commonArtists.length) {
        const artists = match.commonArtists.slice(0, 3).join('、');
        const rest = match.commonArtists.length > 3 ? `ほか${match.commonArtists.length - 3}組` : '';
        reason.textContent += ` · 共通原曲アーティスト ${artists}${rest}`;
      }
      reason.textContent += ` / 相手の登録 ${match.songCount}曲`;
      if (Math.min(count, match.songCount) < 3) reason.textContent += ' · 登録曲が少ないため参考値';
      const songs = document.createElement('div');
      songs.className = 'discovery-songs';
      for (const song of match.commonSongs) {
        songs.appendChild(this.youtubeLink(
          song.videoId,
          `${song.title}${song.artist ? ` / ${song.artist}` : ''}${song.provisional ? '（曲名のみの暫定照合）' : ''}`,
          `${match.singer}の${song.title}`,
        ));
      }
      item.append(title, reason, songs);
      list.appendChild(item);
    }
    this.results.append(list, this.note('完全に同じ曲の一致を主な類似度とし、同じ原曲アーティストの別曲を選んでいる傾向で最大25点分を補完します。定番曲・定番アーティストの重みを下げています。'));
  }

  private renderSongs() {
    this.updateModeText();
    this.results.replaceChildren();
    const key = this.select.value;
    const song = this.similarity.songProfiles.get(key);
    if (!song) return;
    const matches = this.similarity.findSimilarSongs(key);
    const points: MapPoint[] = this.similarity.createSongMap().map(point => ({
      id: point.key,
      label: point.title,
      count: point.singerCount,
      x: point.x,
      y: point.y,
      countLabel: `${point.singerCount}人`,
    }));
    this.appendSummaryAndMap(
      `${points.length}曲を全体配置。${song.title}：歌った登録歌手 ${song.singers.size}人。`,
      '全楽曲を歌った歌手の類似度で二次元に近似したマップ',
      points,
      matches.map(match => ({ id: match.key, score: match.score })),
      key,
      2,
      true,
    );
    if (!matches.length) {
      this.appendEmpty('この楽曲を歌った歌手による別の登録曲はまだありません。');
      return;
    }
    const list = document.createElement('ol');
    for (const match of matches) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${match.title}${match.artist ? ` / ${match.artist}` : ''} · 類似度 ${Math.round(match.score * 100)}/100`;
      const reason = document.createElement('p');
      reason.textContent = `共通歌手 ${match.commonSingers.join('、')} / 歌った登録歌手 ${match.singerCount}人`;
      if (Math.min(song.singers.size, match.singerCount) < 2) reason.textContent += ' · 登録歌手が少ないため参考値';
      item.append(title, reason, this.youtubeLink(match.videoId, 'カバー動画を開く', match.title));
      list.appendChild(item);
    }
    this.results.append(list, this.note('歌手×楽曲行列を転置し、同じ歌手に歌われている楽曲を近くしています。多くの曲を歌う歌手の重みは下げています。'));
  }

  private renderArtists() {
    this.updateModeText();
    this.results.replaceChildren();
    const key = this.select.value;
    const artist = this.similarity.artistProfiles.get(key);
    if (!artist) return;
    const matches = this.similarity.findSimilarArtists(key);
    const points: MapPoint[] = this.similarity.createArtistMap().map(point => ({
      id: point.key,
      label: point.name,
      count: point.singerCount,
      x: point.x,
      y: point.y,
      countLabel: `${point.singerCount}人`,
    }));
    this.appendSummaryAndMap(
      `${points.length}組の原曲アーティストを全体配置。${artist.name}：登録曲 ${artist.songs.size}曲、歌った登録歌手 ${artist.singers.size}人。`,
      '原曲アーティストを歌った歌手の類似度で二次元に近似したマップ',
      points,
      matches.map(match => ({ id: match.key, score: match.score })),
      key,
      2,
      true,
    );
    if (!matches.length) {
      this.appendEmpty('この原曲アーティストの曲を歌った歌手による、別の原曲アーティストの登録曲はまだありません。');
      return;
    }
    const list = document.createElement('ol');
    for (const match of matches) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${match.name} · 類似度 ${Math.round(match.score * 100)}/100`;
      const reason = document.createElement('p');
      reason.textContent = `共通歌手 ${match.commonSingers.join('、')} / 登録 ${match.songCount}曲・${match.singerCount}人`;
      if (Math.min(artist.singers.size, match.singerCount) < 2) reason.textContent += ' · 登録歌手が少ないため参考値';
      item.append(title, reason, this.youtubeLink(match.videoId, 'カバー動画の例を開く', match.name));
      list.appendChild(item);
    }
    this.results.append(list, this.note('同じ歌手がカバーしている原曲アーティストを近くしています。多くの原曲アーティストを歌う歌手の重みは下げています。'));
  }

  private appendSummaryAndMap(
    summaryText: string,
    mapLabel: string,
    points: MapPoint[],
    matches: MapMatch[],
    selectedId: string,
    lowDataThreshold: number,
    denseLabels: boolean,
  ) {
    const summary = document.createElement('p');
    summary.textContent = summaryText;
    this.results.appendChild(summary);
    const map = document.createElement('div');
    map.className = 'discovery-map';
    if (denseLabels) map.classList.add('is-dense');
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', mapLabel);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 520');
    const positions = new Map(points.map(point => [point.id, {
      ...point, px: 40 + point.x * 720, py: 30 + point.y * 460,
    }]));
    const selected = positions.get(selectedId);
    if (selected) {
      for (const match of matches) {
        const target = positions.get(match.id);
        if (!target) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('discovery-link');
        line.setAttribute('x1', String(selected.px));
        line.setAttribute('y1', String(selected.py));
        line.setAttribute('x2', String(target.px));
        line.setAttribute('y2', String(target.py));
        line.style.opacity = String(0.2 + match.score * 0.75);
        line.style.strokeWidth = String(1 + match.score * 4);
        svg.appendChild(line);
      }
    }
    const neighborIds = new Set(matches.map(match => match.id));
    for (const point of positions.values()) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const isSelected = point.id === selectedId;
      group.classList.add('discovery-node');
      if (isSelected) group.classList.add('is-selected');
      if (neighborIds.has(point.id)) group.classList.add('is-neighbor');
      if (point.count < lowDataThreshold) group.classList.add('is-low-data');
      group.setAttribute('transform', `translate(${point.px} ${point.py})`);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `${point.label}、${point.countLabel}`);
      const radius = Math.min(11, 5 + Math.sqrt(point.count));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', String(isSelected ? radius + 3 : radius));
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('y', String(-radius - 5));
      label.textContent = point.label;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${point.label} · ${point.countLabel}`;
      const choose = () => {
        this.select.value = point.id;
        if (this.mode === 'singers') this.selectedSinger = point.id;
        else if (this.mode === 'songs') this.selectedSong = point.id;
        else this.selectedArtist = point.id;
        this.render();
      };
      group.addEventListener('click', choose);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose();
        }
      });
      group.append(circle, label, title);
      svg.appendChild(group);
    }
    map.appendChild(svg);
    this.results.append(map, this.note('近い点ほど傾向が似ています。軸・方向に意味はなく、下の数値が比較基準です。点の大きさは登録数、薄い点はデータが少ない項目です。'));
  }

  private appendEmpty(message: string) {
    const empty = document.createElement('p');
    empty.textContent = message;
    this.results.appendChild(empty);
  }

  private youtubeLink(videoId: string, text: string, description: string) {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${description}をYouTubeで開く（新しいタブ）`);
    return link;
  }

  private note(text: string) {
    const note = document.createElement('p');
    note.className = 'discovery-note';
    note.textContent = text;
    return note;
  }

  destroy() {
    this.dialog.remove();
    this.trigger.remove();
  }
}
