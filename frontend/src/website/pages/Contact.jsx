import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
} from "@mui/material";
import { PiEnvelopeSimple, PiPaperPlaneTilt, PiPhone } from "react-icons/pi";
import handshakeImg from "../assets/Images/handshaking.png";
import searchGridImg from "../assets/Images/search-grid-image.jpg";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const Contact = () => {
  const [formValues, setFormValues] = useState({
    name: "",
    emailAddress: "",
    countryCode: "+91",
    mobileNumber: "",
    totalUsers: "",
    requirementDetails: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCountriesLoading, setIsCountriesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [siteProfile, setSiteProfile] = useState(null);
  const [countries, setCountries] = useState([]);

  const normalizeDialCode = (value) => {
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? `+${digits}` : "";
  };

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
          rows.find(
            (row) => String(row?.status || "").toLowerCase() === "active",
          ) ||
          rows[0] ||
          null;
        if (!ignore) setSiteProfile(activeRow);
      } catch {
        // Contact page fallback values remain in use.
      }
    };

    loadSiteDetails();
    return () => {
      ignore = true;
    };
  }, []);

useEffect(() => {
  let ignore = false;

  const loadCountries = async () => {
    if (!API_BASE_URL) return;

    setIsCountriesLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/geo/countries?limit=500&offset=0`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch countries");
        return;
      }

      const payload = await response.json().catch(() => ({}));

      const rows = Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : [];

      console.log("Countries from API:", rows.length);

      const parsed = rows
        .map((row) => ({
          id: Number(row?.country_id || 0),
          isoCode: String(row?.iso_code || "")
            .trim()
            .toUpperCase(),
          name: String(row?.name || "").trim(),
          dialCode: normalizeDialCode(row?.phonecode) || "",
        }))
        .filter((row) => row.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log("Parsed countries:", parsed.length);

      if (!ignore) {
        setCountries(parsed);

        const india = parsed.find((row) => row.isoCode === "IN");

        if (india?.dialCode) {
          setFormValues((prev) => ({
            ...prev,
            countryCode: india.dialCode,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading countries:", error);
    } finally {
      if (!ignore) setIsCountriesLoading(false);
    }
  };

  loadCountries();

  return () => {
    ignore = true;
  };
}, []);

  const siteEmails = useMemo(() => {
    const rows = Array.isArray(siteProfile?.emails) ? siteProfile.emails : [];
    const parsed = rows
      .filter(
        (row) => String(row?.status || "active").toLowerCase() !== "inactive",
      )
      .map((row) => String(row?.email_address || "").trim())
      .filter(Boolean);
    return parsed.length
      ? parsed
      : ["info@yourdomain.com", "info@yourdomain.com"];
  }, [siteProfile]);

  const sitePhones = useMemo(() => {
    const rows = Array.isArray(siteProfile?.phones) ? siteProfile.phones : [];
    const parsed = rows
      .filter(
        (row) => String(row?.status || "active").toLowerCase() !== "inactive",
      )
      .map((row) => String(row?.phone_number || "").trim())
      .filter(Boolean);
    return parsed.length ? parsed : ["(+91) 91217 55111", "+1(732) 218-6668"];
  }, [siteProfile]);

  const primaryAddress = useMemo(() => {
    const rows = Array.isArray(siteProfile?.addresses)
      ? siteProfile.addresses
      : [];
    const preferred =
      rows.find((row) => Boolean(row?.is_primary)) || rows[0] || null;
    if (!preferred) {
      return ["7-10 Bateman's Row", "London", "EC2A 3HH"];
    }

    return [
      preferred.address_line_1,
      preferred.address_line_2,
      preferred.city,
      preferred.state,
      preferred.country,
      preferred.postal_code,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }, [siteProfile]);

  const mapsUrl = useMemo(() => {
    const rows = Array.isArray(siteProfile?.addresses)
      ? siteProfile.addresses
      : [];
    const preferred =
      rows.find((row) => Boolean(row?.is_primary)) || rows[0] || null;
    const postalCode = String(preferred?.postal_code || "").trim();

    const querySource =
      postalCode ||
      [
        preferred?.address_line_1,
        preferred?.address_line_2,
        preferred?.city,
        preferred?.state,
        preferred?.country,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(", ") ||
      primaryAddress.join(", ") ||
      "Google Maps";

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(querySource)}`;
  }, [siteProfile, primaryAddress]);

  const brandName = useMemo(() => {
    const value = String(siteProfile?.brand_name || "").trim();
    return value || "TeamChatX";
  }, [siteProfile]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormValues({
      name: "",
      emailAddress: "",
      countryCode: "+91",
      mobileNumber: "",
      totalUsers: "",
      requirementDetails: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const name = formValues.name.trim();
    const emailAddress = formValues.emailAddress.trim().toLowerCase();
    const countryCode = formValues.countryCode.trim() || "+91";
    const mobile = formValues.mobileNumber.trim();
    const requirementDetails = formValues.requirementDetails.trim();
    const totalUsers = Number(formValues.totalUsers);

    if (
      !name ||
      !emailAddress ||
      !mobile ||
      !requirementDetails ||
      !totalUsers
    ) {
      setErrorMessage(
        "Please fill name, email, mobile, total users, and requirement details.",
      );
      return;
    }

    if (!API_BASE_URL) {
      setErrorMessage("API base URL is missing.");
      return;
    }

    const mobileNumber = mobile.replace(/[^\d]/g, "");
    if (!mobileNumber) {
      setErrorMessage("Please enter a valid mobile number.");
      return;
    }
    if (!Number.isInteger(totalUsers) || totalUsers <= 0) {
      setErrorMessage("Total users must be a positive integer.");
      return;
    }

    const companyName =
      emailAddress.split("@")[1]?.split(".")[0]?.trim() || "Individual";

    const requestBody = {
      name,
      country_code: countryCode,
      mobile_number: mobileNumber,
      email_address: emailAddress,
      company_name: companyName,
      total_users: totalUsers,
      requirement_details: requirementDetails,
    };

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/contact-us`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(payload?.message || "Unable to submit your request.");
        return;
      }

      setSuccessMessage(payload?.message || "Your request has been submitted.");
      resetForm();
    } catch {
      setErrorMessage("Network error while submitting request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="mt-5">
        <div className="container py-5 py-md-0">
          <div className="row mx-0">
            <div className="col-md-6 my-auto">
              <div className=" mb-4">
                <h5 className="text-uppercase text-secondary">
                  Let's Discuss Working Together.
                </h5>
              </div>
              <form onSubmit={handleSubmit}>
                {/* Name Field */}
                <div className="mb-3">
                  <TextField
                    name="name"
                    label="Name"
                    variant="outlined"
                    fullWidth
                    required
                    value={formValues.name}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Email Field */}
                <div className="mb-3">
                  <TextField
                    label="Email"
                    variant="outlined"
                    fullWidth
                    required
                    type="email"
                    name="emailAddress"
                    value={formValues.emailAddress}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Mobile Number Field */}
                <div className="mb-3">
                  <div className="row g-2">
                    <div className="col-4">
                      <TextField
                        name="countryCode"
                        label="Country"
                        variant="outlined"
                        fullWidth
                        select
                        value={formValues.countryCode}
                        onChange={handleInputChange}
                        disabled={isCountriesLoading}
                      >
                        {!countries.length ? (
                          <MenuItem value={formValues.countryCode}>
                            {formValues.countryCode}
                          </MenuItem>
                        ) : null}
                        {countries.map((country) => (
                          <MenuItem
                            key={`${country.id}-${country.isoCode}-${country.dialCode}`}
                            value={country.dialCode}
                          >
                            {country.name} ({country.dialCode})
                          </MenuItem>
                        ))}
                      </TextField>
                    </div>
                    <div className="col-8">
                      <TextField
                        name="mobileNumber"
                        label="Mobile No."
                        variant="outlined"
                        fullWidth
                        required
                        value={formValues.mobileNumber}
                        onChange={handleInputChange}
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <TextField
                    name="totalUsers"
                    label="Total Users"
                    variant="outlined"
                    fullWidth
                    required
                    type="number"
                    value={formValues.totalUsers}
                    onChange={handleInputChange}
                    inputProps={{ min: 1 }}
                  />
                </div>

                {/* Message Field */}
                <div className="mb-3">
                  <TextField
                    name="requirementDetails"
                    label="Requirement Details"
                    variant="outlined"
                    fullWidth
                    multiline
                    rows={4}
                    required
                    value={formValues.requirementDetails}
                    onChange={handleInputChange}
                  />
                </div>
                {errorMessage ? (
                  <div className="mb-3">
                    <Alert severity="error">{errorMessage}</Alert>
                  </div>
                ) : null}
                {successMessage ? (
                  <div className="mb-3">
                    <Alert severity="success">{successMessage}</Alert>
                  </div>
                ) : null}

                {/* Submit Button */}
                <div className="text-md-end text-center">
                  <Button
                    type="submit"
                    variant="contained"
                    color="error"
                    endIcon={
                      isSubmitting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <PiPaperPlaneTilt size={20} />
                      )
                    }
                    className="main-btn mb-3"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send"}
                  </Button>
                </div>
              </form>
            </div>
            <div className="col-md-6 d-none d-md-block mt-auto">
              <img src={handshakeImg} className="img-fluid " />
            </div>
          </div>
        </div>
      </section>
      <section className="wrapper bg-image contact-page">
        <div className="row mx-auto gap-5 justify-content-center wrapper">
          <div className="col-lg-3  col-md-4 col-12">
            <div className="card mt-0">
              <div className="icon my-auto">
                <span className="">
                  <PiEnvelopeSimple size={40} color="white" weight="thin" />
                </span>
              </div>
              <h6 className="fs-6">Mail</h6>
              {siteEmails.slice(0, 3).map((email, index) => (
                <p key={`${email}-${index}`} className="text-muted">
                  {email}
                </p>
              ))}
            </div>
          </div>
          <div className="col-lg-3 col-md-4 col-12">
            <div className="card ">
              <div className="icon my-auto">
                <span className="">
                  <PiPhone size={40} color="white" weight="thin" />
                </span>
              </div>
              <h6 className="fs-6">Contact</h6>
              {sitePhones.slice(0, 3).map((phone, index) => (
                <p key={`${phone}-${index}`}>{phone}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container-fluid wrapper">
          <div className="row mx-0  ">
            <div className="col-md-6 col-12 mb-4">
              <img src={searchGridImg} className="img-fluid " />
            </div>
            <div className="col-md-6 col-12 my-auto">
              <div className="ms-md-5">
                <h2 className="fw-bold">How to find {brandName} HQ</h2>
                {primaryAddress.length ? (
                  <>
                    <h5 className="mt-4">{primaryAddress[0]}</h5>
                    {primaryAddress.slice(1).map((line, index) => (
                      <p
                        key={`${line}-${index}`}
                        className={
                          index === primaryAddress.slice(1).length - 1
                            ? ""
                            : "mb-0"
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </>
                ) : null}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-decoration-none"
                >
                  Open in Google Maps <span>&#8594;</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;
