# VSingerXrossPlayer Collector

YouTubeの動画情報を収集し、GeminiのGoogle Search groundingで原曲を特定します。既定ではローカルJSONへ保存し、必要に応じてDynamoDBへ切り替えられます。

## セットアップ

Python 3.11以上とuvを使用します。

```bash
cd collector
uv sync
cp .env.example .env
```

`.env` にYouTube／GeminiのAPIキーを設定してください。既定の保存先はローカルJSONで、
AWS認証は不要です。キーはコミットしないでください。

ローカルでAWS CLIのプロファイルを使う例です。

```bash
aws configure
aws sts get-caller-identity
```

SSOを使う場合は `aws sso login --profile PROFILE_NAME` の後に
`AWS_PROFILE=PROFILE_NAME` を `collector/.env` に設定します。収集開始時に両テーブルへの
参照権限を確認し、認証やテーブルがなければYouTube/Gemini APIを呼ぶ前に終了します。

```dotenv
YOUTUBE_API_KEY=your_youtube_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
TARGET_CHANNEL_IDS=["UC_channel_a","UC_channel_b"]
STORAGE_BACKEND=json
LOCAL_STORE_PATH=../data/collector-store.json
PUBLIC_DATA_DIR=../public/data
AWS_REGION=ap-northeast-1
VIDEOS_TABLE_NAME=vsxp-videos
SINGER_VIDEOS_TABLE_NAME=vsxp-singer-videos
ORIGINAL_SONGS_PATH=../public/original-songs.json
SINGER_CHANNELS_PATH=../public/singer-channels.json
```

`ORIGINAL_SONGS_PATH` は確認済み原曲の対応表です。未登録の初期値は `[]` です。存在しないファイルや矛盾した対応表はエラーになります。

ローカルJSONでは、再処理用のgrounding根拠を `LOCAL_STORE_PATH` に保存し、Git管理しません。
画面用に必要な項目だけを `PUBLIC_DATA_DIR/videos.json` と `singers.json` へ自動出力します。
フロントエンドは既定でこの公開スナップショットを読みます。

`SINGER_CHANNELS_PATH` は、チャンネルIDと基準となる歌手名の対応表です。Geminiが原曲側の
歌手をカバー歌手と誤認するのを防ぎます。コラボ相手は、動画タイトル・説明・チャンネル名に
実際に名前が含まれる場合だけ追加します。

AWSへ定期収集する場合だけ `STORAGE_BACKEND=dynamodb` に変更します。この場合は通常の
AWSプロファイル・環境変数・IAMロールを使用してください。

初回のみ、保存先の2テーブルを作成します（DynamoDBを使う場合のみ、AWSへの書き込み）。

```bash
uv run python scripts/create_tables.py
```

## チャンネル登録と収集

収集対象は2段階で扱います。最初にチャンネルを一度だけ登録します。チャンネルURL、動画URL、
ハンドル、チャンネルIDを指定でき、動画URLからは所属チャンネルを解決します。歌手名を省略すると
YouTubeのチャンネル名を使います。

```bash
uv run vsxp-register-channel \
  --channel-url 'https://www.youtube.com/watch?v=VIDEO_ID' \
  --singer-name '歌手名'
```

登録内容は `SINGER_CHANNELS_PATH`（既定は `public/singer-channels.json`）に保存され、
Geminiが原曲側の歌手をカバー歌手と誤認するのを防ぐ対応表としても使われます。

次に、引数なしの `vsxp-collect` で登録済みの全チャンネルを巡回します。保存済み動画は候補数に
含めず、未確認動画だけを取得・分類・登録します。

```bash
uv run vsxp-collect --max-videos 100 --max-song-videos 30 --metadata-only
```

特定のチャンネルだけを臨時に収集する場合は、従来どおり `--channel-url` を指定できます。

```bash
uv run vsxp-collect --channel-url 'https://www.youtube.com/@handle' --max-videos 100 --max-song-videos 30
```

配信やShortsが多く、新着一覧だけでは通常尺の歌動画を拾いにくいチャンネルでは、
チャンネル内検索の候補を追加します。検索結果も通常と同じ分類・grounding検証を通ります。

```bash
uv run vsxp-collect \
  --channel-id UC_channel_a \
  --max-videos 30 \
  --song-search-results 50 \
  --max-song-videos 20 \
  --metadata-only
```

指定した動画だけを少量収集する場合は `--video-url` を使います。動画URLを
`--channel-url` に渡すと、その動画が属するチャンネル全体が対象になるため注意してください。

```bash
uv run vsxp-collect \
  --video-url 'https://www.youtube.com/watch?v=VIDEO_ID' \
  --metadata-only
```

`--metadata-only` は類似度計算に必要な原曲・歌手・grounding根拠だけを収集し、
コメント分析、AI特徴量、サビ解析を省略します。

