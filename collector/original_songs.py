"""Resolve grounded song metadata to reproducible IDs, with curated overrides."""
import hashlib
import json
import unicodedata
from pathlib import Path


def normalize(value: str) -> str:
    return ' '.join(unicodedata.normalize('NFKC', value).split()).lower()


class OriginalSongs:
    def __init__(self, path=None):
        self.aliases = {}
        self.videos = {}
        entries = json.loads(Path(path).read_text()) if path else []
        ids = set()
        if not isinstance(entries, list):
            raise ValueError('Original song catalog must be a list')
        for entry in entries:
            if not isinstance(entry, dict) or any(
                not isinstance(entry.get(key), str) or not entry[key].strip()
                for key in ('id', 'title', 'artist')
            ):
                raise ValueError('Invalid original song catalog entry')
            if entry['id'] in ids or entry['id'] != entry['id'].strip():
                raise ValueError('Duplicate or invalid original song ID')
            ids.add(entry['id'])
            for alias in [entry, *entry.get('aliases', [])]:
                key = (normalize(alias['title']), normalize(alias['artist']))
                if not all(key) or (key in self.aliases and self.aliases[key]['id'] != entry['id']):
                    raise ValueError('Conflicting original song alias')
                self.aliases[key] = entry
            for video_id in entry.get('videoIds', []):
                if not isinstance(video_id, str) or not video_id.strip() or (
                    video_id in self.videos and self.videos[video_id]['id'] != entry['id']
                ):
                    raise ValueError('Conflicting original song video mapping')
                self.videos[video_id] = entry

    def resolve(self, title, artists, video_id=''):
        # Catalog entries are explicit; derived IDs are not globally authoritative IDs.
        matches = {entry['id']: entry for artist in artists
                   if (entry := self.aliases.get((normalize(title), normalize(artist))))}
        entry = self.videos.get(video_id)
        if not entry and len(matches) == 1:
            entry = next(iter(matches.values()))
        if entry:
            return entry['id'], entry['title'], [entry['artist']], 'catalog'
        if len(matches) > 1:
            raise ValueError('Multiple originals match the extracted artists')
        artist_keys = sorted({normalize(artist) for artist in artists if normalize(artist)})
        if not normalize(title) or not artist_keys:
            return None, title, artists, 'unresolved'
        identity = json.dumps([normalize(title), artist_keys], ensure_ascii=False, separators=(',', ':'))
        key = 'title-artist:v1:' + hashlib.sha256(identity.encode()).hexdigest()
        return key, title, artists, 'title_artist'
