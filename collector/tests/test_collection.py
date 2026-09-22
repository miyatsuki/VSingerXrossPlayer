import unittest
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from collector.db import VideoRecord, VideoRepository
from collector.channel_registry import load_channel_registry, register_channel
from collector.enrich_batch import enrich_channel
from collector.enricher import VideoEnricher
from collector.local_db import LocalJsonStore, LocalSingerVideoIndexRepository, LocalVideoRepository
from collector.run_once import collect_channel, collect_videos
from collector.youtube_client import YouTubeClient


class CollectionTest(unittest.TestCase):
    def test_channel_registration_resolves_and_persists_canonical_id(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'channels.json'
            youtube = Mock()
            youtube.resolve_channel_id.return_value = 'UC-canonical'
            youtube.fetch_channel_info.return_value = {'channel_name': 'Singer'}

            result = register_channel(
                'https://www.youtube.com/watch?v=video', youtube, path,
            )

            self.assertEqual(result, ('UC-canonical', {
                'channel_name': 'Singer',
            }, True))
            self.assertEqual(load_channel_registry(path), {'UC-canonical': {
                'channel_name': 'Singer',
            }})

    def test_channel_registration_refreshes_channel_name(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'channels.json'
            path.write_text(json.dumps({
                'UC-one': {'channel_name': 'Old'},
            }), encoding='utf-8')
            youtube = Mock()
            youtube.resolve_channel_id.return_value = 'UC-one'
            youtube.fetch_channel_info.return_value = {'channel_name': 'Ignored'}

            result = register_channel('UC-one', youtube, path)

            self.assertEqual(result, ('UC-one', {
                'channel_name': 'Ignored',
            }, False))
            self.assertEqual(load_channel_registry(path), {'UC-one': {
                'channel_name': 'Ignored',
            }})
            youtube.fetch_channel_info.assert_called_once_with('UC-one')

    def test_local_store_exports_public_data_without_grounding(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = LocalJsonStore(root / 'private.json', root / 'public')
            videos = LocalVideoRepository(store)
            index = LocalSingerVideoIndexRepository(store)
            video = SimpleNamespace(
                channel_id='channel', video_id='video', title='Cover', description='description',
                duration=200, published_at='2026-01-01', thumbnail_url='thumb', view_count=1,
                like_count=2, comment_count=3, channel_title='Singer',
            )
            videos.upsert_channel_info('channel', 'Singer', 'avatar', 100)
            videos.upsert_video(video)
            videos.update_grounding('channel', 'video', {
                'status': 'identified', 'research_text': 'private evidence',
            })
            videos.update_song_info(
                'channel', 'video', 'Song', ['Singer'], True,
                original_song_id='song-id', original_artist_name='Artist',
            )
            index.upsert_singer_video_index(
                video_id='video', video_title='Cover', channel_id='channel',
                song_title='Song', original_song_id='song-id',
                original_song_title='Song', original_artist_name='Artist',
                published_at='2026-01-01', thumbnail_url='thumb', singers=['Singer'],
            )
            public = json.loads((root / 'public' / 'videos.json').read_text())
            self.assertEqual(public[0]['original_song_id'], 'song-id')
            self.assertNotIn('grounding', public[0])
            singers = json.loads((root / 'public' / 'singers.json').read_text())
            self.assertEqual(singers[0]['avatar_url'], 'avatar')
            self.assertIn('private evidence', (root / 'private.json').read_text())

    def test_storage_check_uses_describe_table(self):
        db = Mock()
        VideoRepository(db, 'videos').verify_table_access()
        db.describe_table.assert_called_once_with(TableName='videos')

    def test_youtube_refresh_preserves_enrichment_attributes(self):
        db = Mock()
        video = SimpleNamespace(channel_id='channel', video_id='video', title='title', description='',
            duration=200, published_at='2026-01-01', view_count=1, like_count=2, comment_count=3,
            channel_title='Singer', thumbnail_url='https://example.org/image')
        VideoRepository(db, 'videos').upsert_video(video)
        db.put_item.assert_not_called()
        names = db.update_item.call_args.kwargs['ExpressionAttributeNames'].values()
        self.assertNotIn('original_song_id', names)
        self.assertNotIn('grounding_json', names)
        self.assertIn('video_title', names)

    def test_retry_selects_pending_and_legacy_but_skips_completed_and_games(self):
        repo = Mock()
        repo.list_videos_by_channel.return_value = [
            VideoRecord('pending', 'Pending', original_song_id='id', grounding_status='pending'),
            VideoRecord('legacy', 'Legacy', song_title='Song', video_type='SONG'),
            VideoRecord('done', 'Done', song_title='Song', original_song_id='id', grounding_status='identified'),
            VideoRecord('game', 'Game', video_type='GAME'),
        ]
        with patch('collector.enrich_batch.VideoEnricher') as factory:
            factory.return_value.enrich_video.return_value = 'SONG'
            enrich_channel('channel', Mock(), repo, Mock(), Mock(), sleep_seconds=0)
            self.assertEqual([call.args[1] for call in factory.return_value.enrich_video.call_args_list], ['pending', 'legacy'])

    def test_classification_failure_is_retryable(self):
        repo, gemini = Mock(), Mock()
        repo.get_video.return_value = SimpleNamespace(duration=200, video_title='Title', description='')
        gemini.classify_video_type.return_value = {'error': 'NetworkError'}
        self.assertEqual(VideoEnricher(gemini, repo).enrich_video('channel', 'video'), '')
        repo.update_video_type.assert_not_called()
        self.assertEqual(repo.update_grounding.call_args.args[2]['status'], 'error')

    def test_unresolved_does_not_count_as_successful_collection(self):
        youtube, repo, enricher = Mock(), Mock(), Mock()
        youtube.fetch_channel_info.return_value = {'channel_name': 'Singer', 'channel_icon_url': '', 'subscriber_count': 1}
        youtube.fetch_video_ids_from_channel.return_value = {'video'}
        youtube.fetch_videos.return_value = [SimpleNamespace(video_id='video', title='Title', duration=200)]
        repo.list_existing_video_ids.return_value = set()
        enricher.enrich_video.return_value = ''
        with patch('collector.run_once.time.sleep'):
            with self.assertRaisesRegex(RuntimeError, 'unresolved'):
                collect_channel('channel', youtube, repo, enricher)

    def test_song_search_candidates_are_merged_with_uploads(self):
        youtube, repo, enricher = Mock(), Mock(), Mock()
        youtube.fetch_channel_info.return_value = {
            'channel_name': 'Singer', 'channel_icon_url': '', 'subscriber_count': 1,
        }
        youtube.fetch_video_ids_from_channel.return_value = {'recent'}
        youtube.search_song_candidate_ids.return_value = {'recent', 'older-song'}
        youtube.fetch_videos.return_value = []
        repo.list_existing_video_ids.return_value = set()
        collect_channel(
            'channel', youtube, repo, enricher,
            song_search_results=50,
        )
        youtube.search_song_candidate_ids.assert_called_once_with(
            'channel', max_results=50,
        )
        self.assertEqual(set(youtube.fetch_videos.call_args.args[0]), {'recent', 'older-song'})

    def test_max_videos_excludes_already_stored_uploads(self):
        client = YouTubeClient('key')
        client.fetch_uploads_playlist_id = Mock(return_value='uploads')
        client.fetch_video_ids_from_playlist = Mock(side_effect=[
            {
                'items': [
                    {'contentDetails': {'videoId': 'stored-one'}},
                    {'contentDetails': {'videoId': 'stored-two'}},
                    {'contentDetails': {'videoId': 'new-one'}},
                ],
                'nextPageToken': 'next',
            },
            {
                'items': [
                    {'contentDetails': {'videoId': 'new-two'}},
                    {'contentDetails': {'videoId': 'new-three'}},
                ],
            },
        ])

        result = client.fetch_video_ids_from_channel(
            'channel',
            max_videos=3,
            exclude_video_ids={'stored-one', 'stored-two'},
        )

        self.assertEqual(result, {'new-one', 'new-two', 'new-three'})
        self.assertEqual(client.fetch_video_ids_from_playlist.call_count, 2)

    def test_song_candidate_search_paginates_and_extracts_video_ids(self):
        client = YouTubeClient('key')
        client._get = Mock(side_effect=[
            {
                'items': [{'id': {'videoId': 'one'}}, {'id': {'videoId': 'two'}}],
                'nextPageToken': 'next',
            },
            {'items': [{'id': {'videoId': 'three'}}]},
        ])
        self.assertEqual(
            client.search_song_candidate_ids('channel', 3),
            {'one', 'two', 'three'},
        )
        self.assertEqual(client._get.call_count, 2)
        self.assertEqual(client._get.call_args_list[1].args[1]['pageToken'], 'next')

    def test_explicit_video_collection_never_expands_to_channel(self):
        youtube, repo, enricher = Mock(), Mock(), Mock()
        youtube.fetch_videos.return_value = [SimpleNamespace(
            video_id='HvAeHfEh2Xg', channel_id='channel', title='Title', duration=200,
        )]
        youtube.fetch_channel_info.return_value = {
            'channel_name': 'Singer', 'channel_icon_url': '', 'subscriber_count': 1,
        }
        repo.get_video.return_value = None
        enricher.enrich_video.return_value = 'SONG'
        with patch('collector.run_once.time.sleep'):
            collect_videos(
                ['https://www.youtube.com/watch?v=HvAeHfEh2Xg'],
                youtube,
                repo,
                enricher,
            )
        youtube.fetch_video_ids_from_channel.assert_not_called()
        youtube.fetch_videos.assert_called_once_with(['HvAeHfEh2Xg'])
        enricher.enrich_video.assert_called_once_with('channel', 'HvAeHfEh2Xg', 'Singer')

    def test_explicit_video_collection_rejects_channel_urls(self):
        with self.assertRaisesRegex(ValueError, 'Not a YouTube video URL'):
            collect_videos(
                ['https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx'],
                Mock(),
                Mock(),
                Mock(),
            )

    def test_metadata_only_skips_optional_analysis(self):
        repo, index, gemini, youtube = Mock(), Mock(), Mock(), Mock()
        repo.get_video.return_value = SimpleNamespace(
            duration=200, video_title='Title', description='', published_at='2026-01-01',
        )
        gemini.classify_video_type.return_value = {'type': 'SONG', 'confidence': 1, 'reason': ''}
        gemini.extract_song_info.return_value = {
            'song_title': 'Official', 'singers': ['Singer'], 'is_cover': True,
            'original_artists': ['Artist'], 'original_song_id': 'id-1',
            'grounding': {'status': 'identified'},
        }
        result = VideoEnricher(
            gemini, repo, index, youtube, analyze_features=False,
        ).enrich_video('channel', 'video')
        self.assertEqual(result, 'SONG')
        youtube.fetch_video_comments.assert_not_called()
        gemini.analyze_video_characteristics.assert_not_called()


if __name__ == '__main__':
    unittest.main()
