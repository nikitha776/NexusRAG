"""Oversized documents/history must fit provider limits without losing the question."""
import unittest
from unittest.mock import patch
from app.services import rag
from app.services.errors import AnswerServiceError, EmptyAnswerError
from app.services.token_budget import count_tokens, trim_tokens


class PromptBudgetTests(unittest.IsolatedAsyncioTestCase):
    async def test_large_sources_and_history_fit_and_citations_match_sent_text(self):
        chunks = [{"document_id": str(i), "content": ("Evidence 数据 about the project. " * 2000), "score": .9, "chunk_index": i} for i in range(5)]
        history = [{"role": role, "content": "Long previous answer " * 5000} for role in ["user", "assistant"] * 3]
        query = "What is the project about?"
        with patch("app.services.token_budget.get_encoding", return_value=None), patch.object(rag, "search_chunks", return_value=chunks), patch.object(rag, "generate_response", return_value="Explain the project") as rewrite:
            result = await rag.prepare_rag(query, "w", [str(i) for i in range(5)], history, {str(i): "filename" * 100 for i in range(5)})
            self.assertLessEqual(count_tokens(result["prompt"]) + count_tokens(result["system_prompt"]), rag.settings.LLM_INPUT_TOKEN_BUDGET)
            self.assertIn(query, result["prompt"])
            self.assertLessEqual(count_tokens(rewrite.call_args.args[0]) + count_tokens(rewrite.call_args.args[1]), rag.settings.LLM_INPUT_TOKEN_BUDGET)
        self.assertEqual(rewrite.call_args.kwargs["max_tokens"], 512)
        self.assertEqual(len(result["citations"]), 5)
        for citation in result["citations"]:
            self.assertIn(citation["chunk_content"], result["prompt"])
            self.assertTrue(chunks[int(citation["document_id"])]["content"].startswith(citation["chunk_content"]))


    async def test_empty_followup_rewrite_falls_back_and_still_uses_selected_document_evidence(self):
        chunks = [{"document_id": "resume", "content": "Resume skills: Python, JavaScript, SQL.", "score": .9, "chunk_index": 0}]
        history = [{"role": "user", "content": "What languages are in my resume?"}, {"role": "assistant", "content": "Python and JavaScript."}]
        with patch.object(rag, "generate_response", side_effect=EmptyAnswerError("empty answer")), patch.object(rag, "search_chunks", return_value=chunks) as search:
            result = await rag.prepare_rag("gaps with current tech", "w", ["resume"], history, {"resume": "resume.pdf"})
        self.assertTrue(search.call_args.kwargs["query"].startswith("gaps with current tech"))
        self.assertIn("resume", search.call_args.kwargs["query"])
        self.assertEqual(search.call_args.kwargs["selected_doc_ids"], ["resume"])
        self.assertIn(chunks[0]["content"], result["prompt"])
        self.assertEqual(result["citations"][0]["document_id"], "resume")
        self.assertIn("not evidenced", result["system_prompt"])
        self.assertIn("Do not claim to have checked live", result["system_prompt"])

    async def test_rewrite_provider_errors_are_not_silently_retried_as_another_request(self):
        with patch.object(rag, "generate_response", side_effect=AnswerServiceError("usage limit reached")), patch.object(rag, "search_chunks") as search:
            with self.assertRaisesRegex(AnswerServiceError, "usage limit"):
                await rag.prepare_rag("follow up", "w", ["resume"], [{"role": "user", "content": "resume"}], {})
        search.assert_not_called()

    async def test_huge_question_gets_bounded_clarification_prompt_before_retrieval(self):
        with patch("app.services.token_budget.get_encoding", return_value=None), patch.object(rag, "search_chunks") as search:
            result = await rag.prepare_rag("大" * 5000, "w", ["d"], [], {})
            self.assertLessEqual(count_tokens(result["prompt"]) + count_tokens(result["system_prompt"]), rag.settings.LLM_INPUT_TOKEN_BUDGET)
            self.assertIn("question is too long", result["prompt"])
            self.assertEqual(result["citations"], [])
        search.assert_not_called()

    def test_offline_trimming_does_not_split_unicode_or_overshoot(self):
        with patch("app.services.token_budget.get_encoding", return_value=None):
            text = trim_tokens("数据abc", 7)
            self.assertEqual(text, "数据a")
            self.assertLessEqual(count_tokens(text), 7)
