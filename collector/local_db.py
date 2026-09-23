"""Local JSON persistence and public snapshots for small, read-mostly datasets."""

import json
import os
import tempfile
from pathlib import Path
from threading import RLock

from .db import VideoRecord


class LocalJsonStore:
    def __init__(self, path: str, public_dir: str):
        self.path = Path(path)
        self.public_dir = Path(public_dir)
        self.lock = RLock()
        self.data = self._load()

    def _load(self):
        if not self.path.exists():
            return {"channels": {}, "videos": {}, "index": {}}
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Local collector store must be a JSON object")
        return {
            "channels": value.get("channels", {}),
            "videos": value.get("videos", {}),
            "index": value.get("index", {}),
        }

    def save(self):
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._atomic_json(self.path, self.data)
            self._export_public()

    def verify(self):
        self.save()

    def _atomic_json(self, path: Path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as output:
                json.dump(value, output, ensure_ascii=False, indent=2)
                output.write("\n")
            os.replace(temporary, path)
        except Exception:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass
            raise

    def _export_public(self):
        metadata_path = self.public_dir.parent / "singer-metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
        aliases = metadata.get("aliases", {})
        units = metadata.get("units", {})

        def expand_singers(names):
            return list(dict.fromkeys(
                member
                for name in names
                for member in units.get(aliases.get(name, name), [aliases.get(name, name)])
            ))

        videos = []
        singer_counts = {}
        singer_latest = {}
        singer_avatar = {}
        for records in self.data["index"].values():
            if not records:
                continue
            first = records[0]
            singers = expand_singers(record["singer_name"] for record in records)
            videos.append({
                key: first[key]
                for key in (
                    "video_id", "video_title", "channel_id", "song_title",
                    "original_song_id", "original_song_title", "original_artist_name",
                    "published_at", "thumbnail_url", "ai_stats", "comment_cloud",
                    "chorus_start_time", "chorus_end_time",
                )
                if first.get(key) is not None
            } | {"singers": singers})
            for singer in singers:
                singer_counts[singer] = singer_counts.get(singer, 0) + 1
                if first.get("published_at", "") >= singer_latest.get(singer, ("", ""))[0]:
                    singer_latest[singer] = (first.get("published_at", ""), first["video_id"])
                channel = self.data["channels"].get(first.get("channel_id", ""), {})
                if channel.get("channel_icon_url"):
                    singer_avatar.setdefault(singer, channel["channel_icon_url"])
        videos.sort(key=lambda video: video.get("published_at", ""), reverse=True)
        singers = [{
            "name": name,
            "video_count": count,
            "latest_video_id": singer_latest.get(name, ("", None))[1],
            "avatar_url": singer_avatar.get(name),
        } for name, count in sorted(singer_counts.items(), key=lambda item: item[0].lower())]
        self._atomic_json(self.public_dir / "videos.json", videos)
        self._atomic_json(self.public_dir / "singers.json", singers)


_stores = {}


def get_store(settings) -> LocalJsonStore:
    key = (settings.local_store_path, settings.public_data_dir)
    if key not in _stores:
        _stores[key] = LocalJsonStore(*key)
    return _stores[key]


class LocalVideoRepository:
    def __init__(self, store: LocalJsonStore):
        self.store = store

    def verify_table_access(self):
        self.store.verify()

    def list_existing_video_ids(self, channel_id):
        return set(self.store.data["videos"].get(channel_id, {}))

    def upsert_video(self, video):
        channel = self.store.data["videos"].setdefault(video.channel_id, {})
        existing = channel.get(video.video_id, {})
        channel[video.video_id] = existing | {
            "video_id": video.video_id,
            "video_title": video.title,
            "channel_id": video.channel_id,
            "description": video.description,
            "duration": video.duration,
            "published_at": video.published_at,
            "thumbnail_url": video.thumbnail_url,
            "view_count": video.view_count,
            "like_count": video.like_count,
            "comment_count": video.comment_count,
            "channel_title": video.channel_title,
            "live_broadcast_content": getattr(
                video, "live_broadcast_content", "none"
            ),
            "has_live_streaming_details": getattr(
                video, "has_live_streaming_details", False
            ),
        }
        self.store.save()

    def upsert_channel_info(self, channel_id, channel_name, channel_icon_url, subscriber_count=0):
        self.store.data["channels"][channel_id] = {
            "channel_name": channel_name,
            "channel_icon_url": channel_icon_url,
            "subscriber_count": subscriber_count,
        }
        self.store.save()

    def get_video(self, channel_id, video_id):
        value = self.store.data["videos"].get(channel_id, {}).get(video_id)
        return VideoRecord(**{
            key: value.get(key, default)
            for key, default in {
                "video_id": "", "video_title": "", "channel_id": "",
                "description": "", "duration": None, "published_at": "",
                "song_title": "", "game_title": "", "view_count": 0,
                "like_count": 0, "comment_count": 0, "channel_title": "",
                "original_song_id": "", "grounding_status": "", "video_type": "",
                "thumbnail_url": "",
                "live_broadcast_content": "none",
                "has_live_streaming_details": False,
            }.items()
        }) if value else None

    def list_videos_by_channel(self, channel_id):
        return [self.get_video(channel_id, video_id)
                for video_id in self.store.data["videos"].get(channel_id, {})]

    def update_video_type(self, channel_id, video_id, video_type):
        self.store.data["videos"][channel_id][video_id]["video_type"] = video_type
        self.store.save()

    def update_grounding(self, channel_id, video_id, grounding):
        video = self.store.data["videos"][channel_id][video_id]
        video["grounding_status"] = grounding.get("status", "unresolved")
        video["grounding"] = grounding
        self.store.save()

    def update_song_info(self, channel_id, video_id, song_title, singers, is_cover,
                         link=None, ai_stats=None, comment_cloud=None,
                         chorus_start_time=None, chorus_end_time=None,
                         original_song_id=None, original_artist_name=None):
        video = self.store.data["videos"][channel_id][video_id]
        video.update({
            "video_type": "SONG", "song_title": song_title, "singers": singers,
            "is_cover": is_cover, "original_song_title": song_title,
            "original_song_id": original_song_id,
            "original_artist_name": original_artist_name,
        })
        for key, value in {
            "link": link, "ai_stats": ai_stats, "comment_cloud": comment_cloud,
            "chorus_start_time": chorus_start_time, "chorus_end_time": chorus_end_time,
        }.items():
            if value is not None:
                video[key] = value
        self.store.save()


class LocalSingerVideoIndexRepository:
    def __init__(self, store: LocalJsonStore):
        self.store = store

    def verify_table_access(self):
        self.store.verify()

    def delete_singer_video_index(self, video_id):
        self.store.data["index"].pop(video_id, None)
        self.store.save()

    def upsert_singer_video_index(self, **values):
        records = []
        for singer in values["singers"]:
            record = {key: value for key, value in values.items() if key != "singers"}
            record["singer_name"] = singer
            records.append(record)
        self.store.data["index"][values["video_id"]] = records
        self.store.save()
