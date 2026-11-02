from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from groq import APIConnectionError, APIStatusError, AuthenticationError, NotFoundError, RateLimitError
from app.config import get_settings
from app.services.errors import AnswerServiceError, EmptyAnswerError
from app.services.token_budget import count_tokens

settings = get_settings()
_llm = None


def get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        # GPT-OSS spends its completion budget on reasoning as well as text.
        # Keep short query rewrites from exhausting that budget before answering.
        reasoning = {"reasoning_effort": "low"} if settings.LLM_MODEL in {
            "openai/gpt-oss-20b", "openai/gpt-oss-120b",
        } else {}
        _llm = ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.1,
            max_tokens=2048,
            timeout=60.0,
            max_retries=1,
            **reasoning,
        )
    return _llm


def provider_error(exc: Exception) -> AnswerServiceError:
    if isinstance(exc, AuthenticationError):
        return AnswerServiceError("The AI service credentials were rejected. Ask the server administrator to check GROQ_API_KEY.")
    if isinstance(exc, NotFoundError):
        return AnswerServiceError("The configured AI model is unavailable. Ask the server administrator to update LLM_MODEL.")
    if isinstance(exc, RateLimitError):
        return AnswerServiceError("The AI service usage limit has been reached. Please wait a moment before retrying.")
    if isinstance(exc, APIConnectionError):
        return AnswerServiceError("Could not connect to the AI service. Please check the server connection and retry.")
    if isinstance(exc, APIStatusError) and exc.status_code == 413:
        return AnswerServiceError("This request exceeds the AI provider's token limit. Try a shorter question or fewer selected documents.")
    return AnswerServiceError("The AI service could not complete this request. Please retry later.")


def check_input_budget(prompt: str, system_prompt: str):
    limit = getattr(settings, "LLM_INPUT_TOKEN_BUDGET", 5000)
    if count_tokens(prompt) + count_tokens(system_prompt) > limit:
        raise AnswerServiceError("This request is too long for the AI service. Shorten your question and try again.")


def generate_response(prompt: str, system_prompt: str = "", max_tokens: int | None = None) -> str:
    check_input_budget(prompt, system_prompt)
    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))
    try:
        model = get_llm()
        response = (model.bind(max_tokens=max_tokens) if max_tokens else model).invoke(messages)
    except (APIConnectionError, APIStatusError) as exc:
        raise provider_error(exc) from exc
    content = response.content
    if isinstance(content, list):
        content = "".join(
            block if isinstance(block, str) else block.get("text", "")
            for block in content
            if isinstance(block, str) or (isinstance(block, dict) and block.get("type") == "text")
        )
    if not content or not content.strip():
        raise EmptyAnswerError("The AI service returned an empty answer. Please retry.")
    return content


async def stream_response(prompt: str, system_prompt: str = ""):
    check_input_budget(prompt, system_prompt)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
    received = False
    stream = get_llm().astream(messages)
    try:
        async for chunk in stream:
            content = chunk.content
            if isinstance(content, list):
                content = "".join(b if isinstance(b, str) else b.get("text", "") for b in content
                                  if isinstance(b, str) or isinstance(b, dict) and b.get("type") == "text")
            if content:
                received = received or bool(content.strip())
                yield content
        if not received:
            raise EmptyAnswerError("The AI service returned an empty answer. Please retry.")
    except AnswerServiceError:
        raise
    except (APIConnectionError, APIStatusError) as exc:
        raise provider_error(exc) from exc
    except Exception as exc:
        raise AnswerServiceError("The answer service is temporarily unavailable. Please retry.") from exc
    finally:
        await stream.aclose()
