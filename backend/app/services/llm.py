from llama_index.llms.groq import Groq
from app.config import get_settings

settings = get_settings()

_llm = None


def get_llm() -> Groq:
    global _llm
    if _llm is None:
        _llm = Groq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.1,
            max_tokens=2048,
        )
    return _llm


def generate_response(prompt: str, system_prompt: str = "") -> str:
    llm = get_llm()
    if system_prompt:
        full_prompt = f"<|system|>\n{system_prompt}\n<|user|>\n{prompt}"
    else:
        full_prompt = prompt
    response = llm.complete(full_prompt)
    return response.text
