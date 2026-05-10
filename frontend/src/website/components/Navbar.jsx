import { Divider } from "@mui/material";
import { PiArrowCircleUp, PiChat, PiTextOutdent, PiXCircle } from "react-icons/pi";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import helpdeskGif from "../assets/Images/helpdesk.gif";
import teamworkGif from "../assets/Images/teamwork.gif";

import { API_BASE_URL } from "../../config/apiBaseUrl";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const Navbar = () => {
  const { brandName, logoUrl } = useSiteBranding();
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // Popup visibility state

  const navigate = useNavigate();

  const handleStartChat = () => {
    navigate("/help", { state: { activeTab: "support" } });
    setShowPopup(false);
  };

  const [appUrl, setAppUrl] = useState("/"); // Default to "/" if fetch fails

  const fetchActiveDesktopAppUrl = async () => {
    if (!API_BASE_URL) {
      setAppUrl("/");
      return;
    }

    const url = `${API_BASE_URL.replace(/\/$/, "")}/api/desktop-apps/active`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unexpected response type");
      }
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setAppUrl(data.data[0].app_url); // Updated to use app_url from response
      } else {
        console.warn(
          "No active desktop apps found or fetch failed:",
          data.message
        );
        setAppUrl("/");
      }
    } catch (error) {
      console.warn("Fetch error:", error);
      setAppUrl("/");
    }
  };

  useEffect(() => {
    fetchActiveDesktopAppUrl();
  }, []); // Runs only once on mount

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show or hide navbar
      if (currentScrollY < lastScrollY - 20) {
        setShowNavbar(true);
      } else if (currentScrollY > lastScrollY + 20) {
        setShowNavbar(false);
      }

      // Show or hide "Scroll to Top" button
      setShowScrollTop(currentScrollY > 100);

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  // useEffect(() => {
  //   // Show popup after 20 seconds
  //   const popupTimer = setTimeout(() => {
  //     setShowPopup(true);
  //   }, 20000);

  //   return () => clearTimeout(popupTimer); // Cleanup timer
  // }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth", // Smooth scrolling effect
    });
  };

  return (
    <>
      {/* Navbar */}
      <nav
        className={`navbar navbar-expand-lg border-bottom ${showNavbar ? "navbar-visible" : "navbar-hidden"
          }`}
        aria-label="Offcanvas navbar large"
      >
        <div className="container-fluid">
          <Link className="navbar-brand text-uppercase" to="/">
            <img
              src={logoUrl || "teamchatXLogo.png"}
              alt={brandName}
              style={{ width: "100px" }}
            />
          </Link>
          <button
            className="navbar-toggler border-none p-1 shadow-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#offcanvasNavbar2"
            aria-controls="offcanvasNavbar2"
          >
            <PiTextOutdent size={32} />
          </button>
          <div
            className="offcanvas offcanvas-end"
            style={{ height: "100vh" }}
            tabIndex="-1"
            id="offcanvasNavbar2"
            aria-labelledby="offcanvasNavbar2Label"
          >
            <div className="offcanvas-header">
              <h5 className="offcanvas-title" id="offcanvasNavbar2Label"></h5>
              <button
                type="button"
                className="btn-close btn-close-black"
                data-bs-dismiss="offcanvas"
                aria-label="Close"
              ></button>
            </div>
            <div className="offcanvas-body overflow-visible justify-content-end">
              <ul className="navbar-nav justify-content-end grow pe-3 gap-2">
                <li className="nav-item">
                  <Link
                    className="nav-link active"
                    aria-current="page"
                    to="/"
                  >
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/pricing">
                    Pricing
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/features">
                    Features
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/compare">
                    Compare
                  </Link>
                </li>
                <li className="nav-item dropdown">
                  <div
                    className="nav-link dropdown-toggle"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    Get Our App
                  </div>
                  <ul className="dropdown-menu">
                    <li>
                      <Link className="dropdown-item" to={appUrl} >
                        Windows App
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/help">
                        Help Center
                      </Link>
                    </li>
                  </ul>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/app">
                    Messenger
                  </Link>
                </li>
              </ul>
              <ul className="navbar-nav ml-auto gap-2">
                <Link className="nav-link" to="/auth/login">
                  Login
                </Link>
                <Link to="/auth/register" className="main-btn">
                  Free Trial
                </Link>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          className="scroll-to-top-btn"
          onClick={scrollToTop}
          style={{
            position: "fixed",
            bottom: "30px",
            right: "20px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "60px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            cursor: "pointer",
            zIndex: 1000,
            transition: "0.3s ease-in-out",
            animation: "float 1s 2 ease-in-out",
          }}
        >
          <PiArrowCircleUp size={45} />
        </button>
      )}

      {/* Popup */}
      {showPopup && (
        <div
          className="modal fade show text-white"
          style={{
            display: "block",

            zIndex: 1050,
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ maxWidth: "600px" }}
          >
            <div className="modal-content p-4 position-relative">
              {/* Sliding Images Container */}
              <div
                className="sliding-images-container d-none d-md-block"
                style={{
                  position: "absolute",
                  top: "120px",
                  right: "40px",
                  width: "150px", // Width of the image container
                  height: "150px", // Height of the image container
                  overflow: "hidden",
                }}
              >
                <div
                  className="sliding-images"
                  style={{
                    position: "relative",
                    width: "100%", // Adjusted for horizontal animation
                    height: "100%",
                    display: "flex", // Make images inline horizontally
                    animation: "slideImagesX 8s infinite",
                  }}
                >
                  <img
                    src={helpdeskGif}
                    alt="Helpdesk"
                    style={{
                      width: "150px",
                      height: "150px",
                      flexShrink: "0", // Prevent shrinking during animation
                    }}
                  />
                  <img
                    src={teamworkGif}
                    alt="Teamwork"
                    style={{
                      width: "150px",
                      height: "150px",
                      flexShrink: "0",
                    }}
                  />
                </div>
              </div>

              {/* Content Section */}
              <div className="ms-auto" onClick={() => setShowPopup(false)}>
                <PiXCircle
                  size={32}
                  color="#fff"
                  cursor="pointer"
                  weight="fill"
                />
              </div>
              <div className="d-flex flex-column gap-4">
                <div>
                  <h2 className="modal-title">
                    Collaborate better with {brandName}!
                  </h2>
                  <p>Start Now</p>
                </div>
                <div>
                  <div className="d-flex gap-2 mt-3">
                    <Link to="/auth/login" className="main-btn">
                      Try Now
                    </Link>
                    <Link to="/demo" className="fill-btn">
                      Request Demo
                    </Link>
                  </div>
                  <div className="">
                    <div className="d-flex gap-2 mt-5">
                      <button
                        onClick={handleStartChat}
                        className="btn btn-outline-light align-items-center d-flex gap-1 btn-sm rounded-pill"
                      >
                        <PiChat /> Chat
                      </button>
                      <Divider
                        orientation="vertical"
                        variant="middle"
                        flexItem
                        sx={{ bgcolor: "#000" }}
                      />
                      <a className="">support@teamchatx.com</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CSS for Sliding Animation */}
          <style>
            {`
    @keyframes slideImagesX {
      0% {
        transform: translateX(0);
      }
      45% {
        transform: translateX(0);
      }
      50% {
        transform: translateX(-100%);
      }
      95% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(0);
      }
    }

    .sliding-images img {
      transition: transform 1s ease-in-out;
    }
  `}
          </style>
        </div>
      )}
    </>
  );
};

export default Navbar;
