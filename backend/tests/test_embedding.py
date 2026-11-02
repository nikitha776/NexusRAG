"""The ONNX adapter preserves raw-text, unit-normalized 384-D embeddings."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
import numpy as np

spec = importlib.util.spec_from_file_location('embedding_under_test', Path(__file__).parents[1] / 'app/services/embedding.py')
embedding = importlib.util.module_from_spec(spec)
settings = SimpleNamespace(EMBEDDING_MODEL='BAAI/bge-small-en-v1.5', EMBEDDING_CACHE_DIR='/tmp/test-embedding-cache', EMBEDDING_THREADS=1, EMBEDDING_BATCH_SIZE=1, EMBEDDING_DIM=384, EMBEDDING_LOCAL_FILES_ONLY=True)
with patch('app.config.get_settings', return_value=settings):
    spec.loader.exec_module(embedding)


class EmbeddingContractTests(unittest.TestCase):
    def test_queries_and_documents_use_same_normalized_cpu_encoder(self):
        client = MagicMock()
        client.embed.side_effect = lambda texts, **kwargs: iter(np.ones((len(texts), 384)))
        with patch.object(embedding, '_embedding_model', None), patch.object(embedding, 'TextEmbedding', return_value=client) as constructor:
            documents = embedding.generate_embeddings(['Evidence in a document'])
            query = embedding.generate_embedding('Question about the evidence')
        self.assertEqual(len(documents[0]), 384)
        self.assertEqual(len(query), 384)
        self.assertAlmostEqual(np.linalg.norm(documents[0]), 1)
        self.assertAlmostEqual(np.linalg.norm(query), 1)
        constructor.assert_called_once()
        self.assertEqual(constructor.call_args.kwargs['providers'], ['CPUExecutionProvider'])
        self.assertEqual(constructor.call_args.kwargs['threads'], 1)
        self.assertFalse(constructor.call_args.kwargs['enable_cpu_mem_arena'])
        self.assertTrue(constructor.call_args.kwargs['local_files_only'])
        self.assertEqual(client.embed.call_args_list[1].args[0], ['Question about the evidence'])
        for call in client.embed.call_args_list:
            self.assertEqual(call.kwargs, {'batch_size': 1, 'parallel': None})
        client.query_embed.assert_not_called()

    def test_invalid_dimensions_or_zero_vectors_are_rejected(self):
        for vector in (np.zeros(384), np.ones(768), np.full(384, np.nan)):
            client = MagicMock()
            client.embed.return_value = iter([vector])
            with patch.object(embedding, 'TextEmbedding', return_value=client):
                with self.assertRaisesRegex(RuntimeError, 'invalid vectors'):
                    embedding.FastEmbedEmbeddings().embed_query('text')

    def test_empty_batch_does_not_load_model(self):
        with patch.object(embedding, 'get_embedding_model') as get_model:
            self.assertEqual(embedding.generate_embeddings([]), [])
            get_model.assert_not_called()


if __name__ == '__main__':
    unittest.main()
