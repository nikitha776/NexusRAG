"""Unsupported questions and empty completions should remain normal chat turns."""
import unittest
from unittest.mock import AsyncMock, patch
from app.services import rag
from app.services.errors import AnswerServiceError, EmptyAnswerError
from app.services.token_budget import count_tokens


class AnswerRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_search_results_still_get_a_model_reply_without_citations(self):
        with patch.object(rag, 'search_chunks', return_value=[]), patch.object(rag, 'generate_response', return_value='The documents do not cover that. What would you like to know about them?') as model:
            result = await rag.query_rag('Tell me about the moon', 'w', ['d'], [], {'d': 'resume.pdf'})
        self.assertIn('do not cover', result['response'])
        self.assertEqual(result['citations'], [])
        model.assert_called_once()
        self.assertIn('Tell me about the moon', model.call_args.args[0])
        self.assertIn('No relevant document passages', model.call_args.args[0])
        self.assertIn('unrelated, nonsensical, or ambiguous', model.call_args.args[1])

    async def test_long_question_gets_model_clarification_without_search(self):
        with patch.object(rag, 'search_chunks') as search, patch.object(rag, 'generate_response', return_value='Please shorten your question.') as model:
            result = await rag.query_rag('大' * 5000, 'w', ['d'], [], {})
        self.assertEqual(result['response'], 'Please shorten your question.')
        self.assertEqual(result['citations'], [])
        search.assert_not_called()
        prompt, system = model.call_args.args
        self.assertLessEqual(count_tokens(prompt) + count_tokens(system), rag.settings.LLM_INPUT_TOKEN_BUDGET)

    async def test_question_that_leaves_no_context_room_gets_clarification_even_with_no_matches(self):
        with patch('app.services.token_budget.get_encoding', return_value=None), patch.object(rag, 'search_chunks', return_value=[]):
            prepared = await rag.prepare_rag('x' * 3900, 'w', ['d'], [], {})
            self.assertLessEqual(count_tokens(prepared['prompt']) + count_tokens(prepared['system_prompt']), rag.settings.LLM_INPUT_TOKEN_BUDGET)
            self.assertEqual(prepared['citations'], [])

    def prepared(self):
        return {'prompt': 'Question and evidence', 'system_prompt': 'Only document facts', 'citations': [{'document_id': 'd'}]}

    async def test_empty_completion_is_retried_once_and_returns_recovered_answer(self):
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'generate_response', side_effect=[EmptyAnswerError('empty'), 'A useful reply']) as model:
            result = await rag.query_rag('q', 'w', ['d'], [], {})
        self.assertEqual(result['response'], 'A useful reply')
        self.assertEqual(result['citations'], [{'document_id': 'd'}])
        self.assertEqual(model.call_count, 2)

    async def test_repeated_empty_completion_returns_honest_notice_without_citations(self):
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'generate_response', side_effect=EmptyAnswerError('empty')) as model:
            result = await rag.query_rag('q', 'w', ['d'], [], {})
        self.assertIn("couldn't produce a useful answer", result['response'])
        self.assertEqual(result['citations'], [])
        self.assertEqual(model.call_count, 2)

    async def test_empty_stream_retries_once_and_closes_the_original_stream(self):
        closed = []
        async def empty():
            try:
                yield ' '
                raise EmptyAnswerError('empty')
            finally:
                closed.append(True)
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'stream_response', return_value=empty()), patch.object(rag, 'generate_response', return_value='Recovered reply') as model:
            events = [event async for event in rag.stream_rag('q', 'w', ['d'], [], {})]
        self.assertEqual(events[-1], {'type': 'token', 'text': 'Recovered reply'})
        self.assertEqual(closed, [True])
        model.assert_called_once()

    async def test_repeated_empty_stream_emits_normal_notice_and_clears_sources(self):
        async def empty():
            raise EmptyAnswerError('empty')
            yield
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'stream_response', return_value=empty()), patch.object(rag, 'generate_response', side_effect=EmptyAnswerError('empty')):
            events = [event async for event in rag.stream_rag('q', 'w', ['d'], [], {})]
        self.assertEqual(events[-2], {'type': 'sources', 'citations': []})
        self.assertEqual(events[-1]['type'], 'token')
        self.assertIn("couldn't produce", events[-1]['text'])
        self.assertFalse(any(event['type'] == 'error' for event in events))

    async def test_midstream_provider_failure_is_not_appended_to_or_retried(self):
        async def failed():
            yield 'Partial answer'
            raise AnswerServiceError('Connection lost')
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'stream_response', return_value=failed()), patch.object(rag, 'generate_response') as model:
            with self.assertRaisesRegex(AnswerServiceError, 'Connection lost'):
                async for _ in rag.stream_rag('q', 'w', ['d'], [], {}):
                    pass
        model.assert_not_called()

    async def test_rate_limit_during_recovery_is_not_reported_as_a_completed_answer(self):
        with patch.object(rag, 'prepare_rag', AsyncMock(return_value=self.prepared())), patch.object(rag, 'generate_response', side_effect=[EmptyAnswerError('empty'), AnswerServiceError('usage limit')]) as model:
            with self.assertRaisesRegex(AnswerServiceError, 'usage limit'):
                await rag.query_rag('q', 'w', ['d'], [], {})
        self.assertEqual(model.call_count, 2)
