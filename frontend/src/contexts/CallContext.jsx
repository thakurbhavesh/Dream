import React, { createContext, useContext } from "react";
import useCall from "../hooks/useCall.js";

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const call = useCall();

  return (
    <CallContext.Provider value={call}>
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = () => {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error("useCallContext must be used within a CallProvider");
  }
  return ctx;
};

export default CallProvider;
