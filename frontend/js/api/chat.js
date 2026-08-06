// Mirrors backend/app/routes/chat_routes.py, general_chat_routes.py,
// and streaming_chat_routes.py — the three "talk to the LLM" modes that
// don't involve documents.
import { apiFetch, API_BASE } from "./client.js";
import { state } from "../state.js";

export function askDatabase({ connectionId, question, conversationId }) {
  return apiFetch("/api/chat", {
    method: "POST",
    body: { connection_id: connectionId, question, conversation_id: conversationId || null },
  });
}

export function generalChat({ message }) {
  return apiFetch("/api/general-chat", { method: "POST", body: { message } });
}

/**
 * Streaming chat uses Server-Sent Events, so it can't go through the
 * shared JSON apiFetch() helper — the response body is an open stream
 * of `data: <token>\n\n` chunks, not one JSON object. onToken is called
 * once per streamed piece of text as it arrives.
 */
export async function streamChat({ message }, onToken, onDone, signal) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ message }),
    signal,
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line ("\n\n")
    const frames = buffer.split("\n\n");
    buffer = frames.pop(); // last piece may be incomplete, keep it for next read

    for (const frame of frames) {
      const line = frame.replace(/^data: /, "");
      if (line === "[DONE]") {
        onDone();
        return;
      }
      onToken(line);
    }
  }
}
