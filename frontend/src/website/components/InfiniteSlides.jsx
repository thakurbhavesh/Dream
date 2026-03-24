import React from "react";

const InfiniteSlides = () => {
  return (
    <>
      <div
        className="sliding-images-container"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          top: "0",
          left: "0",
        }}
      >
        <div
          className="sliding-images"
          style={{
            position: "absolute",
            display: "flex",
            animation: "slideAnimation 6s infinite linear",
          }}
        >
          {/* Image 1 */}
          <div
            className="image-wrapper"
            style={{
              position: "relative",
              width: "100%",
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={require("../assets/Images/helpdesk.gif")}
              alt="Helpdesk"
              style={{
                width: "150px",
                height: "150px",
                opacity: 0.3,
              }}
            />
          </div>

          {/* Image 2 */}
          <div
            className="image-wrapper"
            style={{
              position: "relative",
              width: "100%",
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={require("../assets/Images/teamwork.gif")}
              alt="Teamwork"
              style={{
                width: "150px",
                height: "150px",
                opacity: 0.3,
              }}
            />
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes slideAnimation {
            0% { transform: translateX(0); }
            50% { transform: translateX(-100%); }
            100% { transform: translateX(-200%); }
          }
        `}
      </style>
    </>
  );
};

export default InfiniteSlides;
