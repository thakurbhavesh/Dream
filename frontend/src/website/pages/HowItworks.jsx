import React from "react";
import ChatDemoBox from "../components/ChatDemoBox";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const HowItWorks = () => {
  const { brandName } = useSiteBranding();
  const steps = [
    {
      number: "1",
      title: "Admin Login",
      description: `Admin Login to ${brandName} with valid user credentials.`,
      image: "login.gif", // Replace with actual image path
    },
    {
      number: "2",
      title: "Employee Details",
      description:
        "Keys in company details along with location, employee names, designations, department, and reporting hierarchy.",
      image: "add-user.gif", // Replace with actual image path
    },
    {
      number: "3",
      title: "Start Communicating",
      description:
        "Employees to log in with work credentials and start communicating.",
      image: "chat.gif", // Replace with actual image path
    },
  ];

  return (
    <>
      <div className="wrapper bg-image text-center">
        <h2 className="text-capitalize text-white wrapper">How It Works</h2>
      </div>
      <div className="container wrapper ">
        <div className="row text-center gy-4">
          {steps.map((step, index) => (
            <div className="col-md-4 position-relative" key={index}>
              <div className="how-it-works-card">
                {/* Icon */}
                <div
                  className="rounded-circle bg-light d-flex justify-content-center align-items-center mb-5"
                  style={{
                    width: "100px",
                    height: "100px",
                    backgroundColor: "#F8F9FA",
                  }}
                >
                  <img
                    src={require(`../assets/Images/${step.image}`)} 
                    alt={step.title}
                    style={{ width: "80px", height: "80px" }}
                  />
                </div>

                {/* Number */}
                <div
                  className="position-absolute"
                  style={{
                    fontSize: "120px",
                    fontWeight: "bold",
                    top: "40px",
                    right: "40px",
                    color: "#F1F1F1",
                    zIndex: "-1",
                    marginTop: "-50px",
                  }}
                ><span className="fs-5 text-muted me-1">Step</span>
                  {step.number}
                </div>

                {/* Title */}
                <h5 className="fw-bold text-dark mb-2 text-start">
                  {step.title}
                </h5>

                {/* Description */}
                <p className="text-muted small text-start">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ChatDemoBox/>
    </>
  );
};

export default HowItWorks;
