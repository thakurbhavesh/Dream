import React, { useState } from "react";
import { PiCheckCircle } from "react-icons/pi";
import AntSwitch from "../../components/AntSwitch";

const HomePriceComponent = () => {
  const [billingType, setBillingType] = useState("Monthly"); // Billing Type
  const [selectedPlan, setSelectedPlan] = useState("Premium"); // Selected Plan

  const plans = [
    {
        plan_id: 1,
      name: "Premium",
      description: "For small teams",
      priceMonthly: "₹199",
      priceYearly: "₹1990",
      perks: [
        "Audio/Video Calling",
        "Chat Area Filters",
        "Orange Member (Guest User)",
        "Unlimited Search history",
        "Unlimited Group Chats",
        "Audio Messaging and many more..",
      ],
      mostPopular: true,
    },
    {
        plan_id: 2,
      name: "Enterprise",
      description: "SMEs and Start-Ups",
      priceMonthly: "₹399",
      priceYearly: "₹3990",
      perks: [
        "Group Calling",
        "Remote Screen Sharing",
        "Message Edit",
        "Jointly Code",
        "LDAP/Active Directory/ SSO",
        "Chat History Deletion Controls and many more..",
      ],
    },
    {
        plan_id: 3,
      name: "Superior",
      description: "Corporate and Large Enterprises",
      priceMonthly: "₹599",
      priceYearly: "₹5990",
      perks: [
        "Branding LOGO",
        "Remote Desktop Control",
        "Live Dox",
        "Off Grid",
        "Contact Authorization",
        "High Availability and many more..",
      ],
    },
    {
        plan_id: 4,
      name: "Trial",
      description: "Enterprise Edition for 1 week",
      priceMonthly: "₹0",
      priceYearly: "₹0",
      perks: ["All Enterprise Features"],
    },
  ];

  const selectedPlanDetails = plans.find((plan) => plan.name === selectedPlan);

  return (
    <section className="home-price-container px-2">
      <div className="container px-md-5 wrapper ">
        <div className="text-center">
          <h2>
            Affordable Plan for Every Organization
          </h2>
        </div>

        {/* Billing Toggle */}
        <div className="d-flex justify-content-center align-items-center gap-2 my-4">
          <span>Billed Monthly</span>
          <AntSwitch
            checked={billingType === "Yearly"}
            onChange={() =>
              setBillingType(billingType === "Monthly" ? "Yearly" : "Monthly")
            }
          />
          <span>Yearly</span>
        </div>

        {/* Pricing Cards */}
        <div className="card  ">
          <div className="row mx-0">
            {/* Features Section */}
            <div className="col-md-6  p-5 bg-color">
              <ul className="list-unstyled d-inline ">
                {selectedPlanDetails.perks.map((perk, index) => (
                  <li key={index} className="mb-3 d-flex align-items-center">
                    <PiCheckCircle size={32} color="#4CAF50" className="me-2" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plans Section */}
            <div className="col-md-6 p-5">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`d-flex justify-content-between align-items-center my-3 p-2 rounded position-relative ${
                    selectedPlan === plan.name ? "bg-light-blue check-mark" : ""
                  }`}
                  style={{
                    background:
                      selectedPlan === plan.name ? "#bfe9ffb0" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedPlan(plan.name)}
                >
                  <div>
                    <h6 className="mb-0">{plan.name}</h6>
                    <small className="text-muted">{plan.description}</small>
                  </div>
                  <div className="d-flex flex-column justify-content-between align-items-center">
                    <span className="fw-bold">
                      {billingType === "Monthly"
                        ? plan.priceMonthly
                        : plan.priceYearly}
                    </span>
                    <span
                      className="text-muted "
                      style={{ fontSize: "0.8rem" }}
                    >
                      Per User
                    </span>
                  </div>
                  {plan.mostPopular && (
                    <span
                      className="badge bg-success text-white"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Most popular
                    </span>
                  )}
                </div>
              ))}
              <div className="text-end mt-2">
                <button className="main-btn">BUY NOW</button>
              </div>
            </div>
          </div>

          {/* Buy Now Button */}
        </div>
      </div>
    </section>
  );
};

export default HomePriceComponent;
