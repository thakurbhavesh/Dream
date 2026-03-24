import React, { createContext, useContext } from "react";
import useChatLock from "../hooks/useChatLock.js";

const ChatLockContext = createContext(null);

export const ChatLockProvider = ({ children }) => {
  const lockState = useChatLock();
  return (
    <ChatLockContext.Provider value={lockState}>
      {children}
    </ChatLockContext.Provider>
  );
};

export const useChatLockContext = () => {
  const context = useContext(ChatLockContext);
  if (!context) {
    throw new Error("useChatLockContext must be used within a ChatLockProvider");
  }
  return context;
};

export default ChatLockContext;
