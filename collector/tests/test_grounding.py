import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from google.genai import types
from collector.gemini_client import GeminiClient
from collector.original_songs import OriginalSongs
from collector.enricher import VideoEnricher
from collector.db import VideoRepository


def metadata():
    return types.GroundingMetadata(
        web_search_queries=['altered cover title official original'],
        grounding_chunks=[types.GroundingChunk(web=types.GroundingChunkWeb(uri='https://example.org/official', title='Official'))],
        grounding_supports=[types.GroundingSupport(grounding_chunk_indices=[0])],
    )


class GroundingTest(unittest.TestCase):
    def client(self, meta, result=None):
        client = GeminiClient.__new__(GeminiClient)
        client.model = 'test-model'
        client.original_songs = OriginalSongs()
        client.client = Mock()
        research = SimpleNamespace(text='Official song from Artist https://example.org/official',
                                   candidates=[SimpleNamespace(grounding_metadata=meta)])
        structured = SimpleNamespace(text=json.dumps(result or {
            'status': 'identified', 'song_title': 'Official song', 'singers': ['Cover singer'],
            'original_artists': ['Artist'], 'source_indices': [0],
            'original_url': 'https://example.org/official',
        }))
        client.client.chats.create.return_value.send_message.side_effect = [research, structured]
        return client

    def test_search_then_structure_and_persist_evidence(self):
        client = self.client(metadata())
        result = client.extract_song_info('Changed title', 'Description', 'Cover singer', 'cover-id')
        self.assertEqual(result['song_title'], 'Official song')
        self.assertTrue(result['original_song_id'].startswith('title-artist:v1:'))
        self.assertEqual(result['grounding']['sources'][0]['url'], 'https://example.org/official')
        search_call, structured_call = client.client.chats.create.call_args_list
        self.assertIsNotNone(search_call.kwargs['config'].tools[0].google_search)
        self.assertEqual(
            structured_call.kwargs['config'].response_mime_type, 'application/json',
        )
        self.assertIsNone(structured_call.kwargs['config'].tools)
        sent_prompt = client.client.chats.create.return_value.send_message.call_args_list[0].args[0]
        self.assertIn('cover-id', sent_prompt)
        client.client.models.generate_content.assert_not_called()

    def test_grounded_official_channel_is_discovered(self):
        channel_url = 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa'
        client = GeminiClient.__new__(GeminiClient)
        client.model = 'test-model'
        client.client = Mock()
        research = SimpleNamespace(
            text=f'Official channel: {channel_url}',
            candidates=[SimpleNamespace(grounding_metadata=metadata())],
        )
        structured = SimpleNamespace(text=json.dumps({
            'status': 'identified', 'channel_url': channel_url,
            'source_indices': [0], 'reason': 'Official profile links to it',
        }))
        client.client.chats.create.return_value.send_message.side_effect = [research, structured]

        result = client.discover_official_channel('Guest Singer')

        self.assertEqual(result['status'], 'identified')
        self.assertEqual(result['channel_url'], channel_url)
        search_call, structured_call = client.client.chats.create.call_args_list
        self.assertIsNotNone(search_call.kwargs['config'].tools[0].google_search)
        self.assertIsNone(structured_call.kwargs['config'].tools)
        client.client.models.generate_content.assert_not_called()

    def test_no_search_evidence_never_becomes_a_song(self):
        for meta in [None, types.GroundingMetadata(web_search_queries=['query'])]:
            client = self.client(meta)
            result = client.extract_song_info('title', '')
            self.assertEqual(result['song_title'], '')
            self.assertEqual(result['grounding']['status'], 'unresolved')
            self.assertEqual(
                client.client.chats.create.return_value.send_message.call_count, 1,
            )
            self.assertEqual(client.client.chats.create.call_count, 1)
            client.client.models.generate_content.assert_not_called()

    def test_ambiguous_and_fabricated_source_indices_are_rejected(self):
        for status, indices in [('ambiguous', [0]), ('identified', [99])]:
            client = self.client(metadata(), {'status': status, 'song_title': 'Title',
                'singers': ['Singer'], 'original_artists': ['Artist'], 'source_indices': indices})
            self.assertEqual(client.extract_song_info('title', '')['song_title'], '')

    def test_unsubstantiated_singers_are_rejected(self):
        client = self.client(metadata(), {
            'status': 'identified', 'song_title': 'ピッカーン！',
            'singers': ['松田里奈', '森田ひかる'],
            'original_artists': ['Giga', 'TeddyLoid'], 'source_indices': [0],
        })
        result = client.extract_song_info(
            'ピッカーン！ - Giga & TeddyLoid (Cover) / KMNZ TINA',
            '',
            'KMNZ_TINAM',
            'u1LWGCiGCHE',
            'UCnwnKd78qy2Txjs1WlfwkxA',
        )
        self.assertEqual(result['singers'], [])

    def test_title_listed_collaborator_is_preserved(self):
        client = self.client(metadata(), {
            'status': 'identified', 'song_title': 'Song',
            'singers': ['KMNZ TINA', 'CULUA'],
            'original_artists': ['Artist'], 'source_indices': [0],
        })
        result = client.extract_song_info(
            'Song (Cover) / KMNZ TINA × CULUA', '', 'KMNZ_TINAM', 'video', 'channel',
        )
        self.assertEqual(result['singers'], ['KMNZ TINA', 'CULUA'])

    def test_shared_channel_only_accepts_named_member(self):
        client = self.client(metadata(), {
            'status': 'identified', 'song_title': 'Song',
            'singers': ['KMNZ TINA', 'KMNZ NERO'],
            'original_artists': ['Artist'], 'source_indices': [0],
        })
        result = client.extract_song_info(
            'Song (Cover) / KMNZ NERO', '', 'KMNZ', 'video', 'channel',
        )
        self.assertEqual(result['singers'], ['KMNZ NERO'])

    def test_malformed_json_and_api_failure_are_retryable(self):
        client = self.client(metadata())
        client.client.chats.create.return_value.send_message.side_effect = RuntimeError('failure')
        self.assertEqual(client.extract_song_info('title', '')['grounding']['status'], 'error')
        client = self.client(metadata())
        client.client.chats.create.return_value.send_message.side_effect = [
            SimpleNamespace(text='research', candidates=[SimpleNamespace(grounding_metadata=metadata())]),
            SimpleNamespace(text='not JSON'),
        ]
        self.assertEqual(client.extract_song_info('title', '')['grounding']['status'], 'error')

    def test_classification_uses_chat_without_models_afc(self):
        client = GeminiClient.__new__(GeminiClient)
        client.model = 'test-model'
        client.client = Mock()
        client.client.chats.create.return_value.send_message.return_value = SimpleNamespace(
            text=json.dumps({'type': 'UNKNOWN', 'confidence': 0.98, 'reason': 'Product review'}),
        )

        result = client.classify_video_type('Microphone review', 'Product introduction')

        self.assertEqual(result['type'], 'UNKNOWN')
        config = client.client.chats.create.call_args.kwargs['config']
        self.assertEqual(config.response_mime_type, 'application/json')
        self.assertIsNone(config.tools)
        client.client.models.generate_content.assert_not_called()

    def test_stable_ids_and_curated_aliases(self):
        resolver = OriginalSongs()
        self.assertEqual(resolver.resolve(' Ｔｉｔｌｅ ', ['B', 'A'])[0], resolver.resolve('title', ['a', 'b'])[0])
        self.assertNotEqual(resolver.resolve('Title', ['A'])[0], resolver.resolve('Title', ['B'])[0])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalog.json'
            path.write_text(json.dumps([{'id': 'curated', 'title': 'Title', 'artist': 'Artist',
                                        'aliases': [{'title': 'Alias', 'artist': 'Artist'}]}]))
            self.assertEqual(OriginalSongs(path).resolve('Alias', ['Artist'])[0], 'curated')

    def test_unresolved_does_not_replace_existing_index(self):
        repo, index, gemini = Mock(), Mock(), Mock()
        repo.get_video.return_value = SimpleNamespace(duration=200, video_title='Title', description='')
        gemini.classify_video_type.return_value = {'type': 'SONG', 'confidence': 1, 'reason': ''}
        gemini.extract_song_info.return_value = {'song_title': '', 'grounding': {'status': 'unresolved'}}
        self.assertEqual(VideoEnricher(gemini, repo, index).enrich_video('channel', 'video'), '')
        repo.update_song_info.assert_not_called()
        index.delete_singer_video_index.assert_not_called()
        self.assertEqual(repo.update_grounding.call_args.args[2]['status'], 'unresolved')

    def test_grounded_id_reaches_main_and_index_records(self):
        repo, index, gemini = Mock(), Mock(), Mock()
        repo.get_video.return_value = SimpleNamespace(duration=200, video_title='Title', description='', published_at='2026-01-01')
        gemini.classify_video_type.return_value = {'type': 'SONG', 'confidence': 1, 'reason': ''}
        gemini.extract_song_info.return_value = {'song_title': 'Official', 'singers': ['Singer'], 'is_cover': True,
            'original_artists': ['Artist'], 'original_song_id': 'id-1', 'grounding': {'status': 'identified'}}
        self.assertEqual(VideoEnricher(gemini, repo, index).enrich_video('channel', 'video'), 'SONG')
        self.assertEqual(repo.update_song_info.call_args.kwargs['original_song_id'], 'id-1')
        self.assertEqual(index.upsert_singer_video_index.call_args.kwargs['original_song_id'], 'id-1')
        self.assertEqual(repo.update_grounding.call_args.args[2]['status'], 'identified')

    def test_channel_info_is_not_treated_as_video(self):
        db = Mock()
        db.query.return_value = {'Items': [{'video_id': {'S': 'CHANNEL_INFO'}}]}
        self.assertEqual(VideoRepository(db, 'videos').list_videos_by_channel('channel'), [])


if __name__ == '__main__':
    unittest.main()
