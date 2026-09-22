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
    const summary = document.createElement('p');
    summary.textContent = `${singer}：比較できる登録曲 ${count}曲。共通曲のある上位${matches.length}人を表示。`;
    this.results.appendChild(summary);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.textContent = '共通の原曲が登録されている歌手がまだいません。曲名が未登録の動画は比較対象外です。';
      this.results.appendChild(empty);
      return;
    }

    const map = document.createElement('div');
    map.className = 'discovery-map';
    map.setAttribute('role', 'img');
    map.setAttribute('aria-label', '中心が選択中の歌手。番号は下の一覧に対応し、中心に近いほど選曲が似ています。');
    const center = document.createElement('span');
    center.className = 'discovery-center';
    center.textContent = '基準';
    map.appendChild(center);
    matches.forEach((match, index) => {
      // The central glyph needs clearance; the remaining radius encodes 1 - cosine.
      const radius = 12 + 32 * (1 - match.score);
      const angle = -Math.PI / 2 + index * 2 * Math.PI / matches.length;
      const dot = document.createElement('span');
      dot.className = 'discovery-dot';
      dot.textContent = String(index + 1);
      dot.style.left = `${50 + radius * Math.cos(angle)}%`;
      dot.style.top = `${50 + radius * Math.sin(angle)}%`;
      map.appendChild(dot);
    });
    const note = document.createElement('p');
    note.className = 'discovery-note';
    note.textContent = '中心に近いほど選曲が似ています。方向と、周囲の歌手同士の距離には意味がありません。';
    this.results.append(map, note);
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
