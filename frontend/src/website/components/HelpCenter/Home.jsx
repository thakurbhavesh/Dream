import React from "react";
import { PiArrowCircleRight, PiPlayCircle, PiQuestion, PiUserCircle } from "react-icons/pi";

const Home = ({ setActiveTab }) => {
  return (
    <div>
      <div className="row wrapper gy-4">
        {/* How To Card */}
        <div className="col-lg-3 col-md-6 col-12">
          <div className="rounded-card">
            <div className="p-2 d-flex justify-content-between align-items-center">
              <h6 className="text-danger mb-0">How To</h6>
              <PiQuestion size={28} className="text-primary" />
            </div>
            <div className="card-body d-flex flex-column justify-content-between align-items-end ">
              <p className="text-muted fs-6">
                TeamChatX’s How To guides provide a precise and quick
                feature orientation with step-wise processes.
              </p>
              <button
                className="btn btn-link p-0"
                onClick={() => setActiveTab("howTo")}
              >
                <PiArrowCircleRight size={28} className="text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* FAQs Card */}
        <div className="col-lg-3 col-md-6 col-12">
          <div className="rounded-card">
            <div className="p-2 d-flex justify-content-between align-items-center">
              <h6 className="text-danger mb-0">FAQs</h6>
              <PiQuestion size={28} className="text-primary" />
            </div>
            <div className="card-body d-flex flex-column justify-content-between align-items-end">
              <p className="text-muted fs-6">
                Our application FAQs let you find instant answers for your
                complex queries. Be it feature-related or troubleshooting
                FAQs, we have you covered.
              </p>
              <button
                className="btn btn-link p-0"
                onClick={() => setActiveTab("faqs")}
              >
                <PiArrowCircleRight size={28} className="text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Videos Card */}
        <div className="col-lg-3 col-md-6 col-12">
          <div className="rounded-card">
            <div className="p-2 d-flex justify-content-between align-items-center">
              <h6 className="text-danger mb-0">Videos</h6>
              <PiPlayCircle size={28} className="text-primary" />
            </div>
            <div className="card-body d-flex flex-column justify-content-between align-items-end">
              <p className="text-muted fs-6">
                TeamChatX’s feature-videos present a complete overview
                of the application's core functionality.
              </p>
              <button
                className="btn btn-link p-0"
                onClick={() => setActiveTab("videos")}
              >
                <PiArrowCircleRight size={28} className="text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Support Card */}
        <div className="col-lg-3 col-md-6 col-12">
          <div className="rounded-card">
            <div className="p-2 d-flex justify-content-between align-items-center">
              <h6 className="text-danger mb-0">Support</h6>
              <PiUserCircle size={28} className="text-primary" />
            </div>
            <div className="card-body d-flex flex-column justify-content-between align-items-end">
              <p className="text-muted fs-6">
                Our 24/7 support services allow users to interact with our
                team for all kinds of technical assistance.
              </p>
              <button
                className="btn btn-link p-0"
                onClick={() => setActiveTab("support")}
              >
                <PiArrowCircleRight size={28} className="text-primary" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
