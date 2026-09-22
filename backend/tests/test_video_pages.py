import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db.dynamo import DynamoVideoRepository


def item(video, singer):
    return {'video_id': {'S': video}, 'video_title': {'S': video}, 'singer_name': {'S': singer}}


class VideoPageTest(unittest.TestCase):
    def test_cursor_resumes_scan_and_merges_collaborators(self):
        db = Mock()
        key = {'singer_key': {'S': 'A'}, 'sort_key': {'S': '2026#video'}}
        db.scan.side_effect = [
            {'Items': [item('video', 'A'), item('video', 'B')], 'LastEvaluatedKey': key},
            {'Items': [item('other', 'C')]},
        ]
        repo = DynamoVideoRepository(db, 'videos', 'index')
        first = repo.list_video_page(2)
        self.assertEqual(first.videos[0].singers, ['A', 'B'])
        self.assertEqual(len(first.videos), 1)
        second = repo.list_video_page(2, first.next_cursor)
        self.assertIsNone(second.next_cursor)
        self.assertEqual(db.scan.call_args.kwargs['ExclusiveStartKey'], key)

    def test_invalid_cursor_does_not_hit_db(self):
        db = Mock()
        repo = DynamoVideoRepository(db, 'videos', 'index')
        for cursor in ['garbage', 'e30=', 'W10=']:
            with self.assertRaises(ValueError):
                repo.list_video_page(cursor=cursor)
        db.scan.assert_not_called()

    def test_singer_list_reads_all_pages(self):
        db = Mock()
        db.scan.side_effect = [
            {'Items': [item('one', 'A')], 'LastEvaluatedKey': {'singer_key': {'S': 'A'}}},
            {'Items': [item('two', 'B')]},
        ]
        singers = DynamoVideoRepository(db, 'videos', 'index').list_singers()
        self.assertEqual([s.name for s in singers], ['A', 'B'])


if __name__ == '__main__':
    unittest.main()
