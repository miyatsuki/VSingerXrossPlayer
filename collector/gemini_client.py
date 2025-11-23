"""
Gemini API client for video enrichment.

Uses Gemini API with Google Search grounding to:
1. Classify video type (SONG/GAME/UNKNOWN)
2. Extract song information (title, singers, original artists)
3. Analyze video characteristics (cool, cute, energetic, surprising, emotional)
4. Extract characteristic keywords from comments
"""

import json
from typing import Any, Dict, List

from google import genai
from google.genai import types


class GeminiClient:
    """Client for Gemini API with Google Search grounding."""

    def __init__(self, api_key: str, model: str = "gemini-3-pro-preview"):
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

    def analyze_video_characteristics(
        self, video_id: str, comments: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """
        Analyze video characteristics using Gemini Video Understanding API.

        Args:
          video_id: YouTube video ID
          comments: List of comment dicts with "text" and "likeCount" keys

        Returns:
          {
            "cool": 0-100,
            "cute": 0-100,
            "energetic": 0-100,
            "surprising": 0-100,
            "emotional": 0-100
          }
        """
        # Format comments for analysis
        comment_text = "\n".join(
            [f"- {c['text']} (👍{c['likeCount']})" for c in comments[:20]]
        )

        youtube_url = f"https://www.youtube.com/watch?v={video_id}"

        prompt = f"""このYouTube動画（歌ってみた動画）を視聴して、以下の5つの特性を0-100のスケールで評価してください。

動画URL: {youtube_url}

視聴者コメント（参考情報）:
{comment_text}

評価軸:
1. **かっこいい (cool)**: 曲調・歌唱・映像の格好良さ、力強さ、スタイリッシュさ
   - 低 (0-30): 可愛い系、優しい系
   - 中 (31-70): バランス型
   - 高 (71-100): 激しい、ダーク、格好良い

2. **かわいい (cute)**: 曲調・歌声・雰囲気の可愛らしさ、愛らしさ
   - 低 (0-30): ハードコア、ダーク系
   - 中 (31-70): バランス型
   - 高 (71-100): キュート、ポップ、愛らしい

3. **元気 (energetic)**: 曲のテンポ、エネルギー、明るさ、勢い
   - 低 (0-30): スローテンポ、バラード
   - 中 (31-70): ミディアムテンポ
   - 高 (71-100): アップテンポ、ハイテンション

4. **意外性 (surprising)**: 予想外の展開、ユニークさ、独創性
   - 低 (0-30): 王道、定番
   - 中 (31-70): やや個性的
   - 高 (71-100): 独特、実験的、サプライズ要素

5. **エモい (emotional)**: 感情的な深み、心に響く度合い、感動
   - 低 (0-30): 軽快、楽しい系
   - 中 (31-70): バランス型
   - 高 (71-100): 感動的、切ない、心に響く

以下のJSON形式で回答してください:
{{
  "cool": 0-100の整数,
  "cute": 0-100の整数,
  "energetic": 0-100の整数,
  "surprising": 0-100の整数,
  "emotional": 0-100の整数
}}

注意: 動画の音響・映像とコメントの両方を総合的に評価してください。"""

        try:
            # Analyze YouTube video directly using Video Understanding API
            response = self.client.models.generate_content(
                model=self.model,
                contents=types.Content(
                    parts=[
                        types.Part(file_data=types.FileData(file_uri=youtube_url)),
                        types.Part(text=prompt),
                    ]
                ),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=1,
                ),
            )

            result = json.loads(response.text)
            return {
                "cool": result.get("cool", 50),
                "cute": result.get("cute", 50),
                "energetic": result.get("energetic", 50),
                "surprising": result.get("surprising", 50),
                "emotional": result.get("emotional", 50),
            }
        except Exception as e:
            print(f"Error analyzing video characteristics: {e}")
            # Return neutral defaults on error
            return {
                "cool": 50,
                "cute": 50,
                "energetic": 50,
                "surprising": 50,
                "emotional": 50,
            }

    def extract_comment_keywords(
        self, comments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Extract characteristic keywords from comments using Gemini API.

        Args:
          comments: List of comment dicts with "text" and "likeCount" keys

        Returns:
          [
            {"word": "キーワード1", "importance": 0-100},
            {"word": "キーワード2", "importance": 0-100},
            ...
          ] (Top 10-20 words)
        """
        if not comments:
            return []

        # Format comments for analysis
        comment_text = "\n".join([f"- {c['text']}" for c in comments[:100]])

        prompt = f"""以下のYouTube動画のコメントから、特徴的なキーワードを抽出してください。

コメント:
{comment_text}

タスク:
1. コメント全体から頻出する特徴的な単語・フレーズを抽出
2. **抽出対象**: 以下のカテゴリに該当する言葉を重視
   - 歌唱評価: 「上手い」「声が良い」「安定感」「表現力」など
   - 感情表現: 「エモい」「泣ける」「感動」「切ない」「鳥肌」など
   - 楽曲特徴: 「高音」「低音」「アレンジ」「テンポ」「リズム」など
   - 雰囲気/印象: 「かっこいい」「かわいい」「儚い」「力強い」など
3. **除外対象**: 以下は必ず除外
   - 固有名詞: 歌手名、曲名、アーティスト名、キャラクター名
   - 一般的すぎる言葉: 「好き」「すごい」「最高」「神」単体
   - 時間・日付表現: 「今日」「昨日」「○○年」など
4. Top 10-20個のキーワードを重要度順に並べる
5. 重要度は0-100のスケールで評価（頻出度・いいね数・文脈の重要性を考慮）

以下のJSON形式で回答してください:
{{
  "keywords": [
    {{"word": "キーワード1", "importance": 0-100}},
    {{"word": "キーワード2", "importance": 0-100}},
    ...
  ]
}}

注意:
- この動画の歌唱や楽曲の特徴を表す言葉を優先
- 10-20個程度に絞る
- 固有名詞は絶対に含めない"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=1,
                ),
            )

            result = json.loads(response.text)
            keywords = result.get("keywords", [])

            # Ensure we have word and importance keys
            return [
                {"word": kw.get("word", ""), "importance": kw.get("importance", 0)}
                for kw in keywords
                if kw.get("word")
            ][
                :20
            ]  # Limit to top 20

        except Exception as e:
            print(f"Error extracting comment keywords: {e}")
            return []

    def extract_chorus_time(self, video_id: str) -> Dict[str, Any]:
        """
        Extract chorus (サビ) timestamp from YouTube video.

        Args:
          video_id: YouTube video ID

        Returns:
          {
            "chorus_start_time": int (seconds) | None,
            "chorus_end_time": int (seconds) | None,
            "confidence": 0.0-1.0,
            "description": str
          }
        """
        youtube_url = f"https://www.youtube.com/watch?v={video_id}"

        prompt = f"""このYouTube動画（歌ってみた動画）を分析して、最も盛り上がる「サビ（chorus）」部分の時間帯を特定してください。

動画URL: {youtube_url}

タスク:
1. 楽曲の構造を分析し、最も盛り上がる「サビ」のセクションを特定
2. サビの開始時間と終了時間を秒数で取得
3. 判定の確信度（0.0-1.0）を評価
4. サビの特徴を簡潔に説明

判定基準:
- サビは楽曲の中で最もメロディックで印象的なセクション
- 通常、楽曲の中盤から後半に登場し、繰り返されることが多い
- ボーカルの音量や楽器の厚みが最大になる部分
- 複数のサビがある場合は、最初の完全なサビを返す

以下のJSON形式で回答してください:
{{
  "chorus_start_time": サビ開始時間（秒数の整数）,
  "chorus_end_time": サビ終了時間（秒数の整数）,
  "confidence": 0.0-1.0の信頼度,
  "description": "サビの特徴（音楽的な説明）"
}}

注意事項:
- タイムスタンプは必ず秒数の整数で返してください
- サビが特定できない場合は、confidence を 0.0 にしてください
- 開始時間は終了時間より小さい値にしてください"""

        try:
            # Analyze YouTube video directly using Video Understanding API
            response = self.client.models.generate_content(
                model=self.model,
                contents=types.Content(
                    parts=[
                        types.Part(file_data=types.FileData(file_uri=youtube_url)),
                        types.Part(text=prompt),
                    ]
                ),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=1,
                ),
            )

            result = json.loads(response.text)
            return {
                "chorus_start_time": result.get("chorus_start_time"),
                "chorus_end_time": result.get("chorus_end_time"),
                "confidence": result.get("confidence", 0.0),
                "description": result.get("description", ""),
            }
        except Exception as e:
            print(f"Error extracting chorus time: {e}")
            return {
                "chorus_start_time": None,
                "chorus_end_time": None,
                "confidence": 0.0,
                "description": f"Error: {e}",
            }
