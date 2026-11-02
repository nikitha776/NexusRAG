"""Provider errors are tested offline, without using configured credentials."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
import httpx
from groq import AuthenticationError, NotFoundError, RateLimitError, APIConnectionError, APIStatusError
from app.services.errors import AnswerServiceError

spec = importlib.util.spec_from_file_location("llm_under_test", Path(__file__).parents[1] / "app/services/llm.py")
llm = importlib.util.module_from_spec(spec)
with patch("app.config.get_settings", return_value=SimpleNamespace(LLM_MODEL="test-model", GROQ_API_KEY="test-key")):
    spec.loader.exec_module(llm)


class AnswerServiceTests(unittest.TestCase):
    def test_uses_separate_system_and_user_roles(self):
        client = MagicMock()
        client.invoke.return_value = SimpleNamespace(content="Answer")
        with patch.object(llm, "get_llm", return_value=client):
            self.assertEqual(llm.generate_response("Question", "Follow the context"), "Answer")
        messages = client.invoke.call_args.args[0]
        self.assertEqual([message.type for message in messages], ["system", "human"])
        self.assertEqual([message.content for message in messages], ["Follow the context", "Question"])

    def test_provider_errors_are_actionable_without_leaking_details(self):
        request = httpx.Request("POST", "https://example.test/chat")
        for error_type, status, expected in [
            (NotFoundError, 404, "LLM_MODEL"),
            (AuthenticationError, 401, "GROQ_API_KEY"),
            (RateLimitError, 429, "usage limit"),
            (APIStatusError, 413, "token limit"),
        ]:
            client = MagicMock()
            client.invoke.side_effect = error_type("private provider details", response=httpx.Response(status, request=request), body={})
            with patch.object(llm, "get_llm", return_value=client):
                with self.assertRaises(AnswerServiceError) as caught:
                    llm.generate_response("Question")
            self.assertIn(expected, str(caught.exception))
            self.assertNotIn("private provider details", str(caught.exception))

    def test_connection_failures_and_empty_replies_are_retryable(self):
        client = MagicMock()
        client.invoke.side_effect = APIConnectionError(request=httpx.Request("POST", "https://example.test/chat"))
        with patch.object(llm, "get_llm", return_value=client):
            with self.assertRaisesRegex(AnswerServiceError, "connect"):
                llm.generate_response("Question")
        client.invoke.side_effect = None
        client.invoke.return_value = SimpleNamespace(content=" ")
        with patch.object(llm, "get_llm", return_value=client):
            with self.assertRaisesRegex(AnswerServiceError, "empty answer"):
                llm.generate_response("Question")

    def test_extracts_text_blocks_without_including_reasoning(self):
        client = MagicMock()
        client.invoke.return_value = SimpleNamespace(content=[
            {"type": "reasoning", "text": "Internal reasoning"},
            {"type": "text", "text": "Grounded "},
            {"type": "text", "text": "answer"},
        ])
        with patch.object(llm, "get_llm", return_value=client):
            self.assertEqual(llm.generate_response("Question"), "Grounded answer")

    def test_client_has_bounded_timeout_and_retries(self):
        with patch.object(llm, "_llm", None), patch.object(llm, "ChatGroq") as constructor:
            llm.get_llm()
            self.assertEqual(constructor.call_args.kwargs["timeout"], 60.0)
            self.assertEqual(constructor.call_args.kwargs["max_retries"], 1)

    def test_gpt_oss_uses_low_reasoning_without_unsupported_reasoning_format(self):
        for model in ("openai/gpt-oss-20b", "openai/gpt-oss-120b", "other-model"):
            settings = SimpleNamespace(LLM_MODEL=model, GROQ_API_KEY="test-key")
            with patch.object(llm, "settings", settings), patch.object(llm, "_llm", None), patch.object(llm, "ChatGroq") as constructor:
                llm.get_llm()
            if model.startswith("openai/gpt-oss"):
                self.assertEqual(constructor.call_args.kwargs["reasoning_effort"], "low")
            else:
                self.assertNotIn("reasoning_effort", constructor.call_args.kwargs)
            self.assertNotIn("reasoning_format", constructor.call_args.kwargs)


class StreamingAnswerTests(unittest.IsolatedAsyncioTestCase):
    async def test_streaming_reports_specific_provider_errors_and_closes_stream(self):
        request = httpx.Request("POST", "https://example.test/chat")
        for error_type, status, expected in [(RateLimitError, 429, "usage limit"), (APIStatusError, 413, "token limit"), (AuthenticationError, 401, "GROQ_API_KEY")]:
            closed = []
            async def failing_stream():
                try:
                    raise error_type("private details", response=httpx.Response(status, request=request), body={})
                    yield  # Make this an async generator, like the real provider.
                finally:
                    closed.append(True)
            client = MagicMock()
            client.astream.return_value = failing_stream()
            with patch.object(llm, "get_llm", return_value=client):
                with self.assertRaisesRegex(AnswerServiceError, expected) as error:
                    async for _ in llm.stream_response("Question"):
                        self.fail("A failed request must not emit answer text")
            self.assertNotIn("private details", str(error.exception))
            self.assertEqual(closed, [True])

    async def test_oversized_inputs_are_rejected_before_calling_provider(self):
        with patch.object(llm, "count_tokens", return_value=3000), patch.object(llm, "get_llm") as provider:
            with self.assertRaisesRegex(AnswerServiceError, "too long"):
                llm.generate_response("large question", "large context")
            with self.assertRaisesRegex(AnswerServiceError, "too long"):
                async for _ in llm.stream_response("large question", "large context"):
                    self.fail("Unexpected answer")
        provider.assert_not_called()


if __name__ == "__main__":
    unittest.main()
