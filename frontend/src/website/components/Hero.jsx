
import React from "react";
import EmailInputComponent from "./EmailInputComponent.jsx";
import chatWindowImg from "../assets/Images/chat-window.png";
import avatar1Img from "../assets/Images/avatar1.png";
import avatar2Img from "../assets/Images/avatar2.png";
import avatar3Img from "../assets/Images/avatar3.png";
import avatar4Img from "../assets/Images/avatar4.png";
import messageIconImg from "../assets/Images/message-icon.png";
import messageIcon2Img from "../assets/Images/message-icon2.png";
import messageIcon3Img from "../assets/Images/message-icon3.png";
import messageIcon4Img from "../assets/Images/message-icon4.png";

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="container wrapper">
        <div className="content">
          <h1 className="h1-animation mb-5">
            <p>Chat .</p>
            <p>Meet .</p>
            <p>Share .</p>
            <p className="superscript ">Create .</p>
          </h1>
          <EmailInputComponent textColor="white" />
          <div className="chat-window-img mt-5">
            <img src={chatWindowImg} className="img-fluid" alt="Chat window" />
            <div className="popup scattered">
              <div className="popup-avatar">
                <img src={avatar1Img} alt="User 1" />
                <span className="message-icon">
                  <img src={messageIcon2Img} alt="Message Icon" />
                </span>
              </div>
              <div className="popup-avatar">
                <img src={avatar2Img} alt="User 2" />
                <span className="message-icon">
                  <img src={messageIconImg} alt="Message Icon" />
                </span>
              </div>
              <div className="popup-avatar">
                <img src={avatar3Img} alt="User 3" />
                <span className="message-icon">
                  <img src={messageIcon3Img} alt="Message Icon" />
                </span>
              </div>
              <div className="popup-avatar">
                <img src={avatar4Img} alt="User 4" />
                <span className="message-icon">
                  <img src={messageIcon4Img} alt="Message Icon" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
