import { useEffect, useState } from "react";
import { getMascotAsset, subscribeToMascot } from "../data/brandingStore";

const useMascot = () => {
  const [mascot, setMascot] = useState(() => getMascotAsset());

  useEffect(() => {
    const unsubscribe = subscribeToMascot((value) => setMascot(value));
    return unsubscribe;
  }, []);

  return mascot;
};

export default useMascot;
