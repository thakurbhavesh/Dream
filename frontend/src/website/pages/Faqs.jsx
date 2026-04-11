import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Redirect /faqs to /help (FAQs tab is inside Help Center)
export default function Faqs() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/help", { replace: true, state: { tab: "faqs" } }); }, [navigate]);
  return null;
}
