import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db.dynamo import DynamoVideoRepository


class OriginalSongIdentityTest(unittest.TestCase):
    def setUp(self):
        self.repository = DynamoVideoRepository(None, 'videos', 'singer-videos')
        self.item = {
            'video_id': {'S': 'cover-1'},
            'video_title': {'S': 'Cover title'},
            'song_title': {'S': 'Display title'},
            'original_song_id': {'S': 'original-1'},
            'original_song_title': {'S': 'Original title'},
            'original_artist_name': {'S': 'Original artist'},
        }

    def test_both_read_paths_preserve_original_identity(self):
        for parser in [self.repository._item_to_video,
                       self.repository._singer_video_item_to_video]:
            with self.subTest(parser=parser.__name__):
                video = parser(self.item)
                data = video.model_dump()
                self.assertEqual(data['original_song_id'], 'original-1')
                self.assertEqual(data['original_song_title'], 'Original title')
                self.assertEqual(data['original_artist_name'], 'Original artist')

    def test_legacy_records_remain_readable(self):
        item = {key: value for key, value in self.item.items()
                if not key.startswith('original_')}
        for parser in [self.repository._item_to_video,
                       self.repository._singer_video_item_to_video]:
            with self.subTest(parser=parser.__name__):
                self.assertIsNone(parser(item).original_song_id)


if __name__ == '__main__':
    unittest.main()
