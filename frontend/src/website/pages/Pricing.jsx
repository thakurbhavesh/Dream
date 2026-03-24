import React from "react";
import EmailInputComponent from "../components/EmailInputComponent";
import PriceTableComponent from "../components/PriceTableComponent";

const Pricing = () => {
  return (
    <section className="pricing-page">
        <div className="wrapper bg-image text-center">
        <h1 className="text-capitalize text-white">pricing that suits your needs</h1>
        <EmailInputComponent textColor="white"/>
        </div>
      <div className="container  text-center mb-5">
        <PriceTableComponent/>
      </div>
      
    </section>
  );
};

export default Pricing;
