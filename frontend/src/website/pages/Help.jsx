import React, { useState, useEffect } from "react";
import { PiHouse, PiQuestion, PiPlayCircle, PiUserCircle } from "react-icons/pi";
import { useLocation } from "react-router-dom";
import Home from "../components/HelpCenter/Home.jsx";
import Faq from "../components/HelpCenter/Faq.jsx";
import HowTo from "../components/HelpCenter/HowTo.jsx";
import Videos from "../components/HelpCenter/Videos.jsx";
import Support from "../components/HelpCenter/Support.jsx";

const Help = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("home");

  // Map active tab to the header text
  const tabHeaders = {
    home: "Help Center",
    howTo: "How To?",
    faqs: "FAQ's",
    videos: "Videos",
    support: "Hello, how can we help you?",
  };

  // Static content for each tab
  const tabContent = {
    home: <Home setActiveTab={setActiveTab} />, // Pass setActiveTab to Home
    howTo: <HowTo />,
    faqs: <Faq />,
    videos: <Videos />,
    support: <Support />,
  };

  // Effect to handle location state for tab navigation
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  return (
    <section className="help-page">
      {/* Header Section */}
      <div className="wrapper bg-image text-center">
        <h2 className="text-capitalize text-white wrapper">
          {tabHeaders[activeTab]}
        </h2>
      </div>

      {/* Tab Navigation */}
      <div className="container mt-4">
        <nav>
          <div
            className="nav nav-tabs border-0 justify-content-center"
            id="nav-tab"
            role="tablist"
          >
            <button
              className={`nav-link ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              <PiHouse size={20} className="me-1" />
              Home
            </button>
            <button
              className={`nav-link ${activeTab === "howTo" ? "active" : ""}`}
              onClick={() => setActiveTab("howTo")}
            >
              <PiQuestion size={20} className="me-1" />
              How To
            </button>
            <button
              className={`nav-link ${activeTab === "faqs" ? "active" : ""}`}
              onClick={() => setActiveTab("faqs")}
            >
              <PiQuestion size={20} className="me-1" />
              FAQs
            </button>
            <button
              className={`nav-link ${activeTab === "videos" ? "active" : ""}`}
              onClick={() => setActiveTab("videos")}
            >
              <PiPlayCircle size={20} className="me-1" />
              Videos
            </button>
            <button
              className={`nav-link ${activeTab === "support" ? "active" : ""}`}
              onClick={() => setActiveTab("support")}
            >
              <PiUserCircle size={20} className="me-1" />
              Support
            </button>
          </div>
        </nav>

        {/* Tab Content */}
        <div className="tab-content mt-4">
          <div className="tab-pane fade show active">
            {tabContent[activeTab]}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Help;
