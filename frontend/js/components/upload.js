// Real upload progress via XMLHttpRequest (fetch can't report upload
// progress). Posts to the same /api/knowledge-bases/{id}/files endpoint
// the plain fetch-based client uses — this only changes *how* the
// request is sent, not what it does.
import { API_BASE } from "../api/client.js";
import { state } from "../state.js";

export function uploadFileWithProgress(knowledgeBaseId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/knowledge-bases/${knowledgeBaseId}/files`);
    xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.detail || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(form);
  });
}
