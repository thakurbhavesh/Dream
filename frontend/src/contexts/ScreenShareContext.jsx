import React, { createContext, useContext } from "react";
import useScreenShare from "../hooks/useScreenShare.js";

const ScreenShareContext = createContext(null);

export const ScreenShareProvider = ({ children }) => {
  const screenShare = useScreenShare();

  return (
    <ScreenShareContext.Provider value={screenShare}>
      {children}
    </ScreenShareContext.Provider>
  );
};

export const useScreenShareContext = () => {
  const ctx = useContext(ScreenShareContext);
  if (!ctx) {
    throw new Error(
      "useScreenShareContext must be used within a ScreenShareProvider"
    );
  }
  return ctx;
};

export default ScreenShareProvider;
