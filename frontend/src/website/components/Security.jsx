import { Typography } from "@mui/material";
import {
  PiChatCircle,
  PiCloudCheck,
  PiHandshake,
  PiLockKey,
  PiRocketLaunch,
  PiShieldCheck,
  PiUserGear,
  PiWifiHigh,
} from "react-icons/pi";
import React from "react";
import secureImg from "../assets/Images/secure.png";
import videoCallImg from "../assets/Images/video_call.png";

const Security = () => {
  return (
    <>
      {/* security and scale container */}
      <section className="secure-container wrapper ">
        <div className="responsive-paragraph mx-auto text-md-start text-center">
          <h2>Security & scale</h2>
          <p className="  my-2">Protect your intellectual property</p>
        </div>

        <div className="container-fluid ">
          <div className="row mx-0">
            <div className="col-lg-5 offset-xl-1 col-md-6 col-12">
              <div className="row mx-2 gy-md-5 gy-2 my-auto">
                <div className="col-md-12 col-sm-4 col-12">
                  <div className="px-md-5 px-2">
                    <h5 className="mt-3">Admin Controls</h5>
                    <p>
                      Your Messenger admin will have complete control over which
                      features must be made available to app users.
                    </p>
                  </div>
                </div>
                <div className="col-md-12 col-sm-4 col-12">
                  <div className="px-md-5 px-2">
                    <h5 className="mt-3">End-to-End Encryption</h5>
                    <p>
                      All of your messages, calls, conferences, and files are
                      end-to-end encrypted. Messenger engages the most proven
                      security protocols to secure your data
                    </p>
                  </div>
                </div>
                <div className="col-md-12 col-sm-4 col-12">
                  <div className="px-md-5 px-2">
                    <h5 className="mt-3">Multi-Factor Authentication (MFA)</h5>
                    <p>
                      Employ multiple levels of security for your enterprise
                      messaging software, TeamChatX, to avoid
                      unauthorized access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6 col-12 my-md-auto my-4 position-relative">
              <div className="side-img">
                <img src={secureImg} className="transform-tilt-left" alt="Secure workspace" />
                <span className="bg-element-1 d-none d-md-block"></span>
              </div>
              <span className="element d-none d-md-block"></span>
            </div>
          </div>
        </div>
      </section>


      {/* why us container */}
      <section className="whyUs-container wrapper mt-md-5">
        <div className="responsive-paragraph ms-auto  text-center text-md-start">
          <h2>Why TeamChatX</h2>
          <p className="my-2">
            Plan your work schedules and projects on this team chat software
            with:
          </p>
        </div>
        <div className="container-fluid ">
          <div className="row mx-0">
            <div className="col-md-6 col-12 my-md-auto my-5 position-relative">
              <div className="side-img">
                <img src={videoCallImg} className="transform-tilt-right" alt="Video call" />
                <span className="bg-element-2 d-none d-md-block"></span>
              </div>
              <span className="element d-none d-md-block"></span>
            </div>
            <div className="col-lg-6 col-md-6 col-12 my-auto">
              <div className="row mx-0 gy-md-4 gy-2">
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiShieldCheck size={32} />
                    <Typography>
                    SaaS and On-Premise Service Offerings
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiUserGear size={32} />
                    <Typography>
                    Enterprise Dashboard
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiHandshake size={32} />
                    <Typography>
                    Enterprise-Grade Collaboration Features
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiLockKey size={32} />
                    <Typography>
                    Role-Based Access Controls
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiWifiHigh size={32} />
                    <Typography>
                    Uninterrupted and Seamless Communication
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiRocketLaunch size={32} />
                    <Typography>
                    Unlimited Work Productivity Features
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiCloudCheck size={32} />
                    <Typography>
                    Uniform sync on all device
                    </Typography>
                  </div>
                </div>
                <div className="col-md-6 col-12">
                  <div className="d-flex gap-3 align-items-center">
                    <PiChatCircle size={32} />
                    <Typography>
                    End-to-End Encrpyted
                    </Typography>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Security;
