// Resize an image file client-side and return as base64 data URL.
// Caps longest side to maxDim, encodes as JPEG with given quality.
export async function fileToCompressedDataURL(file, maxDim = 1600, quality = 0.85) {
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export const STATUS_COLORS = {
  "FINAL": "#4ade80",
  "IN PROGRESS": "#facc15",
  "NOT STARTED": "#555555",
  "CUT": "#6b7280",
};

export const DECISION_COLORS = {
  "FINAL": "#4ade80",
  "KEEP": "#facc15",
  "DISCARD": "#f87171",
};

export const MODELS = ["Kling 3.0", "Veo 3.1 Fast", "WAN 2.6", "Sora 2", "Seedream 5.0 Lite", "Flux 1.1"];
export const STILL_MODELS = ["Seedream 5.0 Lite", "Flux 1.1"];
export const VIDEO_MODELS = ["Kling 3.0", "Veo 3.1 Fast", "WAN 2.6", "Sora 2"];
export const ACTS = ["ACT 1", "ACT 2", "ACT 3"];
export const SHOT_TYPES = ["ECU", "CU", "MS", "WS", "Insert"];
export const SHOT_STATUSES = ["NOT STARTED", "IN PROGRESS", "FINAL", "CUT"];

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
