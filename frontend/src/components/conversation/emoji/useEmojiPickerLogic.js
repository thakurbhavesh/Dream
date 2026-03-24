import { useCallback, useState } from "react";

const useEmojiPickerLogic = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closePicker = useCallback(() => setIsOpen(false), []);

  const togglePicker = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    closePicker,
    togglePicker,
  };
};

export default useEmojiPickerLogic;
