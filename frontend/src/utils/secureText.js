import { encryptString, decryptString } from "./secureCipher";

export const encryptText = async (text) => encryptString(text);

export const decryptText = async (payload) => decryptString(payload);

export const demoRoundTrip = async (text) => {
  const encrypted = await encryptText(text);
  const restored = await decryptText(encrypted);
  return { encrypted, restored };
};

export default {
  encryptText,
  decryptText,
  demoRoundTrip,
};
