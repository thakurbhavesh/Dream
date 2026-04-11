import React from "react";
import { TextField, Button, MenuItem, InputAdornment } from "@mui/material";
import { PiEnvelopeSimple, PiPhone } from "react-icons/pi";

const Support = () => {
  return (
    <div className="container my-5 bg-light wrapper">
      <div className="row gx-4 gy-5">
        {/* Chat Support Section */}
        <div className="col-md-6">
          <div className="card  p-4 h-100 d-flex align-items-center justify-content-between gap-2">
            <div>
              <h6 className="fw-bold mb-3">Chat Support</h6>
              <p className="text-muted">Welcome to our Live Chat Support</p>
              <p className="mb-4">
                Welcome! For instant support, initiate the start button.
              </p>
            </div>
            <div>
              <Button
                variant="contained"
                color="success"
                fullWidth
                sx={{
                  fontWeight: "bold",
                  py: 1.5,
                  textTransform: "none",
                  fontSize: "16px",
                }}
              >
                Start Chat
              </Button>

              <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
                <span
                  className="d-inline-block rounded-circle"
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: "green",
                  }}
                />
                <span className="text-muted small">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Write to Us Section */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm p-4">
            <h6 className="fw-bold mb-1">Help Us Make It Better!</h6>
            <p className=" text-muted fs-6 mb-3">Have an idea for a feature or stumbled upon a glitch? Share your thoughts – we're all ears!</p>
            <div className="row g-3">
              {/* Name Field */}
              <div className="col-md-6">
                <TextField
                  label="Name"
                  variant="outlined"
                  fullWidth
                  required
                />
              </div>
              {/* Email Field */}
              <div className="col-md-6">
                <TextField
                  label="Email"
                  variant="outlined"
                  fullWidth
                  required
                />
              </div>
              {/* Mobile Number */}
              <div className="col-md-6">
                <TextField
                  label="Mobile Number"
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PiPhone size={20} />
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              {/* Reason for Enquiry */}
              <div className="col-md-6">
                <TextField
                  label="Reason for Enquiry"
                  variant="outlined"
                  fullWidth
                  select
                  required
                >
                  <MenuItem value="Ideas">Ideas</MenuItem>
                  <MenuItem value="Feedback">Feedback</MenuItem>
                  <MenuItem value="Complaints">Complaints</MenuItem>
                </TextField>
              </div>
              {/* Message Field */}
              <div className="col-12">
                <TextField
                  label="Message"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={4}
                />
              </div>
              {/* Captcha */}
              <div className="col-md-6">
                <TextField
                  label="Enter Captcha"
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">4 + 4 =</InputAdornment>
                    ),
                  }}
                />
              </div>
              {/* Submit Button */}
              <div className="col-md-6">
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{
                    fontWeight: "bold",
                    py: 1.5,
                    textTransform: "none",
                    fontSize: "16px",
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Section */}
      <div className="text-center mt-5">
        <p>Or, Email us.</p>
        <div className="d-flex justify-content-center align-items-center gap-2">
          <PiEnvelopeSimple size={24} />
          <span className="fw-bold text-primary">
            support@teamchatx.com
          </span>
        </div>
      </div>
    </div>
  );
};

export default Support;
