import React from "react";
import { PiCheck, PiPaperPlaneRight } from "react-icons/pi";

const EmailInputComponent = ({ textColor }) => {
  return (
    <div className="sign-up-email-input-component my-4 px-2">
      <div className="d-flex justify-content-center align-items-center my-input-container">
        <input
          type="email"
          className="form-control my-input-field"
          placeholder="email address"
        />
        <span className="d-flex justify-content-center align-items-center gap-2">
          <p className="text-nowrap fst-italic fs-6 text-black-50 ms-1">
            Try free
          </p>
          <button className="my-input-button">
            <PiPaperPlaneRight size={28} />
          </button>
        </span>
      </div>
      <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap " style={{ color: textColor }}>
        <span>
          <PiCheck size={20} /> No credit card needed
        </span>
        <span>
          <PiCheck size={20} /> Free 14-day trial
        </span>
        <span>
          <PiCheck size={20} /> All features
        </span>
      </div>
    </div>
  );
};

export default EmailInputComponent;
