const cleanUrl = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim().replace(/\/$/, "")
    : "";

const DEFAULT_DEV_API_URL = "http://localhost:5000";
const DEFAULT_PROD_API_URL = "https://server.officechatkarlo.com";

export const getApiBaseUrl = () => {
  const candidates = [
    import.meta.env.REACT_APP_API_URL,
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_SERVER_URL,
    import.meta.env.VITE_BACKEND_URL,
    import.meta.env.VITE_APP_API_URL,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanUrl(candidate);
    if (cleaned) return cleaned;
  }

  return import.meta.env.PROD ? DEFAULT_PROD_API_URL : DEFAULT_DEV_API_URL;
};

export const API_BASE_URL = getApiBaseUrl();
