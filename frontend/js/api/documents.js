// Mirrors backend/app/routes/file_routes.py + document_chat_routes.py
import { apiFetch } from "./client.js";

export function listKnowledgeBases() {
  return apiFetch("/api/knowledge-bases");
}

export function createKnowledgeBase({ name, description }) {
  return apiFetch("/api/knowledge-bases", {
    method: "POST",
    body: { name, description: description || null },
  });
}

export function uploadFile(knowledgeBaseId, file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch(`/api/knowledge-bases/${knowledgeBaseId}/files`, {
    method: "POST",
    body: form,
    isForm: true,
  });
}

export function askDocuments({ knowledgeBaseId, question }) {
  return apiFetch("/api/document-chat", {
    method: "POST",
    body: { knowledge_base_id: knowledgeBaseId, question },
  });
}
