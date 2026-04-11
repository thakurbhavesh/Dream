import { createContext, useContext } from 'react';
import useCallHook from '../hooks/useCall';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const call = useCallHook();
  return (
    <CallContext.Provider value={call}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
