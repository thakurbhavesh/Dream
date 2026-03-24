import React, { useEffect, useMemo, useState } from "react";
import {
  PiFacebookLogo,
  PiTwitterLogo,
  PiInstagramLogo,
  PiYoutubeLogo,
  PiLinkedinLogo,
  PiPinterestLogo,
} from "react-icons/pi";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const Footer = () => {
  const [siteProfile, setSiteProfile] = useState(null);

  useEffect(() => {
    let ignore = false;

    const loadSiteDetails = async () => {
      if (!API_BASE_URL) return;

      try {
        const response = await fetch(`${API_BASE_URL}/site-details`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const activeRow =
          rows.find((row) => String(row?.status || "").toLowerCase() === "active") || rows[0] || null;

        if (!ignore) {
          setSiteProfile(activeRow);
        }
      } catch {
        // Keep footer fallback values when site-details API is unavailable.
      }
    };

    loadSiteDetails();
    return () => {
      ignore = true;
    };
  }, []);

  const contactEmails = useMemo(() => {
    const apiEmails = Array.isArray(siteProfile?.emails)
      ? siteProfile.emails
          .filter((row) => String(row?.status || "active").toLowerCase() !== "inactive")
          .map((row) => String(row?.email_address || "").trim())
          .filter(Boolean)
      : [];

    if (apiEmails.length) return apiEmails;

    return [
      "support@aabhyasamessenger.com",
      "developer@aabhyasamessenger.com",
      "media@aabhyasamessenger.com",
    ];
  }, [siteProfile]);

  const brandName = String(siteProfile?.brand_name || "").trim() || "Aabhyasa Messenger";

  const socialLinks = useMemo(
    () => ({
      facebook: String(siteProfile?.google_plus_url || "").trim() || "#!",
      twitter: String(siteProfile?.twitter_url || "").trim() || "#!",
      instagram: "#!",
      youtube: String(siteProfile?.youtube_url || "").trim() || "#!",
      linkedin: String(siteProfile?.linkedin_url || "").trim() || "#!",
      pinterest: "#!",
    }),
    [siteProfile]
  );

  return (
    <footer className="footer">
      <div className="container-fluid px-md-5 wrapper">
        <div className="row mx-0">
          {/* About Section */}
          <div className="col-lg-4 col-md-6 col-12 mb-4">
            <h5 className="text-uppercase mb-2">
              {brandName}
            </h5>
            <p className="text-muted fs-6 pe-md-4 ">
              Give enough space to your business to grow. Make it accessible
              anytime anywhere. Check out the Troop Messenger Office Chat app –
              Make your office communication flawless and absolutely secure. Try
              out Troop Messenger – the best-in-class instant messaging app for
              business in terms of Data security, ease of use, IP ownership,
              secured & monitored entry etiquette, and many more. This business
              chat app has been purposely built for you. Use Troop Messenger
              work chat app and enjoy the experience!
            </p>
          </div>

          {/* About Links */}
          <div className="col-lg-2 col-md-6 col-12 mb-4">
            <h6 className="fw-bold">About</h6>
            <ul className="list-unstyled">
              <li>
                <Link to="/" className="text-muted ">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-muted ">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted ">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/downloads" className="text-muted ">
                  Downloads
                </Link>
              </li>
              <li>
                <Link to="/blogs" className="text-muted ">
                  Blogs
                </Link>
              </li>
              <li>
                <Link to="/versions" className="text-muted ">
                  Versions
                </Link>
              </li>
              <li>
                <Link to="/channel-partner" className="text-muted ">
                  Channel Partner
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div className="col-lg-2 col-md-6 col-12 mb-4">
            <h6 className="fw-bold">Support</h6>
            <ul className="list-unstyled">
              <li>
                <Link to="/faqs" className="text-muted ">
                  FAQs
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-muted ">
                  How it Works
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted ">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-muted ">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Policy Links */}
          <div className="col-lg-2 col-md-6 col-12 mb-4">
            <h6 className="fw-bold">Policy</h6>
            <ul className="list-unstyled">
              <li>
                <Link to="/saas-privacy" className="text-muted ">
                  SaaS Privacy
                </Link>
              </li>
              <li>
                <Link to="/on-premise-privacy" className="text-muted ">
                  On Premise Privacy
                </Link>
              </li>
              <li>
                <Link to="/air-gapped-privacy" className="text-muted ">
                  Air Gapped Privacy
                </Link>
              </li>
              <li>
                <Link to="/gdpr" className="text-muted ">
                  GDPR
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-muted ">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us Section */}
          <div className="col-lg-2 col-md-6 col-12">
            <h6 className="fw-bold">Contact Us</h6>
            {contactEmails.map((email, index) => (
              <p
                key={`${email}-${index}`}
                className={`text-muted mb-${index === contactEmails.length - 1 ? 4 : 1}`}
              >
                {email}
              </p>
            ))}
            <div className="d-flex gap-2">
              <a href={socialLinks.facebook} className="text-muted" target="_blank" rel="noreferrer">
                <PiFacebookLogo size={24} />
              </a>
              <a href={socialLinks.twitter} className="text-muted" target="_blank" rel="noreferrer">
                <PiTwitterLogo size={24} />
              </a>
              <a href={socialLinks.instagram} className="text-muted" target="_blank" rel="noreferrer">
                <PiInstagramLogo size={24} />
              </a>
              <a href={socialLinks.youtube} className="text-muted" target="_blank" rel="noreferrer">
                <PiYoutubeLogo size={24} />
              </a>
              <a href={socialLinks.linkedin} className="text-muted" target="_blank" rel="noreferrer">
                <PiLinkedinLogo size={24} />
              </a>
              <a href={socialLinks.pinterest} className="text-muted" target="_blank" rel="noreferrer">
                <PiPinterestLogo size={24} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="text-center py-3 bg-dark text-white">
        &copy; Copyright 2024. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
