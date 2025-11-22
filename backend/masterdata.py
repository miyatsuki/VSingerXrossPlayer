from typing import Dict, List

from .models import AIStats, MasterData, Singer, Song

SINGERS: List[Singer] = [
    Singer(
        id="1",
        name="Hoshimachi Suisei",
        avatar_url="https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj",
        ai_characteristics=AIStats(energy=90, mood=80, vocal=95, instrumental=60),
    ),
    Singer(
        id="2",
        name="Ado",
        avatar_url="https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj",
        ai_characteristics=AIStats(energy=95, mood=40, vocal=98, instrumental=70),
    ),
    Singer(
        id="3",
        name="Kaf",
        avatar_url="https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj",
        ai_characteristics=AIStats(energy=60, mood=90, vocal=92, instrumental=80),
    ),
]


SONG_AVERAGES: Dict[str, AIStats] = {
    "Stellar Stellar": AIStats(energy=80, mood=75, vocal=85, instrumental=75),
    "Usseewa": AIStats(energy=90, mood=30, vocal=90, instrumental=80),
    "Phony": AIStats(energy=70, mood=60, vocal=80, instrumental=70),
}


REFERENCE_SONGS: List[Song] = [
    Song(
        id="101",
        title="Stellar Stellar",
        video_url="a51VH9BYzZA",
        singer_id="1",
        ai_stats=AIStats(energy=95, mood=80, vocal=98, instrumental=80),
        average_stats=SONG_AVERAGES["Stellar Stellar"],
    ),
    Song(
        id="103",
        title="Phony",
        video_url="9d5s9h2d",
        singer_id="1",
        ai_stats=AIStats(energy=75, mood=65, vocal=90, instrumental=70),
        average_stats=SONG_AVERAGES["Phony"],
    ),
    Song(
        id="102",
        title="Usseewa",
        video_url="Qp3b-RXtz4w",
        singer_id="2",
        ai_stats=AIStats(energy=98, mood=20, vocal=95, instrumental=85),
        average_stats=SONG_AVERAGES["Usseewa"],
    ),
    Song(
        id="104",
        title="Phony",
        video_url="mock_kaf_phony",
        singer_id="3",
        ai_stats=AIStats(energy=65, mood=85, vocal=88, instrumental=70),
        average_stats=SONG_AVERAGES["Phony"],
    ),
]


MASTER_DATA = MasterData(
    singers=SINGERS,
    reference_songs=REFERENCE_SONGS,
    song_averages=SONG_AVERAGES,
)
