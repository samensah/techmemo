"""Backend smoke tests; run from repo root: python -m unittest discover -s tests."""
import unittest
from fastapi.testclient import TestClient
from api.main import app


class APIHealthTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_exposes_selected_huggingface_models(self):
        result = self.client.get('/api/health')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['generation_model'], 'gpt2')
        self.assertEqual(result.json()['embedding_model'], 'sentence-transformers/all-MiniLM-L6-v2')

    def test_index_is_entrypoint(self):
        result = self.client.get('/')
        self.assertEqual(result.status_code, 200)
        self.assertIn('<title>TechMemo', result.text)

    def test_text_extraction(self):
        result = self.client.post('/api/extract', files={'file': ('example.txt', b'Example contract clause', 'text/plain')})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['text'], 'Example contract clause')

    def test_generation_needs_evidence(self):
        result = self.client.post('/api/generate', json={
            'issue': 'Which accounting treatment applies to this contract?',
            'standard': 'IFRS 15', 'evidence': []
        })
        self.assertEqual(result.status_code, 422)


if __name__ == '__main__':
    unittest.main()
