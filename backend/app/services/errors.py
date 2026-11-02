class AnswerServiceError(RuntimeError):
    """An actionable, credential-free error safe to return to the user."""


class EmptyAnswerError(AnswerServiceError):
    """The provider completed without returning any visible answer text."""
