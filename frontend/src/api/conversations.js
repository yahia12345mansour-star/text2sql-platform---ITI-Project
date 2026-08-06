// Mirrors backend/app/routes/conversation_routes.py
import { apiFetch } from "./client.js";

export function listConversations() {
  return apiFetch("/api/conversations");
}

export function createConversation({ title }) {
  return apiFetch("/api/conversations", { method: "POST", body: { title: title || null } });
}

export function getMessages(conversationId) {
  return apiFetch(`/api/conversations/${conversationId}/messages`);
}
