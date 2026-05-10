import React, { useMemo } from "react";
import {
  PiFacebookLogo,
  PiTwitterLogo,
  PiInstagramLogo,
  PiYoutubeLogo,
  PiLinkedinLogo,
  PiPinterestLogo,
} from "react-icons/pi";
import { Link } from "react-router-dom";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const Footer = () => {
  const { brandName, social, emails } = useSiteBranding();

  const contactEmails = useMemo(() => {
    const apiEmails = Array.isArray(emails)
      ? emails
          .filter(
            (row) => String(row?.status || "active").toLowerCase() !== "inactive"
          )
          .map((row) => String(row?.email_address || "").trim())
          .filter(Boolean)
      : [];

    if (apiEmails.length) return apiEmails;

    return ["support@teamchatx.com", "sales@teamchatx.com"];
  }, [emails]);

  const socialLinks = useMemo(
    () => ({
      facebook: social?.facebook || "#!",
      twitter: social?.twitter || "#!",
      instagram: social?.instagram || "#!",
      youtube: social?.youtube || "#!",
      linkedin: social?.linkedin || "#!",
      pinterest: social?.pinterest || "#!",
    }),
    [social]
  );

  return (
    <footer className="footer">
      <div className="container-fluid px-md-5 wrapper">
        <div className="row mx-0">
          {/* About Section */}
          <div className="col-lg-4 col-md-6 col-12 mb-4">
            <h5 className="text-uppercase mb-2">{brandName}</h5>
            <p className="text-muted fs-6 pe-md-4 ">
              Empower your team with seamless communication. {brandName} is a
              secure, self-hosted business messaging platform built for
              enterprises that demand data privacy, IP ownership, and full
              control. From instant messaging and video meetings to AI-powered
              productivity tools — everything your team needs, on your
              infrastructure.
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
        &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
