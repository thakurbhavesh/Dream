import React from "react";

const Page404 = () => {
  const pageStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f8f9fa",
    color: "#6c757d",
    fontFamily: "'Roboto', sans-serif",
    textAlign: "center",
  };

  const headingStyle = {
    fontSize: "6rem",
    marginBottom: "1rem",
  };

  const textStyle = {
    fontSize: "1.5rem",
    marginBottom: "2rem",
  };

  const buttonStyle = {
    padding: "10px 20px",
    fontSize: "1rem",
    color: "#fff",
    backgroundColor: "#007bff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>404</h1>
      <p style={textStyle}>Oops! The page you are looking for does not exist.</p>
      <a href="/" style={buttonStyle}>
        Go Back to Home
      </a>
    </div>
  );
};

export default Page404;
