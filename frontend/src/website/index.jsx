import React from "react";
import { Outlet } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import "./website.css";
import Footer from "./components/Footer.jsx";

function WebsiteIndex() {
  return (
    <div >
      <div style={{height: "55px"}}>
      <Navbar />
      </div>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default WebsiteIndex;
