// Renders assistant chat text as real markdown (headings, lists, code
// blocks, inline code) with syntax highlighting, sanitized before it
// ever touches innerHTML. Falls back to plain escaped text if the CDN
// libraries failed to load (e.g. offline dev environment).
export function renderMarkdown(text) {
  if (typeof window.marked === "undefined") {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  window.marked.setOptions({ breaks: true, gfm: true });
  const rawHtml = window.marked.parse(text || "");
  const clean = window.DOMPurify ? window.DOMPurify.sanitize(rawHtml) : rawHtml;
  return clean;
}

/** Call after inserting rendered markdown into the DOM to apply code highlighting. */
export function highlightCodeBlocks(containerEl) {
  if (typeof window.hljs === "undefined") return;
  containerEl.querySelectorAll("pre code").forEach((block) => {
    window.hljs.highlightElement(block);
  });
}