- `--channel-url` は繰り返し指定できます。チャンネルURL・動画URL・ハンドル・チャンネルIDに対応します。動画URLを指定した場合も収集対象はそのチャンネルです。
- `--channel-id` は互換用の別名です。収集対象を省略すると登録済みの全チャンネルを使います。
- `--max-videos` は保存済み動画を除いてチャンネルから取得する未処理動画IDの上限、`--max-song-videos` は原曲特定と保存に成功した歌動画数の上限です。どちらもチャンネルごとで、0は無制限です。保存済み動画は `--max-videos` の件数に含めず、必要数の未処理動画が見つかるまで過去の投稿へページングします。チャンネルの全投稿を調べ終えた場合や、未確定の動画がある場合は上限数まで集まらないことがあります。
- `--song-search-results` は「歌ってみた」「Cover」「MV」などでチャンネル内検索する候補数です。YouTube Data APIのsearch.listはクォータ消費が大きいため、必要なチャンネルだけで使用してください。
- 通常は保存済みの動画をスキップします。`--overwrite` でYouTube情報を再取得・再解析できます。メタデータ更新で既存の原曲情報を消しません。
- 同じCLIを `uv run python -m collector` または `uv run python -m collector.run_once` でも実行できます。

YouTube情報取得、動画分類、原曲特定、コメント・動画特徴・サビの解析が動作します。歌動画の対象時間は60秒〜20分です。歌枠全体からのセットリスト抽出は未対応です。動画ごとの処理間に1秒待ちますが、1動画で複数のGeminiリクエストが発生します。

## 原曲特定とWeb grounding

原曲特定は次の2段階で行います。

1. `google_search` ツールを有効にし、動画タイトル・説明欄・歌手／チャンネル名・動画IDから検索します。改変タイトル・略称・翻訳名・歌詞引用について、公式の原曲名・原曲アーティストとの対応を調べます。
2. 検索調査結果を、別のツールなしのJSON出力呼び出しで構造化します。歌唱者と原曲アーティストを区別し、参照元との対応を保持します。

検索の実行自体はモデルが判断します。検索クエリ・引用付きWebソースがAPIから返らない場合は、推測で確定せず未確定として保存します。同名異曲・メドレー・複数候補が未解決の場合も同様です。groundingがあっても内容の正しさを保証するものではなく、少量収集後に根拠を確認してください。

根拠は動画の `grounding_json` に保存します。検索クエリ、ソースURLとタイトル、APIのgrounding metadata、検索調査文、選択した根拠、判定理由、モデル名、特定成功時の日時を含みます。API例外時は例外の種類を保存します。

[Google Search groundingの公式仕様](https://ai.google.dev/gemini-api/docs/generate-content/google-search)に沿って実装しています。検索とJSON整形を分けることで、モデルによる検索ツールとJSONモードの同時利用の差異を避けます。モデルは `GEMINI_MODEL` で変更できます。

## 原曲ID

- 確認済み対応表の動画ID・曲名＋アーティスト別名に一致すれば、対応表の原曲IDと正式名を使います。
- それ以外は検索で特定された正式名と全原曲アーティストを正規化し、`title-artist:v1:<SHA-256>` を生成します。これはメタデータ由来のIDで、外部の公式楽曲IDではありません。表記が変わると別IDになるため、後から対応表で統合してください。
- 動画本体と歌手別索引の両方に `original_song_id` を保存します。原曲が未確定の新規動画は歌手別索引に追加しません。原曲を再特定できなかった場合は既存の索引を保持します。索引書き込み途中の失敗はerrorとして再試行対象にします。
- `grounding_status` は `pending`（保存途中）、`identified`（完了）、`unresolved`（未確定）、`error`（失敗）です。

## 再試行・既存データの原曲ID付与

YouTubeの再取得をせず、保存済みの動画を処理します。

```bash
uv run vsxp-enrich --channel-id UC_channel_a --max-videos 30 --metadata-only
```

未確定・失敗・保存途中・未解析の動画と、原曲IDのない既存歌動画が対象です。未確定・失敗が残った実行は終了コード1を返します。成功分は保存されます。すべて再解析したい場合は `--overwrite` を追加します。コマンドを省略して `uv run python -m collector.enrich_batch` としても使えます。

対応表を更新した後は、該当チャンネルの再解析で新しい原曲IDを保存します。既存データの一括更新は自動では実行しません。

## APIと画面

FastAPIの `/video-pages?limit=200&cursor=...` が歌手別索引をページングし、フロントは `next_cursor` がなくなるまで取得します。`limit` は索引レコード数であり、コラボは複数レコードになります。同一動画の参加歌手はページをまたいで統合します。従来の `/videos` は互換用に残しています。

通常はバックエンドを起動せず、`public/data` のJSONを読みます。DynamoDB＋FastAPIへ切り替える場合は
フロントの環境変数に `VITE_DATA_SOURCE=api` と `VITE_API_BASE_URL` を設定してください。

バックエンドとフロントを同時に更新してください。DynamoDB Scanは更新中のデータの一貫したスナップショットではないため、収集完了後に画面を再読み込みしてください。

## Lambda

パッケージのハンドラーは `collector.handler.lambda_handler` です。依存と対応表を同梱します。

```json
{"channelUrl":"https://www.youtube.com/@handle","maxVideos":100,"songSearchResults":50,"maxSongVideos":30,"overwrite":false}
```

## テスト

`collector/` から、外部API・DBに接続しないテストを実行します。

```bash
uv run python -m unittest discover -s tests -v
uv run python -m collector.test_url_parser
uv run python -m collector.test_resolution
```

実APIでの検索品質や権限の確認には、APIキー・AWS認証・収集対象チャンネルを用意した少量の実行が別途必要です。
