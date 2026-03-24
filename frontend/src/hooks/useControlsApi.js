import { useCallback, useMemo, useState } from "react";
import { API_BASE_URL } from "../config/apiBaseUrl";
import { fetchWithAuth } from "../utils/authApi";

/**
 * Hook for loading and saving a single organization control by feature_key.
 *
 * Usage:
 *   const { loadSection, saveSection, isLoading, isSaving, feedback, resetFeedback } = useControlsApi("recall");
 *
 *   // Load on mount:
 *   useEffect(() => { loadSection().then(data => data && setLocalState(fromApi(data))); }, [loadSection]);
 *
 *   // Save on button click:
 *   saveSection(toApi(localState));
 */
const useControlsApi = (featureKey) => {
  const [loadStatus, setLoadStatus] = useState("idle"); // idle | loading | success | error
  const [saveStatus, setSaveStatus] = useState("idle");
  const [feedback, setFeedback] = useState(null); // { type, message }

  // Load: GET /organization-controls/:feature_key
  const loadSection = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/organization-controls/${featureKey}`
      );
      if (response.ok) {
        setLoadStatus("success");
        return payload?.data ?? null;
      }
      if (response.status === 404) {
        setLoadStatus("success");
        return null; // no saved data yet → caller uses defaults
      }
      throw new Error(payload?.message ?? "Failed to load settings");
    } catch (error) {
      setLoadStatus("error");
      setFeedback({ type: "error", message: error.message ?? "Failed to load settings" });
      return null;
    }
  }, [featureKey]);

  // Save: PUT /organization-controls/:feature_key  (upsert)
  const saveSection = useCallback(
    async (data) => {
      setSaveStatus("loading");
      try {
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/organization-controls/${featureKey}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );
        if (response.ok) {
          setSaveStatus("success");
          setFeedback({ type: "success", message: "Settings saved." });
          return payload?.data ?? null;
        }
        throw new Error(payload?.message ?? "Failed to save settings");
      } catch (error) {
        setSaveStatus("error");
        setFeedback({ type: "error", message: error.message ?? "Unable to save settings." });
        return null;
      }
    },
    [featureKey]
  );

  const resetFeedback = useCallback(() => setFeedback(null), []);

  const isLoading = useMemo(() => loadStatus === "loading", [loadStatus]);
  const isSaving = useMemo(() => saveStatus === "loading", [saveStatus]);

  return {
    loadSection,
    saveSection,
    isLoading,
    isSaving,
    feedback,
    resetFeedback,
  };
};

export default useControlsApi;
