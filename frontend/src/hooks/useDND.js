import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext.jsx";

/**
 * Manages Do Not Disturb state. Syncs with backend via socket events.
 * Usage: const { isDND, toggleDND, dndState, setDNDSchedule } = useDND();
 */
const useDND = () => {
  const socket = useSocket();
  const [dndState, setDndState] = useState({ enabled: false, schedule: null });

  useEffect(() => {
    if (!socket) return;

    const handleState = (data) => {
      if (data) setDndState(data);
    };

    socket.on("dnd:state", handleState);
    return () => socket.off("dnd:state", handleState);
  }, [socket]);

  const isDND = dndState.enabled;

  const toggleDND = useCallback(
    (enabled) => {
      if (!socket) return;
      const newState = { ...dndState, enabled: typeof enabled === "boolean" ? enabled : !dndState.enabled };
      socket.emit("dnd:update", newState, (res) => {
        if (res?.ok) setDndState(newState);
      });
    },
    [socket, dndState]
  );

  const setDNDSchedule = useCallback(
    (schedule) => {
      if (!socket) return;
      const newState = { ...dndState, schedule };
      socket.emit("dnd:update", newState, (res) => {
        if (res?.ok) setDndState(newState);
      });
    },
    [socket, dndState]
  );

  return { isDND, toggleDND, dndState, setDndState, setDNDSchedule };
};

export default useDND;
