import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Redirect /support to /help (Support tab is inside Help Center)
export default function Support() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/help", { replace: true, state: { tab: "support" } }); }, [navigate]);
  return null;
}
