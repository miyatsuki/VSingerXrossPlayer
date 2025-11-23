"""
Gemini API client for video enrichment.

Uses Gemini API with Google Search grounding to:
1. Classify video type (SONG/GAME/UNKNOWN)
2. Extract song information (title, singers, original artists)
"""

import json
from typing import Any, Dict

from google import genai
from google.genai import types


class GeminiClient:
    """Client for Gemini API with Google Search grounding."""

    def __init__(self, api_key: str, model: str = "gemini-3.0-pro-preview"):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def classify_video_type(self, title: str, description: str) -> Dict[str, Any]:
        """
        Classify video type using Gemini API.

        Args:
          title: Video title
          description: Video description

        Returns:
          {
            "type": "SONG" | "GAME" | "UNKNOWN",
            "confidence": 0.0-1.0,
            "reason": str
          }
        """
        prompt = f"""以下のYouTube動画情報から、この動画のタイプを判定してください。

タイトル: {title}
説明: {description}

判定基準:
- SONG: VTuber/歌い手が楽曲をカバー・歌唱している「歌ってみた」動画
- GAME: ゲーム実況やプレイ動画
- UNKNOWN: その他（雑談、配信アーカイブ、企画動画など）

以下のJSON形式で回答してください:
{{
  "type": "SONG" | "GAME" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "reason": "判定理由の簡潔な説明"
}}"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=1,  # Deterministic output
                ),
            )

            result = json.loads(response.text)
            return {
                "type": result.get("type", "UNKNOWN"),
                "confidence": result.get("confidence", 0.0),
                "reason": result.get("reason", ""),
            }
        except Exception as e:
            print(f"Error classifying video type: {e}")
            return {"type": "UNKNOWN", "confidence": 0.0, "reason": f"Error: {e}"}

    def extract_song_info(
        self, title: str, description: str, channel_name: str = ""
    ) -> Dict[str, Any]:
        """
        Extract song information using Gemini API with Google Search grounding.

        Args:
          title: Video title
          description: Video description
          channel_name: YouTube channel name

        Returns:
          {
            "song_title": str,
            "singers": [str],
            "is_cover": bool,
            "original_artists": [str],
            "original_url": str | None
          }
        """
        channel_info = f"\nチャンネル名: {channel_name}" if channel_name else ""

        prompt = f"""以下のVTuber/歌い手の「歌ってみた」動画から、楽曲情報を抽出してください。{channel_info}

動画タイトル: {title}
説明: {description}

タスク:
1. 楽曲名（正式名称）を特定してください。Google検索で確認してください。
2. 歌い手名を特定してください。通常はチャンネル名と一致します。
3. カバー曲かオリジナル曲かを判定してください。
4. カバー曲の場合、原曲のアーティスト名を特定してください。
5. 可能であれば、原曲の公式YouTube URLを見つけてください。

以下のJSON形式で回答してください:
{{
  "song_title": "楽曲名（正式名称）",
  "singers": ["歌い手名1", "歌い手名2"],
  "is_cover": true/false,
  "original_artists": ["原曲アーティスト名1", "原曲アーティスト名2"],
  "original_url": "原曲のYouTube URL（見つかった場合のみ）"
}}

注意事項:
- 楽曲名は必ずGoogle検索で正式名称を確認してください
- コラボ動画の場合、全員を singers に含めてください
- カバー曲の場合のみ is_cover を true にしてください
- original_url が見つからない場合は null を返してください"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    # Enable Google Search grounding
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                    temperature=1,
                ),
            )

            result = json.loads(response.text)

            return {
                "song_title": result.get("song_title", ""),
                "singers": result.get("singers", []),
                "is_cover": result.get("is_cover", True),
                "original_artists": result.get("original_artists", []),
                "original_url": result.get("original_url"),
            }
        except Exception as e:
            print(f"Error extracting song info: {e}")
            return {
                "song_title": "",
                "singers": [],
                "is_cover": True,
                "original_artists": [],
                "original_url": None,
            }
