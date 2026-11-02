"""Lost-index recovery must preserve document and workspace isolation."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

spec = importlib.util.spec_from_file_location('rag_recovery_under_test', Path(__file__).parents[1] / 'app/services/rag.py')
rag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rag)


def builder(data):
    query = MagicMock()
    for method in ('select', 'eq', 'order', 'range'):
        getattr(query, method).return_value = query
    query.execute.return_value = SimpleNamespace(data=data)
    return query


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.client = QdrantClient(':memory:')
        self.client_patch = patch.object(rag, 'get_qdrant_client', return_value=self.client)
        self.client_patch.start()
        self.embeddings = patch.object(rag, 'generate_embeddings', side_effect=lambda texts: [[1.0] + [0.0] * (rag.settings.EMBEDDING_DIM - 1) for _ in texts])
        self.embeddings.start()
        rag.ensure_collection()

    def tearDown(self):
        self.embeddings.stop()
        self.client_patch.stop()
        self.client.close()

    def test_missing_vectors_are_restored_and_second_call_is_idempotent(self):
        docs = builder([{'id': 'selected', 'chunk_count': 2}])
        chunks = builder([{'chunk_index': 0, 'content': 'First passage'}, {'chunk_index': 1, 'content': 'Second passage'}])
        db = MagicMock()
        db.table.side_effect = lambda name: docs if name == 'documents' else chunks
        with patch('app.db.supabase_client.get_supabase_admin', return_value=db):
            rag.restore_missing_document_vectors('workspace', ['selected'])
            rag.restore_missing_document_vectors('workspace', ['selected'])
        self.assertEqual(self.client.count(rag.settings.QDRANT_COLLECTION, exact=True).count, 2)
        self.assertEqual(chunks.execute.call_count, 1)
        self.assertIn(unittest.mock.call('workspace_id', 'workspace'), docs.eq.call_args_list)
        self.assertIn(unittest.mock.call('status', 'ready'), docs.eq.call_args_list)
        chunks.eq.assert_called_with('document_id', 'selected')
        # A repeated upsert also replaces the same points instead of duplicating them.
        rag.upsert_chunks('selected', 'workspace', ['First passage', 'Second passage'])
        self.assertEqual(self.client.count(rag.settings.QDRANT_COLLECTION, exact=True).count, 2)

    def test_foreign_or_not_ready_document_is_never_restored(self):
        db = MagicMock()
        db.table.return_value = builder([])
        with patch('app.db.supabase_client.get_supabase_admin', return_value=db):
            rag.restore_missing_document_vectors('workspace', ['foreign'])
        self.assertEqual(self.client.count(rag.settings.QDRANT_COLLECTION, exact=True).count, 0)
        db.table.assert_called_once_with('documents')

    def test_old_embedding_profile_is_rebuilt_and_never_used_in_new_search(self):
        vector = [1.0] + [0.0] * (rag.settings.EMBEDDING_DIM - 1)
        self.client.upsert(rag.settings.QDRANT_COLLECTION, [PointStruct(id='00000000-0000-0000-0000-000000000001', vector=vector,
            payload={'workspace_id': 'workspace', 'document_id': 'selected', 'content': 'Legacy vector', 'chunk_index': 0})])
        db = MagicMock()
        db.table.side_effect = [builder([{'id': 'selected', 'chunk_count': 1}]), builder([{'chunk_index': 0, 'content': 'Current evidence'}])]
        with patch('app.db.supabase_client.get_supabase_admin', return_value=db), patch.object(rag, 'generate_embedding', return_value=vector):
            results = rag.search_chunks('question', 'workspace', ['selected'])
        self.assertEqual([r['content'] for r in results], ['Current evidence'])
        self.assertEqual(self.client.count(rag.settings.QDRANT_COLLECTION, exact=True).count, 2)

    def test_incomplete_saved_chunks_raise_reprocessing_error(self):
        db = MagicMock()
        db.table.side_effect = [builder([{'id': 'selected', 'chunk_count': 2}]), builder([{'chunk_index': 0, 'content': 'Only one passage'}])]
        with patch('app.db.supabase_client.get_supabase_admin', return_value=db):
            with self.assertRaisesRegex(RuntimeError, 'Retry processing'):
                rag.restore_missing_document_vectors('workspace', ['selected'])
        self.assertEqual(self.client.count(rag.settings.QDRANT_COLLECTION, exact=True).count, 0)

    def test_search_retries_after_restoring_vectors_and_keeps_filter(self):
        db = MagicMock()
        db.table.side_effect = [builder([{'id': 'selected', 'chunk_count': 1}]), builder([{'chunk_index': 0, 'content': 'Selected passage'}])]
        vector = [1.0] + [0.0] * (rag.settings.EMBEDDING_DIM - 1)
        rag.upsert_chunks('other', 'workspace', ['Unselected passage'])
        rag.upsert_chunks('selected', 'foreign-workspace', ['Foreign passage'])
        with patch('app.db.supabase_client.get_supabase_admin', return_value=db), patch.object(rag, 'generate_embedding', return_value=vector):
            results = rag.search_chunks('question', 'workspace', ['selected'])
        self.assertEqual([result['content'] for result in results], ['Selected passage'])


class CloudClientTests(unittest.TestCase):
    def test_cloud_credentials_and_timeout_reach_client(self):
        config = SimpleNamespace(QDRANT_URL='https://cluster.example.com:6333',
                                 QDRANT_API_KEY='test-cloud-key', QDRANT_TIMEOUT=15)
        with patch.object(rag, 'settings', config), patch.object(rag, '_qdrant_client', None), patch.object(rag, 'QdrantClient') as client:
            self.assertIs(rag.get_qdrant_client(), client.return_value)
            self.assertIs(rag.get_qdrant_client(), client.return_value)
        client.assert_called_once_with(url=config.QDRANT_URL, api_key='test-cloud-key', timeout=15)

    def test_cloud_filter_indexes_are_prepared_once(self):
        client = MagicMock()
        client.get_collections.return_value.collections = [SimpleNamespace(name=rag.settings.QDRANT_COLLECTION)]
        with patch.object(rag, 'get_qdrant_client', return_value=client), patch.object(rag, '_prepared_client', None):
            rag.ensure_collection()
            rag.ensure_collection()
        self.assertEqual([call.args[1] for call in client.create_payload_index.call_args_list],
                         ['workspace_id', 'document_id', 'embedding_profile'])
        client.create_collection.assert_not_called()


if __name__ == '__main__':
    unittest.main()
