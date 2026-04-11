import React from "react";
import { PiChat, PiUsersThree, PiVideoCamera, PiFile, PiScreencast, PiShieldCheck } from "react-icons/pi";
import manWithLaptopImg from "../assets/Images/man-with-laptop.jpg";

const Features = () => {
  return (
    <section className="features-container wrapper">
      <div className="text-center ">
        <h2>Amazing Features</h2>
        
      </div>

      <div className="container-fluid wrapper mt-lg-5 ">
        <div className="row mx-0">
          <div className="col-md-7 col-12 my-auto position-relative">
            <div className="side-img">
              <img src={manWithLaptopImg} />
            </div>
            <span className="element d-none d-md-block"></span>
          </div>
          <div className="col-lg-4 col-md-5 col-12">
            <div className="row mx-2 gy-5 my-auto">
              <div className="col-md-12 col-sm-4 col-12">
              <p className=" px-2">
          Features that every office team’s needs! Whether you want to send a
          1:1 message, talk in a group, message to bulk, meet securely, and do
          more. All kinds of team collaboration use cases are covered in this
          business chat app!
        </p>
              </div>
              <div className="col-md-12 col-sm-4 col-12">
                <div className="px-lg-5 px-2">
                  <PiChat size={48} color="#f5cb24" />
                  <h5 className="mt-3">Instant Messaging</h5>
                  <p>
                    Send your work requirements to your co-worker through a
                    quick one-to-one instant chat app.
                  </p>
                </div>
              </div>
              <div className="col-md-12 col-sm-4 col-12">
                <div className="px-lg-5 px-2">
                  <PiVideoCamera size={48} color="#0162c4" />
                  <h5 className="mt-3">Audio & Video Calling</h5>
                  <p>
                    Meet via a clear and crisp 1:1 or group audio-video call to
                    share your voice of opinion.
                  </p>
                </div>
              </div>
              <div className="col-md-12 col-sm-4 col-12">
                <div className="px-lg-5 px-2">
                  <PiUsersThree size={48} color="#ff4842" />
                  <h5 className="mt-3">Group Chat</h5>
                  <p>
                    Collaborate in group chats to discuss your daily office work
                    routines! Be a part of the group to access all files and
                    conversations.
                  </p>
                </div>
              </div>
            </div>
          </div>
         
        </div>
      </div>
      <div className="row mx-0 px-4 gy-4 bg-accent" style={{padding: '100px 0'}}>
            <div className=" col-sm-4 col-12">
              <div className="px-md-5 ">
                <PiFile size={48} color="#90c337" />
                <h5 className="mt-3">Files Sharing</h5>
                <p>
                  You can share text files, PDFs, PPTs, images, videos, and URLs
                  across 1:1 and group chats. Preview these on the UI to improve
                  your business productivity.
                </p>
              </div>
            </div>
            <div className=" col-sm-4 col-12">
              <div className="px-md-5 ">
                <PiScreencast size={48} color="#c489e1" />
                <h5 className="mt-3">Remote Screen Share</h5>
                <p>
                  Reach out to your remotest office teams with TeamChatX’s
                  productive and ultra-new screen share feature.
                </p>
              </div>
            </div>
            <div className=" col-sm-4 col-12">
              <div className="px-md-5 ">
                <PiShieldCheck size={48} color="#4fdbe8" />
                <h5 className="mt-3">End-to-End Encryption</h5>
                <p>
                  Your work conversations are under your complete control!
                  Chats, calls, and conferences are end-to-end encrypted in this
                  office chat app.
                </p>
              </div>
            </div>
          </div>
    </section>
  );
};

export default Features;
