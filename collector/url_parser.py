"""
YouTube URL parser for extracting channel identifiers.

Supports multiple YouTube URL formats:
- https://www.youtube.com/channel/UCxxxx
- https://www.youtube.com/user/username
- https://www.youtube.com/@handle
- https://www.youtube.com/c/customname (detected but not API-resolvable)
- https://www.youtube.com/watch?v=VIDEO_ID (resolves to channel)
- https://youtu.be/VIDEO_ID (resolves to channel)
- Direct channel ID: UCxxxx
- Direct handle: @handle
"""

import re
from enum import Enum
from typing import Tuple


class IdentifierType(Enum):
    """Type of YouTube identifier."""

    CHANNEL_ID = "channel_id"
    USERNAME = "username"
    HANDLE = "handle"
    CUSTOM_URL = "custom_url"  # Not API-resolvable
    VIDEO_ID = "video_id"  # Resolves to channel via video metadata


def parse_youtube_url(url_or_id: str) -> Tuple[IdentifierType, str]:
    """
    Parse a YouTube URL or identifier and extract the channel identifier.

    Args:
        url_or_id: YouTube URL, channel ID, username, or handle

    Returns:
        Tuple of (IdentifierType, identifier_value)

    Raises:
        ValueError: If the format is not recognized or supported

    Examples:
        >>> parse_youtube_url("https://www.youtube.com/channel/UCxxxxxx")
        (IdentifierType.CHANNEL_ID, "UCxxxxxx")

        >>> parse_youtube_url("https://www.youtube.com/user/SomeUser")
        (IdentifierType.USERNAME, "SomeUser")

        >>> parse_youtube_url("https://www.youtube.com/@handle")
        (IdentifierType.HANDLE, "handle")

        >>> parse_youtube_url("UCxxxxxx")
        (IdentifierType.CHANNEL_ID, "UCxxxxxx")

        >>> parse_youtube_url("@handle")
        (IdentifierType.HANDLE, "handle")
    """
    url_or_id = url_or_id.strip()

    # Pattern 1: /watch?v=VIDEO_ID (video URL)
    watch_match = re.search(r"youtube\.com/watch\?v=([A-Za-z0-9_-]+)", url_or_id)
    if watch_match:
        return (IdentifierType.VIDEO_ID, watch_match.group(1))

    # Pattern 2: youtu.be/VIDEO_ID (short video URL)
    short_match = re.search(r"youtu\.be/([A-Za-z0-9_-]+)", url_or_id)
    if short_match:
        return (IdentifierType.VIDEO_ID, short_match.group(1))

    # Pattern 3: /channel/UCxxxx (channel ID in URL)
    channel_match = re.search(r"youtube\.com/channel/([A-Za-z0-9_-]+)", url_or_id)
    if channel_match:
        return (IdentifierType.CHANNEL_ID, channel_match.group(1))

    # Pattern 4: /user/username (username in URL)
    user_match = re.search(r"youtube\.com/user/([A-Za-z0-9_-]+)", url_or_id)
    if user_match:
        return (IdentifierType.USERNAME, user_match.group(1))

    # Pattern 5: /@handle (handle in URL)
    handle_url_match = re.search(r"youtube\.com/@([A-Za-z0-9_-]+)", url_or_id)
    if handle_url_match:
        return (IdentifierType.HANDLE, handle_url_match.group(1))

    # Pattern 6: /c/customname (custom URL - not API-resolvable)
    custom_match = re.search(r"youtube\.com/c/([A-Za-z0-9_-]+)", url_or_id)
    if custom_match:
        return (IdentifierType.CUSTOM_URL, custom_match.group(1))

    # Pattern 7: Direct channel ID (starts with UC, typically 24 chars)
    if re.match(r"^UC[A-Za-z0-9_-]{22}$", url_or_id):
        return (IdentifierType.CHANNEL_ID, url_or_id)

    # Pattern 8: Direct handle (@handle)
    if url_or_id.startswith("@"):
        handle = url_or_id[1:]  # Remove @ prefix
        if re.match(r"^[A-Za-z0-9_-]+$", handle):
            return (IdentifierType.HANDLE, handle)

    # If none of the patterns match, raise an error
    raise ValueError(
        f"Unrecognized YouTube URL or identifier format: {url_or_id}\n"
        f"Supported formats:\n"
        f"  - https://www.youtube.com/watch?v=VIDEO_ID (video URL)\n"
        f"  - https://youtu.be/VIDEO_ID (short video URL)\n"
        f"  - https://www.youtube.com/channel/UCxxxx (channel URL)\n"
        f"  - https://www.youtube.com/user/username (username)\n"
        f"  - https://www.youtube.com/@handle (handle)\n"
        f"  - Direct channel ID: UCxxxx\n"
        f"  - Direct handle: @handle\n"
        f"Note: /c/customname URLs are not directly supported by the API. "
        f"Please visit the channel in a browser to get the channel ID from the URL."
    )
