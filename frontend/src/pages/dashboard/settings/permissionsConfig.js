export const DEFAULT_PERMISSIONS = [
  {
    id: "notifications",
    label: "Notifications",
    description: "Enable notifications",
    enabled: true,
  },
  {
    id: "microphone",
    label: "Microphone",
    description: "Enable microphone",
    enabled: true,
    requiresDevice: "microphone",
  },
  {
    id: "camera",
    label: "Camera",
    description: "Enable camera",
    enabled: false,
    requiresDevice: "camera",
  },
  {
    id: "location",
    label: "Location",
    description: "Enable location",
    enabled: false,
  },
];

export default DEFAULT_PERMISSIONS;
