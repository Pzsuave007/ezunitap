import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sf_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const onAuthPage = ["/login", "/register"].includes(window.location.pathname);
      if (!onAuthPage) {
        localStorage.removeItem("sf_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
