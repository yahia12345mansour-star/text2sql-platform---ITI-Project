// Mirrors backend/app/routes/hybrid_chat_routes.py
import { apiFetch } from "./client.js";

export function askHybrid({ connectionId, knowledgeBaseId, question }) {
  return apiFetch("/api/hybrid-chat", {
    method: "POST",
    body: { connection_id: connectionId, knowledge_base_id: knowledgeBaseId, question },
  });
}
