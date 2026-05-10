import React from "react";
import { TextField, MenuItem, InputAdornment } from "@mui/material";
import { PiCalendar, PiPhone } from "react-icons/pi";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const Demo = () => {
  const { brandName } = useSiteBranding();
  return (
    <div className="container wrapper">
      <div className="row ">
        {/* Left Section */}
        <div className="col-md-6 px-0">
          <div className="demo-left d-flex justify-content-between flex-column gap-3">
            <h5 className="fw-bold">REQUEST DEMO</h5>
            <div
              className="bg-blurred"
            >
             
            <p className="">Our Demo Will Include:</p>
            <ul>
              <li>The sign-up process of {brandName}.</li>
              <li>A detailed walk-through of all the core features.</li>
              <li>
                Make you understand the user-end and admin-end process workflows.
              </li>
              <li>Detailing of different pricing variants.</li>
            </ul>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="col-md-6 px-0">
          <div className="p-4 shadow bg-white ">
            <div className="row g-3">
              {/* Name */}
              <div className="col-12">
                <TextField
                  fullWidth
                  label="Your Name"
                  required
                  variant="outlined"
                />
              </div>
              {/* Company Name */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  label="Company Name"
                  required
                  variant="outlined"
                />
              </div>
              {/* Company Size */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  select
                  label="Company Size"
                  required
                  variant="outlined"
                >
                  <MenuItem value="1-10">1-10</MenuItem>
                  <MenuItem value="11-50">11-50</MenuItem>
                  <MenuItem value="51-200">51-200</MenuItem>
                  <MenuItem value="200+">200+</MenuItem>
                </TextField>
              </div>
              {/* Mobile Number */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  label="Mobile Number"
                  type="tel"
                  required
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PiPhone size={20} />
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              {/* Email Address */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  required
                  variant="outlined"
                />
              </div>
              {/* Schedule Date & Time */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  label="Schedule Date & Time"
                  required
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <PiCalendar size={20} />
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              {/* Timezone */}
              <div className="col-md-6">
                <TextField
                  fullWidth
                  select
                  label="Timezone"
                  required
                  variant="outlined"
                >
                  <MenuItem value="GMT +5:30">(GMT +5:30) Asia/Calcutta</MenuItem>
                  <MenuItem value="GMT +0:00">(GMT +0:00) Europe/London</MenuItem>
                  <MenuItem value="GMT -8:00">(GMT -8:00) US/Pacific</MenuItem>
                </TextField>
              </div>
              {/* Query */}
              <div className="col-12">
                <TextField
                  fullWidth
                  label="Your Query"
                  multiline
                  rows={4}
                  required
                  variant="outlined"
                />
              </div>
              {/* Buttons */}
              <div className="col-12 d-flex justify-content-between">
                <button className="fill-btn">Reset</button>
                <button className="main-btn">Submit</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
