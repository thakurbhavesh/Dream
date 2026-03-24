import React from "react";
import { PiChatText, PiCalendar } from "react-icons/pi";
import { Link, useNavigate } from "react-router-dom";

const ChatDemoBox = () => {
  const navigate = useNavigate();

  const handleStartChat = () => {
    navigate("/website/help", { state: { activeTab: "support" } });
  };

  return (
    <div className="container wrapper chat-demo-boxes">
      <div className="row align-items-center text-center">
        {/* Start Chat Section */}
        <div className="col-md-6 text-center">
          <h3>Still have questions?</h3>
          <p className="text-muted">Talk to someone smart, quickly.</p>
          <button
            className="fill-btn my-3 d-inline-flex gap-2"
            onClick={handleStartChat}
          >
            START CHAT <PiChatText size={20} />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="col-md-1 divider d-flex justify-content-center">
          <div
            style={{
              height: "100px",
              width: "1px",
              backgroundColor: "#ddd",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "10px",
                width: "10px",
                backgroundColor: "#ddd",
                borderRadius: "50%",
                position: "absolute",
                top: "50%",
                left: "-4px",
                transform: "translateY(-50%)",
              }}
            />
          </div>
        </div>

        {/* Get a Demo Section */}
        <div className="col-md-5">
          <h3>Get a Demo</h3>
          <p className="text-muted">
            Schedule a Free Personalized Online Demo
          </p>
          <Link to="/website/demo" className="main-btn my-3 d-inline-flex gap-2">
            SCHEDULE <PiCalendar size={20} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ChatDemoBox;
