import importlib
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from models import VideoPage


class VideoPageApiTest(unittest.TestCase):
    def test_endpoint_validation_and_cursor_error(self):
        repo = Mock()
        with patch('db.create_video_repository', return_value=repo):
            main = importlib.import_module('main')
            app = main.create_app(main.Settings())
        client = TestClient(app)
        repo.list_video_page.return_value = VideoPage(videos=[], next_cursor='next')
        response = client.get('/video-pages?limit=10')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'videos': [], 'next_cursor': 'next'})
        repo.list_video_page.assert_called_with(limit=10, cursor=None)
        self.assertEqual(client.get('/video-pages?limit=201').status_code, 422)
        repo.list_video_page.side_effect = ValueError('Invalid video cursor')
        self.assertEqual(client.get('/video-pages?cursor=invalid').status_code, 400)


if __name__ == '__main__':
    unittest.main()
