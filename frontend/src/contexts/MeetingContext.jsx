import React, { createContext, useContext } from "react";
import useMeeting from "../hooks/useMeeting.js";

const MeetingContext = createContext(null);

export const MeetingProvider = ({ children }) => {
  const meeting = useMeeting();
  return (
    <MeetingContext.Provider value={meeting}>
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeetingContext = () => {
  const ctx = useContext(MeetingContext);
  if (!ctx) {
    throw new Error("useMeetingContext must be used within a MeetingProvider");
  }
  return ctx;
};

export default MeetingProvider;
