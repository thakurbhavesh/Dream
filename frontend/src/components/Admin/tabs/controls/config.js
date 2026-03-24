export const PANEL_MIN_HEIGHT = "calc(100vh - 120px)";

export const sectionMetadata = [
  { id: "globalMembers", title: "Global Members" },
  { id: "indicators", title: "Indicators & Markers" },
  { id: "status", title: "Status" },
  { id: "recall", title: "Recall" },
  { id: "edit", title: "Edit" },
  { id: "access", title: "Access" },
  { id: "messageInfo", title: "MessageInfo" },
  { id: "delete", title: "Delete" },
  { id: "messageMenu", title: "Message Menu" },
];

export const platformOptions = [
  { id: "browser", label: "Browser" },
  { id: "windows", label: "Desktop Windows" },
  { id: "linux", label: "Desktop Linux" },
  { id: "mac", label: "Desktop Mac" },
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
];

export const createInitialSettings = () => ({
  globalMembers: {
    cantBeAdded: false,
    cantSeeMessageInfo: true,
    cantSeeProfileInfo: true,
    cantMakeOneToOne: true,
    cantMakeGroupCalls: false,
    replaceDotShade: false,
  },
  indicators: {
    forward: "enable",
    forkout: "enable",
    typing: "enable",
    lastSeen: "enable",
    platform: "enable",
    employeeLabel: "enable",
    onCallLabel: "enable",
  },
  status: {
    general: {
      available: true,
      doNotDisturb: true,
      away: true,
      idle: true,
    },
    limits: {
      autoAwayMinutes: 10,
      idleMinutes: 5,
    },
    optional: {
      enabled: false,
      options: [
        { id: "cantChat", label: "Can't Chat", active: false },
        { id: "inMeeting", label: "In Meeting", active: false },
        { id: "awayOptional", label: "Away", active: false },
      ],
    },
  },
  
  recall: {
    enabled: true,
    window: { mode: "custom", hours: 0, minutes: 10 },
    roles: { user: true, admin: true },
    groupAdminCanRecall: true,
  },
  edit: {
    enabled: true,
    window: { mode: "custom", hours: 0, minutes: 5, days: 1 },
    roles: { user: true, admin: true },
  },
  access: {
    restrictByIp: true,
    ipMode: "allow",
    ipVersion: "ipv4",
    ipAddress: "",
    ipList: [],
    restrictByPlatform: true,
    allowedPlatforms: ["browser", "windows", "linux", "mac", "android", "ios"],
    blockedPlatforms: [],
  },
  messageInfo: {
    enabled: true,
    permissions: {
      readTime: false,
      deliveredTime: false,
      deviceInfo: false,
      location: true,
    },
    otherControls: {
      groupVisibility: true,
      directVisibility: true,
    },
  },
  delete: { 
    enabled: true,
    roles: { user: true, globalMember: true, tcxAdmin: true },
  },
});
