import { SingerSimilarity } from '../utils/singerSimilarity';
import './singerDiscovery.css';

export class SingerDiscovery {
  private trigger = document.createElement('button');
  private dialog = document.createElement('dialog');
  private select = document.createElement('select');
  private results = document.createElement('div');

  constructor(parent: HTMLElement, private similarity: SingerSimilarity, onOpen: () => void, onClose: () => void) {
    this.trigger.className = 'discovery-trigger';
    this.trigger.textContent = '選曲が近い歌手を探す';
    this.trigger.type = 'button';
    this.trigger.disabled = similarity.repertoires.size === 0;
    this.trigger.onclick = () => {
      this.render();
      this.dialog.showModal();
      onOpen();
    };
    this.dialog.className = 'singer-discovery';
    this.dialog.setAttribute('aria-labelledby', 'discovery-title');
    const heading = document.createElement('h2');
    heading.id = 'discovery-title';
    heading.textContent = '選曲が近い歌手';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '閉じる';
    close.onclick = () => this.dialog.close();
    const header = document.createElement('header');
    header.append(heading, close);
    const label = document.createElement('label');
    label.textContent = '基準にする歌手 ';
    for (const singer of similarity.repertoires.keys()) {
      const option = document.createElement('option');
      option.value = singer;
      option.textContent = singer;
      this.select.appendChild(option);
    }
    this.select.onchange = () => this.render();
    label.appendChild(this.select);
    this.results.setAttribute('aria-live', 'polite');
    this.dialog.append(header, label, this.results);
    this.dialog.addEventListener('close', () => {
      onClose();
      this.trigger.focus();
    });
    parent.append(this.trigger, this.dialog);
  }

  setSinger(singer: string) {
    if (this.similarity.repertoires.has(singer)) this.select.value = singer;
  }

  private render() {
    this.results.replaceChildren();
    const singer = this.select.value;
    const count = this.similarity.repertoires.get(singer)?.songs.size || 0;
    const matches = this.similarity.findSimilar(singer);
    const points = this.similarity.createMap();
    const summary = document.createElement('p');
    summary.textContent = `${points.length}人を全体配置。${singer}：比較できる登録曲 ${count}曲。`;
    this.results.appendChild(summary);

    const map = document.createElement('div');
    map.className = 'discovery-map';
    map.setAttribute('role', 'group');
    map.setAttribute('aria-label', '全歌手の選曲類似度を二次元に近似したマップ');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 520');
    const positions = new Map(points.map(point => [point.singer, {
      ...point,
      px: 40 + point.x * 720,
      py: 30 + point.y * 460,
    }]));
    const selected = positions.get(singer);
    if (selected) {
      for (const match of matches) {
        const target = positions.get(match.singer);
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
    const neighborNames = new Set(matches.map(match => match.singer));
    for (const point of positions.values()) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const isSelected = point.singer === singer;
      group.classList.add('discovery-node');
      if (isSelected) group.classList.add('is-selected');
      if (neighborNames.has(point.singer)) group.classList.add('is-neighbor');
      if (point.songCount < 3) group.classList.add('is-low-data');
      group.setAttribute('transform', `translate(${point.px} ${point.py})`);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `${point.singer}、比較できる登録曲${point.songCount}曲`);
      const radius = Math.min(11, 5 + Math.sqrt(point.songCount));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', String(isSelected ? radius + 3 : radius));
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('y', String(-radius - 5));
      label.textContent = point.singer;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${point.singer} · ${point.songCount}曲`;
      const choose = () => {
        this.select.value = point.singer;
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
    const note = document.createElement('p');
    note.className = 'discovery-note';
    note.textContent = '全歌手間の類似度を2次元へ近似しています。近い点ほど選曲が似る傾向がありますが、軸・方向に意味はなく、実際の類似度は下の数値が基準です。点の大きさは登録曲数、薄い点は3曲未満です。';
    this.results.append(map, note);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.textContent = 'この歌手と共通の原曲が登録されている歌手はまだいません。曲名が未登録の動画は比較対象外です。';
      this.results.appendChild(empty);
      return;
    }
    const list = document.createElement('ol');
    for (const match of matches) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${match.singer} · 類似度 ${Math.round(match.score * 100)}/100`;
      const reason = document.createElement('p');
      reason.textContent = `共通 ${match.commonSongs.length}曲 / 相手の登録 ${match.songCount}曲`;
      if (Math.min(count, match.songCount) < 3) reason.textContent += ' · 登録曲が少ないため参考値';
      const songs = document.createElement('div');
      songs.className = 'discovery-songs';
      for (const song of match.commonSongs) {
        const link = document.createElement('a');
        link.textContent = `${song.title}${song.artist ? ` / ${song.artist}` : ''}${song.provisional ? '（曲名のみの暫定照合）' : ''}`;
        link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(song.videoId)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${match.singer}の${song.title}をYouTubeで開く（新しいタブ）`);
        songs.appendChild(link);
      }
      item.append(title, reason, songs);
      list.appendChild(item);
    }
    const limitation = document.createElement('p');
    limitation.className = 'discovery-note';
    limitation.textContent = '原曲ID、または曲名と原曲アーティストで比較しています。アーティスト不明の曲は曲名だけで暫定照合し、原曲が特定された曲とは分けて集計します。定番曲の重みを下げ、同じ曲の複数投稿は1曲として集計しています。';
    this.results.append(list, limitation);
  }

  destroy() {
    this.dialog.remove();
    this.trigger.remove();
  }
}
