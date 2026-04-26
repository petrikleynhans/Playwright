import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  listFilms: () => client.get("/films").then(r => r.data),
  createFilm: (data) => client.post("/films", data).then(r => r.data),
  getFilm: (id) => client.get(`/films/${id}`).then(r => r.data),
  updateFilm: (id, data) => client.patch(`/films/${id}`, data).then(r => r.data),
  deleteFilm: (id) => client.delete(`/films/${id}`).then(r => r.data),

  listShots: (filmId) => client.get(`/films/${filmId}/shots`).then(r => r.data),
  createShot: (filmId, data) => client.post(`/films/${filmId}/shots`, data).then(r => r.data),
  getShot: (id) => client.get(`/shots/${id}`).then(r => r.data),
  updateShot: (id, data) => client.patch(`/shots/${id}`, data).then(r => r.data),
  deleteShot: (id) => client.delete(`/shots/${id}`).then(r => r.data),

  listIterations: (shotId) => client.get(`/shots/${shotId}/iterations`).then(r => r.data),
  createIteration: (shotId, data) => client.post(`/shots/${shotId}/iterations`, data).then(r => r.data),
  deleteIteration: (id) => client.delete(`/iterations/${id}`).then(r => r.data),
};
