"""Persistent registry of YouTube channels collected by the CLI."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, TypedDict

from .config import get_collector_settings
from .youtube_client import YouTubeClient


class ChannelRegistration(TypedDict):
    channel_name: str
    singers: List[str]


def load_channel_registry(path: str | Path) -> Dict[str, ChannelRegistration]:
    registry_path = Path(path)
    if not registry_path.exists():
        return {}
    value = json.loads(registry_path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Channel registry must be a JSON object")
    channels = {}
    for channel_id, registration in value.items():
        if not isinstance(channel_id, str) or not channel_id.startswith("UC"):
            raise ValueError("Channel registry keys must be YouTube channel IDs")
        # Read the original string format so existing installations can migrate
        # when they next register a channel.
        if isinstance(registration, str) and registration.strip():
            channels[channel_id] = {
                "channel_name": registration.strip(),
                "singers": [registration.strip()],
            }
            continue
        if not isinstance(registration, dict):
            raise ValueError("Each channel registration must be an object")
        channel_name = registration.get("channel_name")
        singers = registration.get("singers", [])
        if not isinstance(channel_name, str) or not channel_name.strip():
            raise ValueError("Each channel registration requires channel_name")
        if not isinstance(singers, list) or any(
            not isinstance(singer, str) or not singer.strip() for singer in singers
        ):
            raise ValueError("Channel singers must be an array of non-empty names")
        channels[channel_id] = {
            "channel_name": channel_name.strip(),
            "singers": list(dict.fromkeys(singer.strip() for singer in singers)),
        }
    return channels


def save_channel_registry(
    path: str | Path,
    channels: Dict[str, ChannelRegistration],
) -> None:
    registry_path = Path(path)
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(
        dir=registry_path.parent,
        prefix=f".{registry_path.name}.",
    )
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as output:
            json.dump(channels, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, registry_path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def register_channel(
    identifier: str,
    youtube_client: YouTubeClient,
    registry_path: str | Path,
    singer_names: List[str] | None = None,
) -> tuple[str, ChannelRegistration, bool]:
    channel_id = youtube_client.resolve_channel_id(identifier)
    channel_info = youtube_client.fetch_channel_info(channel_id)
    channels = load_channel_registry(registry_path)
    added = channel_id not in channels
    existing_singers = channels.get(channel_id, {}).get("singers", [])
    supplied_singers = [name.strip() for name in singer_names or [] if name.strip()]
    registration: ChannelRegistration = {
        "channel_name": channel_info["channel_name"],
        "singers": list(dict.fromkeys(existing_singers + supplied_singers)),
    }
    channels[channel_id] = registration
    save_channel_registry(registry_path, channels)
    return channel_id, registration, added


def cli() -> int:
    parser = argparse.ArgumentParser(
        description="Register a YouTube channel for subsequent collection",
    )
    parser.add_argument(
        "--channel-url", "--channel-id",
        action="append",
        dest="channels",
        required=True,
        help="YouTube channel/video URL, handle, or channel ID (repeatable)",
    )
    parser.add_argument(
        "--singer-name",
        action="append",
        dest="singer_names",
        help="Possible singer name for this channel (repeatable; one channel only)",
    )
    args = parser.parse_args()
    if args.singer_names and len(args.channels) != 1:
        parser.error("--singer-name can only be used with one channel")

    settings = get_collector_settings()
    youtube_client = YouTubeClient(settings.youtube_api_key)
    failures = 0
    for identifier in args.channels:
        try:
            channel_id, registration, added = register_channel(
                identifier,
                youtube_client,
                settings.singer_channels_path,
                args.singer_names,
            )
            action = "Registered" if added else "Updated"
            singers = ", ".join(registration["singers"]) or "auto-detect per video"
            print(
                f"{action}: {channel_id} - {registration['channel_name']} "
                f"(singers: {singers})"
            )
        except Exception as error:
            failures += 1
            print(f"Failed to register {identifier}: {error}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(cli())
