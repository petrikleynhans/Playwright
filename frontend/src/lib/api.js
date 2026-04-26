import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  // Films
  listFilms: () => client.get("/films").then(r => r.data),
  createFilm: (data) => client.post("/films", data).then(r => r.data),
  getFilm: (id) => client.get(`/films/${id}`).then(r => r.data),
  updateFilm: (id, data) => client.patch(`/films/${id}`, data).then(r => r.data),
  deleteFilm: (id) => client.delete(`/films/${id}`).then(r => r.data),

  // Shots
  listShots: (filmId) => client.get(`/films/${filmId}/shots`).then(r => r.data),
  createShot: (filmId, data) => client.post(`/films/${filmId}/shots`, data).then(r => r.data),
  getShot: (id) => client.get(`/shots/${id}`).then(r => r.data),
  updateShot: (id, data) => client.patch(`/shots/${id}`, data).then(r => r.data),
  deleteShot: (id) => client.delete(`/shots/${id}`).then(r => r.data),

  // Iterations
  listIterations: (shotId) => client.get(`/shots/${shotId}/iterations`).then(r => r.data),
  createIteration: (shotId, data) => client.post(`/shots/${shotId}/iterations`, data).then(r => r.data),
  deleteIteration: (id) => client.delete(`/iterations/${id}`).then(r => r.data),

  // Import
  importShots: (filmId, text) => client.post(`/films/${filmId}/import`, { text }).then(r => r.data),

  // Lessons
  lessons: (filmId) => client.get(`/films/${filmId}/lessons`).then(r => r.data),

  // Characters
  listCharacters: (filmId) => client.get(`/films/${filmId}/characters`).then(r => r.data),
  createCharacter: (filmId, data) => client.post(`/films/${filmId}/characters`, data).then(r => r.data),
  getCharacter: (id) => client.get(`/characters/${id}`).then(r => r.data),
  updateCharacter: (id, data) => client.patch(`/characters/${id}`, data).then(r => r.data),
  deleteCharacter: (id) => client.delete(`/characters/${id}`).then(r => r.data),
  shotsForCharacter: (id) => client.get(`/characters/${id}/shots`).then(r => r.data),

  // Locations
  listLocations: (filmId) => client.get(`/films/${filmId}/locations`).then(r => r.data),
  createLocation: (filmId, data) => client.post(`/films/${filmId}/locations`, data).then(r => r.data),
  getLocation: (id) => client.get(`/locations/${id}`).then(r => r.data),
  updateLocation: (id, data) => client.patch(`/locations/${id}`, data).then(r => r.data),
  deleteLocation: (id) => client.delete(`/locations/${id}`).then(r => r.data),
  shotsForLocation: (id) => client.get(`/locations/${id}/shots`).then(r => r.data),
};

// 19 protocol fields with display labels and hints
export const PROTOCOL_FIELDS = [
  { key: "subject", label: "Subject", hint: "WHO + POSE/STATE + ACTION. No generic descriptors." },
  { key: "emotion", label: "Emotion", hint: "Concrete physical, not abstract. e.g. 'guarded stillness, hands at rest'." },
  { key: "environment_setting", label: "Environment & Setting", hint: "Place + time of day + energy/texture + one sensory detail." },
  { key: "clothing", label: "Clothing", hint: "Fabric + condition/age + no logos (unless intentional)." },
  { key: "lighting_weather", label: "Lighting & Weather", hint: "Source + direction + quality + colour temp + shadow behaviour." },
  { key: "camera_angle_framing", label: "Camera Angle & Framing", hint: "Vantage + height + distance + visibility of secondaries." },
  { key: "lens_characteristics", label: "Lens & Characteristics", hint: "Focal length + DoF + rendering style." },
  { key: "eye_details", label: "Eye Details", hint: "Texture + catchlight + age cues. Never blank." },
  { key: "skin_textures", label: "Skin Textures", hint: "Specific placement + 'no smoothing/beauty retouch' — always explicit." },
  { key: "mouth_lips", label: "Mouth & Lips", hint: "Shape + condition + expression state." },
  { key: "hair", label: "Hair", hint: "Style + texture + colour + movement state." },
  { key: "atmospheric_texture", label: "Atmospheric Texture", hint: "Particulates/fog/rain + light interaction. 'None' is valid." },
  { key: "color_palette", label: "Colour Palette", hint: "Dominant hues + saturation + contrast style." },
  { key: "processing_style", label: "Processing Style", hint: "Look + grain + curve. Default: photorealistic, no grade." },
  { key: "framing", label: "Framing", hint: "Tight/medium/wide + subject weight + headroom + negative space." },
  { key: "emotional_impact", label: "Emotional Impact", hint: "Intent in viewer. What should they feel?" },
  { key: "extras_props", label: "Extras / Props", hint: "Items + placement + visibility. 'None' is valid." },
  { key: "composition_notes", label: "Composition Notes", hint: "Leading lines, rule of thirds, foreground blockers, motion." },
  { key: "negative_prompt", label: "Negative Prompt", hint: "Always: no smiling (unless scripted), no beauty smoothing, no cinematic lighting, no hero pose, no logos, no era drift." },
];
