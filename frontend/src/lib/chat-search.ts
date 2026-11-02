/** Focus a saved message after its conversation has rendered. */
export function focusSearchMessage(element: HTMLElement) {
  document.querySelectorAll(".chat-search-match").forEach((previous) => previous.classList.remove("chat-search-match"));
  element.classList.add("chat-search-match");
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: "center" });
}
