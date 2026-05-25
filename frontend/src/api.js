import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (token expired / invalid), clear storage and force re-login.
// Wrong action passwords also return 401 — distinguish by detail message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("auth_token")) {
      const detail = error.response?.data?.detail ?? "";
      const isWrongPassword = typeof detail === "string" && detail.includes("Incorrect password");
      if (!isWrongPassword) {
        localStorage.removeItem("auth_token");
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
