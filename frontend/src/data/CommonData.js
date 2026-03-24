// Brand assets consumed by layouts/auth screens.
export const appBrandingAssets = Object.freeze({
  mascot: "/teamchatXElement.png",
  notificationIcon: "/teamchatXElement.png",
  brand: "TeamChatx",
});

// Tenant/org metadata used by the org switcher + filters.
export const mockOrganizations = [
  {
    id: "org-1",
    label: "Aabhyasa Technologies Pvt Ltd.",
    unreadCount: 6,
    isPrimary: true,
  },
  {
    id: "org-2",
    label: "Vedsu",
    unreadCount: 1,
  },
  // {
  //   id: "org-3",
  //   label: "Rcm Innovations",
  //   unreadCount: 0,
  // },
];

// Fallback — real user ID set at runtime via setRealUserId()
export let agentSelfId = "agent-self";

// Call once when real user ID is known (from JWT / auth/me)
export const setRealUserId = (id) => {
  if (id && String(id) !== "agent-self") agentSelfId = String(id);
};

// Helper to inject org-specific defaults into each thread record.
const withCompanyMeta = (companyMeta) => (thread) => ({
  ...companyMeta,
  ...thread,
});

const withAabhyasaMeta = withCompanyMeta({
  company: "Aabhyasa Technologies Pvt Ltd.",
  domain_name: "aabhyasa.com",
  global_user: 0,
});

const withVedsuMeta = withCompanyMeta({
  company: "Vedsu Labs",
  domain_name: "vedsu.com",
  global_user: 1,
});

// Chat roster grouped by organization (used by GeneralApp/ChatList).
const baseMockThreadsByOrg = {
  "org-1": [
    withAabhyasaMeta({
      id: "thread-1",
      user_id: "USR-001",
      username: "Emily Carter",
      label: "Emily Carter",
      email: "emily.carter@aabhyasa.com",
      designation: "Product Manager",
      designation_id: 1,
      department: "Product",
      department_id: 1,
      location: "Bengaluru",
      location_id: 1,
      mobile: "+91 90000 00001",
      password_hash: "$2a$10$emilyCarterPwd",
      user_status: "active",
      selected_user: 1,
      is_verified: 1,
      use_device: 201,
      user_ip: "10.10.0.11",
      last_seen: "2024-11-02T11:40:00Z",
      preview: "Shared the updated onboarding flow for review.",
      time: "11:42",
      messageType: "message",
      readStatus: "delivered",
      unreadCount: 2,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=32",
    }),
    withAabhyasaMeta({
      id: "thread-2",
      user_id: "USR-002",
      username: "Rahul Desai",
      label: "Rahul Desai",
      email: "rahul.desai@aabhyasa.com",
      designation: "Engineering Lead",
      designation_id: 2,
      department: "Platform",
      department_id: 2,
      location: "Pune",
      location_id: 2,
      mobile: "+91 90000 00002",
      password_hash: "$2a$10$rahulDesaiPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 202,
      user_ip: "10.10.0.22",
      last_seen: "2024-11-02T10:57:00Z",
      preview: "Sent the sprint summary deck earlier today.",
      time: "10:58",
      messageType: "link",
      readStatus: "undelivered",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "https://i.pravatar.cc/150?img=55",
    }),
    withAabhyasaMeta({
      id: "thread-4",
      user_id: "USR-004",
      username: "Sofia Martinez",
      label: "Sofia Martinez",
      email: "sofia.martinez@aabhyasa.com",
      designation: "UX Designer",
      designation_id: 3,
      department: "Design",
      department_id: 3,
      location: "Hyderabad",
      location_id: 3,
      mobile: "+91 90000 00004",
      password_hash: "$2a$10$sofiaMartinezPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 203,
      user_ip: "10.10.0.33",
      last_seen: "2024-11-02T10:20:00Z",
      preview: "",
      time: "10:22",
      messageType: "attachment",
      readStatus: "delivered",
      unreadCount: 0,
      status: "Away",
      profilePicture: "https://i.pravatar.cc/150?img=47",
    }),
    withAabhyasaMeta({
      id: "thread-5",
      user_id: "USR-005",
      username: "Noah Patel",
      label: "Noah Patel",
      email: "noah.patel@aabhyasa.com",
      designation: "QA Analyst",
      designation_id: 4,
      department: "Quality",
      department_id: 4,
      location: "Mumbai",
      location_id: 4,
      mobile: "+91 90000 00005",
      password_hash: "$2a$10$noahPatelPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 204,
      user_ip: "10.10.0.45",
      last_seen: "2024-11-02T09:38:00Z",
      preview: "Stand-up note: still blocked on the auth API.",
      time: "09:40",
      messageType: "message",
      readStatus: "unread",
      unreadCount: 3,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=11",
    }),
    withAabhyasaMeta({
      id: "thread-6",
      user_id: "USR-006",
      username: "Sara Evans",
      label: "Sara Evans",
      email: "sara.evans@aabhyasa.com",
      designation: "Support Specialist",
      designation_id: 5,
      department: "Support",
      department_id: 5,
      location: "New Delhi",
      location_id: 5,
      mobile: "+91 90000 00006",
      password_hash: "$2a$10$saraEvansPwd",
      user_status: "inactive",
      selected_user: 0,
      is_verified: 1,
      use_device: 205,
      user_ip: "10.10.0.56",
      last_seen: "2024-11-01T18:20:00Z",
      preview: "Escalated ticket #4569 needs your eyes.",
      time: "09:12",
      messageType: "message",
      readStatus: "undelivered",
      unreadCount: 0,
      status: "Offline",
      profilePicture: "https://i.pravatar.cc/150?img=65",
    }),
    withAabhyasaMeta({
      id: "thread-7",
      user_id: "USR-007",
      username: "Mason Brooks",
      label: "Mason Brooks",
      email: "mason.brooks@aabhyasa.com",
      designation: "Marketing Strategist",
      designation_id: 6,
      department: "Marketing",
      department_id: 6,
      location: "Kolkata",
      location_id: 7,
      mobile: "+91 90000 00007",
      password_hash: "$2a$10$masonBrooksPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 206,
      user_ip: "10.10.0.57",
      last_seen: "2024-11-02T08:50:00Z",
      preview: "Shared the revised launch checklist.",
      time: "08:56",
      messageType: "attachment",
      readStatus: "read",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "",
    }),
    withAabhyasaMeta({
      id: "thread-8",
      user_id: "USR-008",
      username: "Bianca Flores",
      label: "Bianca Flores",
      email: "bianca.flores@aabhyasa.com",
      designation: "Finance Manager",
      designation_id: 7,
      department: "Finance",
      department_id: 7,
      location: "Mumbai",
      location_id: 4,
      mobile: "+91 90000 00008",
      password_hash: "$2a$10$biancaFloresPwd",
      user_status: "inactive",
      selected_user: 0,
      is_verified: 0,
      use_device: 207,
      user_ip: "10.10.0.58",
      last_seen: "2024-10-30T16:00:00Z",
      preview: "",
      time: "08:20",
      messageType: "message",
      readStatus: "read",
      unreadCount: 0,
      status: "neverlogged",
      profilePicture: "https://i.pravatar.cc/150?img=21",
    }),
    withAabhyasaMeta({
      id: "thread-9",
      user_id: "USR-009",
      username: "Olivia Chen",
      label: "Olivia Chen",
      email: "olivia.chen@aabhyasa.com",
      designation: "Automation Engineer",
      designation_id: 8,
      department: "DevOps",
      department_id: 8,
      location: "Hyderabad",
      location_id: 3,
      mobile: "+91 90000 00009",
      password_hash: "$2a$10$oliviaChenPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 208,
      user_ip: "10.10.0.59",
      last_seen: "2024-11-02T07:40:00Z",
      preview: "Regression tests uncovered three new issues.",
      time: "07:45",
      messageType: "message",
      readStatus: "delivered",
      unreadCount: 0,
      status: "Away",
      profilePicture: "",
    }),
    withAabhyasaMeta({
      id: "thread-10",
      user_id: "USR-010",
      username: "Leo Thompson",
      label: "Leo Thompson",
      email: "leo.thompson@aabhyasa.com",
      designation: "Data Analyst",
      designation_id: 9,
      department: "Analytics",
      department_id: 9,
      location: "Remote",
      location_id: 8,
      mobile: "+91 90000 00010",
      password_hash: "$2a$10$leoThompsonPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 209,
      user_ip: "10.10.0.60",
      last_seen: "2024-11-02T07:05:00Z",
      preview: "Weekly metrics report is ready in the drive.",
      time: "07:10",
      messageType: "link",
      readStatus: "read",
      unreadCount: 0,
      status: "Offline",
      profilePicture: "https://i.pravatar.cc/150?img=34",
    }),
    withAabhyasaMeta({
      id: "thread-11",
      user_id: "USR-011",
      username: "Harper Singh",
      label: "Harper Singh",
      email: "harper.singh@aabhyasa.com",
      designation: "Security Analyst",
      designation_id: 10,
      department: "Security",
      department_id: 10,
      location: "Chennai",
      location_id: 6,
      mobile: "+91 90000 00011",
      password_hash: "$2a$10$harperSinghPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 210,
      user_ip: "10.10.0.61",
      last_seen: "2024-11-02T06:20:00Z",
      preview: "Security audit findings look manageable.",
      time: "06:25",
      messageType: "message",
      readStatus: "delivered",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "https://i.pravatar.cc/150?img=52",
    }),
    withAabhyasaMeta({
      id: "thread-12",
      user_id: "USR-012",
      username: "Isaac Romero",
      label: "Isaac Romero",
      email: "isaac.romero@aabhyasa.com",
      designation: "DevOps Engineer",
      designation_id: 11,
      department: "DevOps",
      department_id: 8,
      location: "Austin",
      location_id: 9,
      mobile: "+1 512 555 0101",
      password_hash: "$2a$10$isaacRomeroPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 211,
      user_ip: "10.10.0.62",
      last_seen: "2024-11-02T05:15:00Z",
      preview: "Drafted a new deployment workflow proposal.",
      time: "05:18",
      messageType: "attachment",
      readStatus: "sent",
      unreadCount: 0,
      status: "Offline",
      profilePicture: "https://i.pravatar.cc/150?img=25",
    }),
    withAabhyasaMeta({
      id: "thread-ops-group",
      type: "group",
      threadType: "group",
      conversationType: "group",
      groupName: "Platform Ops Squad",
      label: "Platform Ops Squad",
      description: "Cross-functional room for incident + release coordination.",
      email: "platform-ops@aabhyasa.com",
      profilePicture: "https://i.pravatar.cc/150?img=13",
      lastMessageAt: "2024-11-04T15:47:00Z",
      preview: "Rahul removed Ava Nair",
      time: "15:47",
      messageType: "system",
      readStatus: "delivered",
      unreadCount: 4,
      status: "Online",
      lastMessage: {
        id: "grp-event-2",
        type: "system",
        createdAt: "2024-11-04T15:47:00.000Z",
        metadata: {
          event: {
            action: "member_removed",
            actor: { name: "Rahul Desai" },
            targets: [{ name: "Ava Nair" }],
          },
        },
      },
      memberCount: 5,
      members: [
        {
          id: "USR-002",
          name: "Rahul Desai",
          email: "rahul.desai@aabhyasa.com",
          role: "Engineering Lead",
          avatar: "https://i.pravatar.cc/150?img=55",
        },
        {
          id: agentSelfId,
          name: "You",
          email: "agent.self@teamchatx.com",
          role: "Admin",
          avatar: "",
        },
        {
          id: "USR-004",
          name: "Sofia Martinez",
          email: "sofia.martinez@aabhyasa.com",
          role: "UX Designer",
          avatar: "https://i.pravatar.cc/150?img=47",
        },
        {
          id: "USR-008",
          name: "Lia Chen",
          email: "lia.chen@aabhyasa.com",
          role: "Release Manager",
          avatar: "https://i.pravatar.cc/150?img=23",
        },
        {
          id: "USR-009",
          name: "Leo Thompson",
          email: "leo.thompson@aabhyasa.com",
          role: "Site Reliability",
          avatar: "https://i.pravatar.cc/150?img=17",
        },
        {
          id: "USR-010",
          name: "Aria Kapoor",
          email: "aria.kapoor@aabhyasa.com",
          role: "Product Ops",
          avatar: "https://i.pravatar.cc/150?img=5",
        },
      ],
      participants: [
        "rahul.desai@aabhyasa.com",
        "sofia.martinez@aabhyasa.com",
        "lia.chen@aabhyasa.com",
        "leo.thompson@aabhyasa.com",
        "aria.kapoor@aabhyasa.com",
        "agent.self@teamchatx.com",
      ],
      wallpaper: "/wallpapers/ops-grid.png",
    }),
    {
      id: "thread-global-1",
      user_id: "GUSR-101",
      username: "Evelyn Hart",
      label: "Evelyn Hart",
      email: "evelyn.hart@vedsu.com",
      designation: "Director, Customer Success",
      designation_id: 19,
      department: "Customer Success",
      department_id: 11,
      company: "Vedsu Labs",
      domain_name: "vedsu.com",
      location: "London",
      location_id: 10,
      mobile: "+44 20 5555 0101",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      global_user: 1,
      isGlobalMember: true,
      allowedAgentIds: [agentSelfId],
      use_device: 420,
      user_ip: "185.10.0.42",
      last_seen: "2024-11-02T09:10:00Z",
      preview: "Appreciate the quick hand-off on the rollout status.",
      time: "09:12",
      messageType: "message",
      readStatus: "delivered",
      unreadCount: 1,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=15",
    },
    {
      id: "thread-global-2",
      user_id: "GUSR-102",
      username: "Carlos Mendez",
      label: "Carlos Mendez",
      email: "carlos.mendez@northwind.io",
      designation: "VP, Operations",
      designation_id: 20,
      department: "Operations",
      department_id: 15,
      company: "Northwind Logistics",
      domain_name: "northwind.io",
      location: "Austin",
      location_id: 8,
      mobile: "+1 737 555 8920",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      global_user: 1,
      isGlobalMember: true,
      allowedAgentIds: [agentSelfId],
      use_device: 421,
      user_ip: "65.102.10.7",
      last_seen: "2024-11-01T18:30:00Z",
      preview: "Sharing the revised logistics SLA for signature.",
      time: "18:35",
      messageType: "attachment",
      readStatus: "sent",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "https://i.pravatar.cc/150?img=27",
    },
    {
      id: "thread-global-3",
      user_id: "GUSR-103",
      username: "Lara Schmidt",
      label: "Lara Schmidt",
      email: "lara.schmidt@globex.com",
      designation: "Head of Partnerships",
      designation_id: 21,
      department: "Partnerships",
      department_id: 16,
      company: "Globex Europe",
      domain_name: "globex.com",
      location: "Berlin",
      location_id: 11,
      mobile: "+49 30 5555 7711",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      global_user: 1,
      isGlobalMember: true,
      allowedAgentIds: [agentSelfId],
      use_device: 422,
      user_ip: "91.10.56.143",
      last_seen: "2024-11-02T06:45:00Z",
      preview: "Need your inputs on the ecosystem partner short-list.",
      time: "06:48",
      messageType: "message",
      readStatus: "read",
      unreadCount: 3,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=41",
    },
  ],

  "org-2": [
    withVedsuMeta({
      id: "thread-3",
      user_id: "USR-203",
      username: "Neha Reddy",
      label: "Neha Reddy",
      email: "neha.reddy@vedsu.com",
      designation: "Account Manager",
      designation_id: 12,
      department: "Customer Success",
      department_id: 11,
      location: "London",
      location_id: 10,
      mobile: "+44 7700 900301",
      password_hash: "$2a$10$nehaReddyPwd",
      user_status: "active",
      selected_user: 1,
      is_verified: 1,
      use_device: 301,
      user_ip: "172.16.0.31",
      last_seen: "2024-11-02T04:00:00Z",
      preview: "Static preview for other org",
      time: "04:05",
      messageType: "link",
      readStatus: "read",
      unreadCount: 1,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=41",
    }),
    withVedsuMeta({
      id: "thread-13",
      user_id: "USR-213",
      username: "Arjun Malhotra",
      label: "Arjun Malhotra",
      email: "arjun.malhotra@vedsu.com",
      designation: "Sales Director",
      designation_id: 13,
      department: "Sales",
      department_id: 12,
      location: "Mumbai",
      location_id: 4,
      mobile: "+91 90000 02013",
      password_hash: "$2a$10$arjunMalhotraPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 302,
      user_ip: "172.16.0.32",
      last_seen: "2024-11-02T03:40:00Z",
      preview: "Forecast spreadsheet shared for Q4 targets.",
      time: "03:48",
      messageType: "attachment",
      readStatus: "delivered",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "https://i.pravatar.cc/150?img=72",
    }),
    withVedsuMeta({
      id: "thread-14",
      user_id: "USR-214",
      username: "Priya Kulkarni",
      label: "Priya Kulkarni",
      email: "priya.kulkarni@vedsu.com",
      designation: "HR Business Partner",
      designation_id: 14,
      department: "People Ops",
      department_id: 13,
      location: "Pune",
      location_id: 2,
      mobile: "+91 90000 02014",
      password_hash: "$2a$10$priyaKulkarniPwd",
      user_status: "inactive",
      selected_user: 0,
      is_verified: 1,
      use_device: 303,
      user_ip: "172.16.0.33",
      last_seen: "2024-10-29T17:10:00Z",
      preview: "Reminder: complete the engagement survey by Friday.",
      time: "03:30",
      messageType: "message",
      readStatus: "read",
      unreadCount: 0,
      status: "Offline",
      profilePicture: "https://i.pravatar.cc/150?img=18",
    }),
    withVedsuMeta({
      id: "thread-15",
      user_id: "USR-215",
      username: "Miguel Santos",
      label: "Miguel Santos",
      email: "miguel.santos@vedsu.com",
      designation: "Product Owner",
      designation_id: 15,
      department: "Product",
      department_id: 1,
      location: "Austin",
      location_id: 9,
      mobile: "+1 737 555 0215",
      password_hash: "$2a$10$miguelSantosPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 304,
      user_ip: "172.16.0.34",
      last_seen: "2024-11-02T02:50:00Z",
      preview: "Sprint demo deck updated with final slides.",
      time: "02:55",
      messageType: "link",
      readStatus: "sent",
      unreadCount: 2,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=58",
    }),
    withVedsuMeta({
      id: "thread-16",
      user_id: "USR-216",
      username: "Chloe Nguyen",
      label: "Chloe Nguyen",
      email: "chloe.nguyen@vedsu.com",
      designation: "Customer Success Lead",
      designation_id: 16,
      department: "Customer Success",
      department_id: 11,
      location: "Singapore",
      location_id: 12,
      mobile: "+65 8001 0216",
      password_hash: "$2a$10$chloeNguyenPwd",
      user_status: "active",
      selected_user: 1,
      is_verified: 1,
      use_device: 305,
      user_ip: "172.16.0.35",
      last_seen: "2024-11-02T02:05:00Z",
      preview: "Ticket escalation resolved with updated FAQ.",
      time: "02:10",
      messageType: "message",
      readStatus: "delivered",
      unreadCount: 0,
      status: "Away",
      profilePicture: "https://i.pravatar.cc/150?img=5",
    }),
    withVedsuMeta({
      id: "thread-17",
      user_id: "USR-217",
      username: "Dmitri Ivanov",
      label: "Dmitri Ivanov",
      email: "dmitri.ivanov@vedsu.com",
      designation: "Cloud Architect",
      designation_id: 17,
      department: "Infrastructure",
      department_id: 14,
      location: "Berlin",
      location_id: 11,
      mobile: "+49 30 5555 0217",
      password_hash: "$2a$10$dmitriIvanovPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 306,
      user_ip: "172.16.0.36",
      last_seen: "2024-11-02T01:35:00Z",
      preview: "Shared notes from the architecture review call.",
      time: "01:42",
      messageType: "attachment",
      readStatus: "read",
      unreadCount: 0,
      status: "Idle",
      profilePicture: "https://i.pravatar.cc/150?img=66",
    }),
    withVedsuMeta({
      id: "thread-18",
      user_id: "USR-218",
      username: "Zara Ahmed",
      label: "Zara Ahmed",
      email: "zara.ahmed@vedsu.com",
      designation: "Data Scientist",
      designation_id: 18,
      department: "Analytics",
      department_id: 9,
      location: "London",
      location_id: 10,
      mobile: "+44 7700 900318",
      password_hash: "$2a$10$zaraAhmedPwd",
      user_status: "active",
      selected_user: 0,
      is_verified: 1,
      use_device: 307,
      user_ip: "172.16.0.37",
      last_seen: "2024-11-02T01:00:00Z",
      preview: "Model retraining complete. Review the accuracy metrics.",
      time: "01:05",
      messageType: "message",
      readStatus: "unread",
      unreadCount: 4,
      status: "Online",
      profilePicture: "https://i.pravatar.cc/150?img=29",
    }),
  ],
};

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_CREATED_AT = "2024-01-01T00:00:00.000Z";
const DEFAULT_OPERATING_SYSTEM = "Windows";
const DEFAULT_BROWSER = "Chrome";

const LOCATION_INFO_BY_LABEL = {
  bengaluru: {
    label: "Bengaluru Campus",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  pune: {
    label: "Pune Tech Park",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  hyderabad: {
    label: "Hyderabad Studio",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  mumbai: {
    label: "Mumbai Innovation Hub",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  "new delhi": {
    label: "New Delhi Centre",
    city: "New Delhi",
    state: "Delhi",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  kolkata: {
    label: "Kolkata Collaboration Space",
    city: "Kolkata",
    state: "West Bengal",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  chennai: {
    label: "Chennai Secure Ops",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    timezone: "Asia/Kolkata",
  },
  austin: {
    label: "Austin Satellite Office",
    city: "Austin",
    state: "Texas",
    country: "United States",
    timezone: "America/Chicago",
  },
  london: {
    label: "London Customer Hub",
    city: "London",
    state: "England",
    country: "United Kingdom",
    timezone: "Europe/London",
  },
  berlin: {
    label: "Berlin Engineering Lab",
    city: "Berlin",
    state: "Berlin",
    country: "Germany",
    timezone: "Europe/Berlin",
  },
  singapore: {
    label: "Singapore Success Pod",
    city: "Singapore",
    state: "Singapore",
    country: "Singapore",
    timezone: "Asia/Singapore",
  },
  remote: {
    label: "Remote Workspace",
    city: "Remote",
    state: "",
    country: "Global",
    timezone: DEFAULT_TIMEZONE,
  },
};

const normaliseLocationKey = (value = "") => value.trim().toLowerCase();

const getLocationInfo = (label = "") =>
  LOCATION_INFO_BY_LABEL[normaliseLocationKey(label)] ?? null;

const inferTimezone = (thread, locationInfo) =>
  thread?.timezone ?? locationInfo?.timezone ?? DEFAULT_TIMEZONE;

const inferCreatedAt = (thread) =>
  thread?.createdAt ??
  thread?.created_at ??
  thread?.last_seen ??
  DEFAULT_CREATED_AT;

const inferLastMessageTime = (thread) =>
  thread?.last_message_time ??
  thread?.lastMessageTime ??
  thread?.lastMessageAt ??
  thread?.last_seen ??
  DEFAULT_CREATED_AT;

const inferDeviceType = (useDevice) => {
  if (typeof useDevice !== "number") return "Web";
  if (useDevice >= 400) return "Tablet";
  if (useDevice >= 300) return "Mobile";
  return "Desktop";
};

const inferOperatingSystem = (thread, deviceType) =>
  thread?.operating_system ??
  (deviceType === "Mobile"
    ? "Android"
    : deviceType === "Tablet"
      ? "iPadOS"
      : DEFAULT_OPERATING_SYSTEM);

const inferRoleId = (thread) => {
  if (typeof thread?.role_id === "number") return thread.role_id;
  if (thread?.isGlobalMember) return 3;
  return 3;
};

const getProfilePictureUrl = (thread) =>
  thread?.profilePicture ?? thread?.avatar ?? "";

const getActivityStatus = (thread) =>
  thread?.activity_status ?? thread?.status ?? "offline";

const ROLE_LABEL_BY_ID = Object.freeze({
  1: "Super Admin",
  2: "Admin",
  3: "User",
});

const ROLE_BY_EMAIL = Object.freeze({
  "emily.carter@aabhyasa.com": 1,
  "rahul.desai@aabhyasa.com": 2,
  "sara.evans@aabhyasa.com": 2,
  "leo.thompson@aabhyasa.com": 2,
  "isaac.romero@aabhyasa.com": 2,
  "noah.patel@aabhyasa.com": 2,
  "lara.schmidt@globex.com": 1,
});

const normaliseEmail = (value = "") => value.trim().toLowerCase();

const resolveRoleId = (thread) =>
  ROLE_BY_EMAIL[normaliseEmail(thread?.email ?? thread?.username ?? "")] ??
  inferRoleId(thread);

const enrichThreadRecord = (thread) => {
  const locationInfo = getLocationInfo(thread.location);
  const deviceType = thread.device_type ?? inferDeviceType(thread.use_device);
  const role_id = resolveRoleId(thread);

  return {
    ...thread,
    role_id,
    role: thread.role ?? ROLE_LABEL_BY_ID[role_id] ?? ROLE_LABEL_BY_ID[3],
    department: thread.department ?? "General",
    department_id: thread.department_id ?? null,
    created_at: thread.created_at ?? inferCreatedAt(thread),
    timezone: inferTimezone(thread, locationInfo),
    operating_system:
      thread.operating_system ?? inferOperatingSystem(thread, deviceType),
    browser: thread.browser ?? DEFAULT_BROWSER,
    device_type: deviceType,
    activity_status: getActivityStatus(thread),
    is_orange_member: thread.is_orange_member ?? 0,
    profile_picture_url:
      thread.profile_picture_url ?? getProfilePictureUrl(thread),
    last_message: thread.last_message ?? thread.preview ?? "",
    last_message_time: thread.last_message_time ?? inferLastMessageTime(thread),
  };
};

export const mockThreadsByOrg = Object.fromEntries(
  Object.entries(baseMockThreadsByOrg).map(([organizationId, threads]) => [
    organizationId,
    threads.map(enrichThreadRecord),
  ])
);

// Build a flat user directory powering admin tables & pickers.
const buildThreadDirectory = () => {
  let autoId = 1;
  return Object.entries(mockThreadsByOrg).flatMap(([organizationId, threads]) =>
    threads.map((thread) => ({
      id: autoId++,
      organizationId,
      threadId: thread.id,
      user_id: thread.user_id,
      userId: thread.user_id,
      username: thread.username ?? thread.label,
      name: thread.username ?? thread.label,
      label: thread.label ?? thread.username,
      email: thread.email,
      domain_name: thread.domain_name,
      company: thread.company,
      designation: thread.designation ?? "Member",
      designationId: thread.designation_id ?? null,
      role_id: thread.role_id ?? 3,
      role: thread.role ?? ROLE_LABEL_BY_ID[thread.role_id ?? 3],
      department: thread.department ?? "General",
      departmentId: thread.department_id ?? null,
      location: thread.location ?? "Remote",
      locationId: thread.location_id ?? null,
      mobile: thread.mobile ?? "",
      password_hash: thread.password_hash ?? "",
      password: thread.password_hash ?? "",
      user_status: thread.user_status ?? "active",
      global_user: thread.global_user ?? 0,
      selected_user: thread.selected_user ?? 0,
      is_verified: thread.is_verified ?? 0,
      isGlobalMember: thread.isGlobalMember ?? thread.isGlobal ?? thread.is_global ?? false,
      allowedAgentIds: thread.allowedAgentIds ?? [],
      use_device: thread.use_device ?? null,
      user_ip: thread.user_ip ?? "",
      last_seen: thread.last_seen ?? "",
      profilePicture: thread.profilePicture ?? "",
    }))
  );
};

// Canonical flattened directory shared across admin tabs.
export const mockThreads = buildThreadDirectory();

const userIdByEmail = mockThreads.reduce((acc, user) => {
  acc[user.email] = user.id;
  return acc;
}, {});

const resolveUserIds = (emails) =>
  emails.map((email) => userIdByEmail[email]).filter(Boolean);

const defaultChatSnippets = [
  "Touching base on update #%INDEX% — anything blocking from your side?",
  "Captured notes for the workshop deck and shared them in Drive.",
  "All green on my dashboards right now. Let me know if you spot anomalies.",
  "Queued the automation script for tonight's run.",
  "Added screenshots for the issue tracker so QA can reproduce.",
  "Following up on the pending approvals before we close the sprint.",
  "Left comments on the shared doc with the latest metrics.",
  "Quick reminder: we have sync #%INDEX% later this afternoon.",
];

const defaultGroupSnippets = [
  "Deploy window reminder #%INDEX% — please update your checklists.",
  "Error budget looks healthy, but keep an eye on the auth service.",
  "Any objections if we fast-track the hotfix?",
  "Reminder: log post-incident notes before EOD.",
  "UI tweaks merged, confirm if QA passes on your side.",
  "Anyone see spikes in region-us-east?",
  "Creating a follow-up doc for retro item #%INDEX%.",
];

const buildSequentialMessages = ({
  count = 10,
  prefix = "msg",
  startTime = new Date().toISOString(),
  intervalMinutes = 5,
  incomingAuthor,
  outgoingAuthor,
  snippets = defaultChatSnippets,
}) => {
  const start = new Date(startTime);
  const inbound = incomingAuthor ?? { id: "user-demo", name: "Contact" };
  const outbound = outgoingAuthor ?? { id: agentSelfId, name: "You" };
  const pickSnippet = (index, fallback) => {
    const template =
      snippets?.[index % (snippets?.length || 1)] ??
      fallback ??
      defaultChatSnippets[index % defaultChatSnippets.length] ??
      "Update #%INDEX%";
    return template.replace(/%INDEX%/g, String(index + 1));
  };

  const curated = [
    {
      type: "text",
      direction: "incoming",
      status: "read",
      content: {
        text: "Pinning the updated launch checklist so it stays handy for the war room.",
      },
      metadata: {
        isPinned: true,
        pinEvent: {
          action: "pinned",
          actor: inbound.name,
          note: "Launch checklist reference",
        },
      },
    },
    {
      type: "text",
      direction: "outgoing",
      status: "read",
      content: {
        text: "Replying inline with the blocker summary + ETA so everyone sees it on the pinned thread.",
      },
      replyToIndex: 0,
    },
    {
      type: "emoji",
      direction: "incoming",
      status: "delivered",
      content: {
        text: "🚀🔥",
      },
    },
    {
      type: "link",
      direction: "incoming",
      status: "delivered",
      content: {
        url: "https://aabhyasa.notion.site/launch-room",
        title: "Launch Room Dashboard",
        description: "Live view for cutover timeline, rollbacks, and owners.",
      },
      replyToIndex: 1,
    },
    {
      type: "image",
      direction: "outgoing",
      status: "sent",
      files: [
        {
          fileName: "slo-chart.png",
          mimeType: "image/png",
          size: 385433,
          url: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=960&q=80",
          width: 960,
          height: 540,
        },
      ],
      content: {
        url: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=960&q=80",
        caption:
          "SLO delta after the hotfix. Replies welcome if you need raw metrics.",
      },
      replyToIndex: 3,
    },
    {
      type: "file",
      direction: "outgoing",
      status: "sending",
      files: [
        {
          fileName: "ops-handbook.pdf",
          mimeType: "application/pdf",
          size: 2345675,
          url: "https://file-examples.com/storage/fe9bb9/2017/10/file-sample_150kB.pdf",
        },
      ],
      content: {
        fileName: "ops-handbook.pdf",
        caption: "Sharing the annotated ops handbook for the shift hand-off.",
      },
    },
    {
      type: "video",
      direction: "outgoing",
      status: "error",
      files: [
        {
          fileName: "rollout-demo.mp4",
          mimeType: "video/mp4",
          size: 4823456,
          url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
          thumbnail:
            "https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=960&q=80",
          duration: 32,
        },
      ],
      content: {
        url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        fileName: "rollout-demo.mp4",
        caption: "Walkthrough of the fallback toggle.",
        duration: 32,
        thumbnail:
          "https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=960&q=80",
      },
    },
    {
      type: "code",
      direction: "incoming",
      status: "delivered",
      content: {
        code: `const rolloutWindow = {
            start: "18:00 IST",
            end: "21:00 IST",
            guardRails: ["feature_flag", "db_backup", "slo_watch"],
          };

          export const isWithinWindow = (now = new Date()) => {
            const hour = now.getHours();
            return hour >= 18 && hour < 21;
          };`,
        language: "javascript",
        filename: "rollout-window.js",
      },
      metadata: {
        forwarded: true,
        forwardedFrom: "Release Updates Channel",
        isPinned: true,
        pinEvent: {
          action: "pinned",
          actor: inbound.name,
          note: "Launch checklist reference",
        },
      },
    },
    {
      type: "text",
      direction: "outgoing",
      status: "sent",
      content: {
        text: "Unpinning the checklist now that the rollout is signed off.",
      },
      metadata: {
        forwarded: true,
        pinEvent: {
          action: "unpinned",
          actor: outbound.name,
          targetIndex: 0,
        },
      },
    },
    {
      type: "text",
      direction: "incoming",
      status: "delivered",
      content: {
        text: pickSnippet(
          9,
          "Touching base on update #%INDEX% — anything blocking from your side?"
        ),
      },
    },
  ];

  const total = Math.min(Math.max(count, 1), curated.length);
  const trimmed = curated.slice(0, total);

  return trimmed.map((entry, index) => {
    const timestamp = new Date(
      start.getTime() + index * intervalMinutes * 60 * 1000
    ).toISOString();
    const author = entry.direction === "outgoing" ? outbound : inbound;
    const metadata = entry.metadata ? { ...entry.metadata } : {};

    if (typeof entry.replyToIndex === "number" && trimmed[entry.replyToIndex]) {
      const target = trimmed[entry.replyToIndex];
      const targetId = `${prefix}-${entry.replyToIndex + 1}`;
      metadata.replyTo = {
        id: targetId,
        authorName:
          (target.direction === "outgoing" ? outbound : inbound)?.name || "",
        excerpt:
          target.content?.text ||
          target.content?.title ||
          target.content?.caption ||
          target.content?.fileName ||
          target.files?.[0]?.fileName ||
          target.content?.url ||
          "Prior message",
      };
    }

    if (
      metadata.pinEvent &&
      typeof metadata.pinEvent.targetIndex === "number" &&
      trimmed[metadata.pinEvent.targetIndex]
    ) {
      const target = trimmed[metadata.pinEvent.targetIndex];
      metadata.pinEvent = {
        ...metadata.pinEvent,
        targetId: `${prefix}-${metadata.pinEvent.targetIndex + 1}`,
        targetAuthor:
          (target.direction === "outgoing" ? outbound : inbound)?.name || "",
      };
      delete metadata.pinEvent.targetIndex;
    }

    if (metadata.pinEvent && !metadata.pinEvent.actor) {
      metadata.pinEvent.actor = author.name || "Member";
    }

    const cleanedMetadata =
      metadata && Object.keys(metadata).length > 0 ? metadata : undefined;

    return {
      id: `${prefix}-${index + 1}`,
      type: entry.type,
      direction: entry.direction,
      author,
      content: entry.content ? { ...entry.content } : {},
      files: entry.files ? entry.files.map((file) => ({ ...file })) : undefined,
      createdAt: timestamp,
      status:
        entry.status ?? (entry.direction === "outgoing" ? "sent" : "delivered"),
      metadata: cleanedMetadata,
    };
  });
};

const buildGroupChatHistory = ({
  count = 40,
  prefix = "grp-msg",
  startTime = new Date().toISOString(),
  intervalMinutes = 4,
  members = [],
  outgoingAuthor,
  snippets = defaultGroupSnippets,
}) => {
  const start = new Date(startTime);
  return Array.from({ length: count }, (_, index) => {
    const outgoing = index % 4 === 3;
    const member = members[index % members.length] ?? members[0];
    const author = outgoing ? outgoingAuthor : member;
    const textTemplate = snippets[index % snippets.length] ?? "Update #%INDEX%";
    const text = textTemplate.replace(/%INDEX%/g, String(index + 1));
    return {
      id: `${prefix}-${index + 1}`,
      type: "text",
      direction: outgoing ? "outgoing" : "incoming",
      author: {
        id: author.id,
        name: author.name,
        avatar: author.avatar,
        profilePicture: author.profilePicture,
        photo: author.photo,
      },
      content: { text },
      createdAt: new Date(
        start.getTime() + index * intervalMinutes * 60 * 1000
      ).toISOString(),
      status: outgoing ? "sent" : "delivered",
    };
  });
};

export const mockTypingSeeds = [
  {
    threadId: "thread-1",
    participants: [
      {
        id: "USR-001",
        name: "Emily Carter",
        avatar: "https://i.pravatar.cc/150?img=32",
      },
    ],
  },
  {
    threadId: "thread-5",
    participants: [
      {
        id: "USR-005",
        name: "Noah Patel",
        avatar: "https://i.pravatar.cc/150?img=11",
      },
    ],
  },
  {
    threadId: "thread-ops-group",
    participants: [
      {
        id: "USR-002",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      {
        id: "USR-004",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
    ],
  },
  {
    threadId: "thread-13",
    participants: [
      {
        id: "USR-213",
        name: "Arjun Malhotra",
        avatar: "https://i.pravatar.cc/150?img=72",
      },
    ],
  },
];

// Reference list for Departments tab dropdown/grid.
export const mockDepartmentDirectory = [
  { id: 1, name: "Development" },
  { id: 2, name: "Operation" },
  { id: 3, name: "Human Resource" },
  { id: 4, name: "IT Department" },
  { id: 5, name: "Sales Support" },
  { id: 6, name: "Admin" },
  { id: 7, name: "Data Management" },
  { id: 8, name: "Sales & Marketing" },
  { id: 9, name: "Account & Finance" },
  { id: 10, name: "Manager" },
  { id: 11, name: "Research Executive" },
  { id: 12, name: "Content Writer" },
  { id: 13, name: "Sales & Support" },
];

// Reference list for Designations tab dropdown/grid.
export const mockDesignationDirectory = [
  { id: 1, title: "Web Designer", departmentId: 1 },
  { id: 2, title: "Web Developer", departmentId: 1 },
  { id: 3, title: "Sr. Web Developer", departmentId: 1 },
  { id: 4, title: "Development Team Lead", departmentId: 1 },
  { id: 5, title: "Sr. Process Associate", departmentId: 2 },
  { id: 6, title: "Process Associate", departmentId: 2 },
  { id: 7, title: "Operations Team Lead", departmentId: 2 },
  { id: 8, title: "HR Recruiter", departmentId: 3 },
  { id: 9, title: "HR Executive", departmentId: 3 },
  { id: 10, title: "Assistant HR Manager", departmentId: 3 },
  { id: 11, title: "Network Engineer", departmentId: 4 },
  { id: 12, title: "IT Team Leader", departmentId: 4 },
  { id: 13, title: "Sales Support Executive", departmentId: 5 },
  { id: 14, title: "PPC Executive", departmentId: 5 },
  { id: 15, title: "Support Team Leader", departmentId: 5 },
  { id: 16, title: "Assistant General Manager", departmentId: 6 },
  { id: 17, title: "Director", departmentId: 6 },
  { id: 18, title: "Admin Team Leader", departmentId: 6 },
  { id: 19, title: "Sr. Data Analyst", departmentId: 7 },
  { id: 20, title: "Data Analyst", departmentId: 7 },
  { id: 21, title: "Data Process Associate", departmentId: 7 },
  { id: 22, title: "Sr. Email Marketer", departmentId: 8 },
  { id: 23, title: "Email Marketer", departmentId: 8 },
  { id: 24, title: "Digital Marketing Executive", departmentId: 8 },
  { id: 25, title: "Market Research Executive", departmentId: 8 },
  { id: 26, title: "Market Research Analyst", departmentId: 8 },
  { id: 27, title: "Account Executive", departmentId: 8 },
  { id: 28, title: "Sr. Account Executive", departmentId: 9 },
  { id: 29, title: "Assistant Finance Manager", departmentId: 9 },
  { id: 30, title: "Finance Account Executive", departmentId: 9 },
  { id: 31, title: "Assistant Manager", departmentId: 10 },
  { id: 32, title: "Team Leader", departmentId: 10 },
  { id: 33, title: "Research Analyst", departmentId: 11 },
  { id: 34, title: "Senior Research Executive", departmentId: 11 },
  { id: 35, title: "Content Writer", departmentId: 12 },
  { id: 36, title: "Senior Content Writer", departmentId: 12 },
  { id: 37, title: "Sales Support Executive", departmentId: 13 },
  { id: 38, title: "Sales & Support Team Lead", departmentId: 13 },
];

// Reference list for Locations tab dropdown/grid.
export const mockLocationDirectory = [
  {
    id: 1,
    label: "Aabhyasa HQ",
    address: "91 Springboard, MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
  },
  {
    id: 2,
    label: "Pune Tech Park",
    address: "Cluster 4, Hinjewadi Phase 2",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
  },
];

// Seed global members + the internal IDs they may chat with.
export const mockGlobalMembers = [
  {
    id: 1,
    name: "Evelyn Hart",
    email: "evelyn.hart@vedsu.com",
    company: "Vedsu Labs",
    domain: "vedsu.com",
    department: "Customer Success",
    designation: "Director, Customer Success",
    location: "London",
    mobile: "+44 20 5555 0101",
    label: "Vedsu CS",
    globalMember: true,
    avatar: "https://i.pravatar.cc/150?img=15",
    allowedUserIds: resolveUserIds([
      "emily.carter@aabhyasa.com",
      "rahul.desai@aabhyasa.com",
      "sara.evans@aabhyasa.com",
    ]),
  },
  {
    id: 2,
    name: "Carlos Mendez",
    email: "carlos.mendez@northwind.io",
    company: "Northwind Logistics",
    domain: "northwind.io",
    department: "Operations",
    designation: "VP, Operations",
    location: "Austin",
    mobile: "+1 737 555 8920",
    label: "Northwind Ops",
    globalMember: true,
    avatar: "https://i.pravatar.cc/150?img=27",
    allowedUserIds: resolveUserIds([
      "noah.patel@aabhyasa.com",
      "leo.thompson@aabhyasa.com",
    ]),
  },
  {
    id: 3,
    name: "Lara Schmidt",
    email: "lara.schmidt@globex.com",
    company: "Globex Europe",
    domain: "globex.com",
    department: "Partnerships",
    designation: "Head of Partnerships",
    location: "Berlin",
    mobile: "+49 30 5555 7711",
    label: "Globex Partner",
    globalMember: true,
    avatar: "https://i.pravatar.cc/150?img=41",
    allowedUserIds: resolveUserIds([
      "mason.brooks@aabhyasa.com",
      "bianca.flores@aabhyasa.com",
      "isaac.romero@aabhyasa.com",
    ]),
  },
];

// Sample roles table for Admin → Users → Roles tab.
export const mockRolesDirectory = [
  {
    id: 1,
    name: "Emily Carter",
    email: "emily.carter@aabhyasa.com",
    role: "Super Admin",
  },
  {
    id: 2,
    name: "Rahul Desai",
    email: "rahul.desai@aabhyasa.com",
    role: "Admin",
  },
  {
    id: 3,
    name: "Sara Evans",
    email: "sara.evans@aabhyasa.com",
    role: "User",
  },
];

// Sample rows for the Ex-members tab.
export const mockExMembers = [
  {
    id: 1,
    name: "Sonia Iyer",
    email: "sonia.iyer@aabhyasa.com",
    status: "Inactive",
  },
  {
    id: 2,
    name: "Karan Mehta",
    email: "karan.mehta@aabhyasa.com",
    status: "Inactive",
  },
  {
    id: 3,
    name: "Vivian Gray",
    email: "vivian.gray@aabhyasa.com",
    status: "Active",
  },
  {
    id: 4,
    name: "Arjun Khatri",
    email: "arjun.khatri@aabhyasa.com",
    status: "Banned",
  },
  {
    id: 5,
    name: "Nisha Talwar",
    email: "nisha.talwar@aabhyasa.com",
    status: "Inactive",
  },
];

// Conversation history snippets per thread ID.
export const mockMessages = {
  "thread-1": [
    {
      id: "msg-1",
      type: "text",
      direction: "incoming",
      author: { id: "user-emily", name: "Emily Carter" },
      content: {
        text: "Morning! Just posted the release checklist. Can you look at the analytics section?",
      },
      createdAt: "2024-11-04T09:12:00.000Z",
      status: "read",
      metadata: {
        reactions: [
          {
            emoji: "👍",
            users: [
              { id: agentSelfId, name: "You" },
              { id: "user-rahul", name: "Rahul Desai" },
            ],
          },
          {
            emoji: "❤️",
            users: [{ id: "user-emily", name: "Emily Carter" }],
          },
        ],
      },
    },
    {
      id: "msg-2",
      type: "link",
      direction: "incoming",
      author: { id: "user-emily", name: "Emily Carter" },
      content: {
        url: "https://aabhyasa.notion.site/teamchatx-release-plan",
        title: "TeamChatX Release Plan (Notion)",
        description: "Launch checklist, owners and migration notes.",
      },
      createdAt: "2024-11-04T09:13:10.000Z",
      status: "read",
      metadata: {
        forwarded: true,
        forwardedFrom: "Release Updates Channel",
      },
    },
    {
      id: "msg-3",
      type: "text",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        text: "Looks good! I will run the smoke tests once the staging deploy completes.",
      },
      createdAt: "2024-11-04T09:20:45.000Z",
      status: "read",
      metadata: {
        editedAt: "2024-11-04T09:22:00.000Z",
        unsendAvailableUntil: "2024-11-04T09:30:45.000Z",
      },
    },
    {
      id: "msg-4",
      type: "code",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        language: "bash",
        filename: "deploy.sh",
        code: "pnpm install\npnpm run lint\npnpm run build\npnpm run test",
      },
      createdAt: "2024-11-04T09:32:18.000Z",
      status: "delivered",
      metadata: {
        unsendAvailableUntil: "2024-11-04T09:42:18.000Z",
      },
    },
    {
      id: "msg-5",
      type: "image",
      direction: "incoming",
      author: { id: "user-emily", name: "Emily Carter" },
      content: {
        url: "https://images.unsplash.com/photo-1587613863965-43c521bca1b6?auto=format&fit=crop&w=960&q=80",
        fileName: "qa-dashboard.png",
        fileSize: "356 KB",
        caption: "QA run from earlier this morning.",
        width: 960,
        height: 540,
      },
      createdAt: "2024-11-04T09:41:05.000Z",
      status: "delivered",
    },
    {
      id: "msg-6",
      type: "file",
      direction: "incoming",
      author: { id: "user-emily", name: "Emily Carter" },
      content: {
        fileName: "TeamChatX-Metric-Review.pdf",
        mimeType: "application/pdf",
        fileSize: "2.3 MB",
        url: "https://file-examples.com/storage/fe9bb9/2017/10/file-sample_150kB.pdf",
        preview: "Key metrics for the release window.",
      },
      createdAt: "2024-11-04T09:46:10.000Z",
      status: "delivered",
    },
    {
      id: "msg-7",
      type: "video",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        thumbnail:
          "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=960&q=80",
        fileName: "handoff-demo.mp4",
        duration: 32,
        fileSize: "3.8 MB",
      },
      createdAt: "2024-11-04T10:02:22.000Z",
      status: "sent",
      metadata: {
        unsendAvailableUntil: "2024-11-04T10:12:22.000Z",
      },
    },
    {
      id: "msg-7a",
      type: "image",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        url: "../assets/Images/default_wallpaper_main.png",
        thumbnail:
          "../assets/Images/default_wallpaper_main.png",
        fileName: "default_wallpaper_main.png",
        fileSize: "512 KB",
        caption: "Sharing the capture for visual QA.",
        uploadState: "uploading",
        uploadProgress: 0.4,
      },
      createdAt: "2024-11-04T10:03:45.000Z",
      status: "sending",
      metadata: {
        uploadQueued: true,
        uploadProgress: 0.4,
      },
    },
    {
      id: "msg-8",
      type: "text",
      direction: "incoming",
      author: { id: "user-emily", name: "Emily Carter" },
      content: {
        text: "Perfect. I'll sync with marketing and loop you in if we need anything else.",
      },
      createdAt: "2024-11-04T10:08:11.000Z",
      status: "sent",
    },
    ...buildSequentialMessages({
      count: 60,
      prefix: "emily-history",
      startTime: "2024-11-04T10:15:00.000Z",
      intervalMinutes: 6,
      incomingAuthor: { id: "user-emily", name: "Emily Carter" },
      outgoingAuthor: { id: agentSelfId, name: "You" },
    }),
  ],
  "thread-5": [
    {
      id: "msg-1",
      type: "text",
      direction: "incoming",
      author: { id: "user-noah", name: "Noah Patel" },
      content: {
        text: "Morning! Still blocked on the auth API because of the throttling rule.",
      },
      createdAt: "2024-11-02T07:12:17.000Z",
      status: "read",
    },
    {
      id: "msg-2",
      type: "text",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        text: "Understood. Logging a ticket for the platform team to raise the quota by noon.",
      },
      createdAt: "2024-11-02T07:14:00.000Z",
      status: "read",
      metadata: {
        editedAt: "2024-11-02T07:14:45.000Z",
        unsendAvailableUntil: "2024-11-02T07:24:00.000Z",
      },
    },
    {
      id: "msg-3",
      type: "file",
      direction: "incoming",
      author: { id: "user-noah", name: "Noah Patel" },
      content: {
        fileName: "auth-error-logs.zip",
        mimeType: "application/zip",
        fileSize: "1.7 MB",
        url: "https://file-examples.com/storage/fe9bb9/2017/02/zip_5MB.zip",
        preview: "Logs covering the last failing pipeline.",
      },
      createdAt: "2024-11-02T07:17:12.000Z",
      status: "delivered",
    },
    {
      id: "msg-4",
      type: "link",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        url: "https://github.com/Aabhyasa-Development/TeamChatX/pull/42",
        title: "Fix throttling on Auth API",
        description:
          "Pull request to raise the rate limit and add exponential backoff.",
      },
      createdAt: "2024-11-02T07:23:05.000Z",
      status: "delivered",
      metadata: {
        unsendAvailableUntil: "2024-11-02T07:33:05.000Z",
      },
    },
    {
      id: "msg-5",
      type: "code",
      direction: "incoming",
      author: { id: "user-noah", name: "Noah Patel" },
      content: {
        language: "json",
        filename: "request-payload.json",
        code: JSON.stringify(
          {
            email: "qa@teamchatx.com",
            action: "auth_attempt",
            meta: { requestId: "req-490ab" },
          },
          null,
          2
        ),
      },
      createdAt: "2024-11-02T07:28:46.000Z",
      status: "sent",
    },
  ],
  "thread-ops-group": [
    {
      id: "grp-msg-1",
      type: "text",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        text: "Morning squad — patch v3 is live on staging. Need eyes on the session regression before we roll it to prod.",
      },
      createdAt: "2024-11-04T10:54:10.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-2",
      type: "text",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        text: "On it. I will monitor the auth dashboards for the next 30 minutes and drop screenshots if anything spikes.",
      },
      createdAt: "2024-11-04T10:55:32.000Z",
      status: "sent",
      metadata: {
        editedAt: "2024-11-04T10:56:05.000Z",
        unsendAvailableUntil: "2024-11-04T11:05:32.000Z",
      },
    },
    {
      id: "grp-msg-3",
      type: "file",
      direction: "incoming",
      author: {
        id: "user-lia",
        name: "Lia Chen",
        avatar: "https://i.pravatar.cc/150?img=23",
      },
      content: {
        fileName: "release-checklist-v7.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileSize: "482 KB",
        url: "https://file-examples.com/storage/fe9bb9/2017/02/file_example_XLSX_10.xlsx",
        preview: "Section E has the rollback steps refreshed last night.",
      },
      createdAt: "2024-11-04T10:57:33.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-4",
      type: "text",
      direction: "incoming",
      author: {
        id: "user-aria",
        name: "Aria Kapoor",
        avatar: "https://i.pravatar.cc/150?img=5",
      },
      content: {
        text: "Noted. Marketing wants a 20 min heads-up before the change freeze so they can pause nurture flows.",
      },
      createdAt: "2024-11-04T10:59:18.000Z",
      status: "read",
    },
    {
      id: "grp-msg-5",
      type: "link",
      direction: "incoming",
      author: {
        id: "user-leo",
        name: "Leo Thompson",
        avatar: "https://i.pravatar.cc/150?img=17",
      },
      content: {
        url: "https://status.aabhyasa.com/incidents/ops-452",
        title: "Incident OPS-452",
        description: "Live view for the error budget while we rollout.",
      },
      createdAt: "2024-11-04T11:04:02.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-6",
      type: "text",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        text: "Thanks! Lia, acknowledge once the freeze kicks in at 18:00 IST so we can close the checklist.",
      },
      createdAt: "2024-11-04T11:12:00.000Z",
      status: "sent",
    },
    {
      id: "grp-msg-7",
      type: "image",
      direction: "incoming",
      author: {
        id: "user-sofia",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
      content: {
        url: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=960&q=80",
        thumbnail:
          "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=400&q=60",
        fileName: "design-check.png",
        fileSize: "512 KB",
        caption: "Latest layout pass for the incident banner.",
        width: 960,
        height: 640,
      },
      createdAt: "2024-11-04T11:13:30.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-8",
      type: "video",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        thumbnail:
          "https://images.unsplash.com/photo-1516637090014-cb1ab0d08fc7?auto=format&fit=crop&w=960&q=80",
        fileName: "session-regression.mp4",
        duration: 5,
        fileSize: "3.8 MB",
      },
      createdAt: "2024-11-04T11:14:20.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-9",
      type: "audio",
      direction: "incoming",
      author: {
        id: "user-aria",
        name: "Aria Kapoor",
        avatar: "https://i.pravatar.cc/150?img=5",
      },
      content: {
        url: "/sounds/sound1.mp3",
        fileName: "freeze-callout.wav",
        fileSize: "1.2 MB",
        duration: 60,
      },
      createdAt: "2024-11-04T11:15:10.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-10",
      type: "code",
      direction: "incoming",
      author: {
        id: "user-leo",
        name: "Leo Thompson",
        avatar: "https://i.pravatar.cc/150?img=17",
      },
      content: {
        language: "bash",
        filename: "rollback.sh",
        code: "kubectl rollout undo deploy/auth-service\nkubectl rollout status deploy/auth-service",
      },
      createdAt: "2024-11-04T11:16:05.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-11",
      type: "file",
      direction: "incoming",
      author: {
        id: "user-lia",
        name: "Lia Chen",
        avatar: "https://i.pravatar.cc/150?img=23",
      },
      content: {
        fileName: "freeze-runbook.pdf",
        mimeType: "application/pdf",
        fileSize: "2.3 MB",
        url: "https://file-examples.com/storage/fe9bb9/2017/10/file-sample_150kB.pdf",
        preview: "Runbook checklist for the change freeze.",
      },
      createdAt: "2024-11-04T11:17:12.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-12",
      type: "link",
      direction: "incoming",
      author: {
        id: "user-sofia",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
      content: {
        url: "https://status.aabhyasa.com/incidents/ops-452",
        title: "Freeze Tracker Board",
        description: "Live view for freeze readiness and rollback notes.",
      },
      createdAt: "2024-11-04T11:18:02.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-13",
      type: "emoji",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        text: "✅✅",
      },
      createdAt: "2024-11-04T11:18:42.000Z",
      status: "delivered",
    },
    ...buildGroupChatHistory({
      count: 60,
      prefix: "grp-history",
      startTime: "2024-11-04T11:13:00.000Z",
      intervalMinutes: 4,
      members: [
        {
          id: "user-rahul",
          name: "Rahul Desai",
          avatar: "https://i.pravatar.cc/150?img=55",
        },
        {
          id: "user-sofia",
          name: "Sofia Martinez",
          avatar: "https://i.pravatar.cc/150?img=47",
        },
        {
          id: "user-lia",
          name: "Lia Chen",
          avatar: "https://i.pravatar.cc/150?img=23",
        },
        {
          id: "user-leo",
          name: "Leo Thompson",
          avatar: "https://i.pravatar.cc/150?img=17",
        },
        {
          id: "user-aria",
          name: "Aria Kapoor",
          avatar: "https://i.pravatar.cc/150?img=5",
        },
      ],
      outgoingAuthor: { id: agentSelfId, name: "You" },
    }),
    {
      id: "grp-msg-14",
      type: "image",
      direction: "incoming",
      author: {
        id: "user-sofia",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
      content: {
        url: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=960&q=80",
        thumbnail:
          "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=400&q=60",
        fileName: "ui-snapshot.png",
        fileSize: "640 KB",
        caption: "Post-freeze UI snapshot.",
        width: 960,
        height: 640,
      },
      createdAt: "2024-11-04T15:20:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-15",
      type: "video",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
        thumbnail:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=960&q=80",
        fileName: "deploy-clip.mp4",
        duration: 5,
        fileSize: "3.8 MB",
      },
      createdAt: "2024-11-04T15:21:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-16",
      type: "audio",
      direction: "incoming",
      author: {
        id: "user-aria",
        name: "Aria Kapoor",
        avatar: "https://i.pravatar.cc/150?img=5",
      },
      content: {
        url: "/sounds/sound1.mp3",
        fileName: "status-call.wav",
        fileSize: "1.2 MB",
        duration: 60,
      },
      createdAt: "2024-11-04T15:22:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-17",
      type: "code",
      direction: "incoming",
      author: {
        id: "user-leo",
        name: "Leo Thompson",
        avatar: "https://i.pravatar.cc/150?img=17",
      },
      content: {
        language: "bash",
        filename: "ops-check.sh",
        code: "curl -s https://status.aabhyasa.com/health\nkubectl get pods -n prod",
      },
      createdAt: "2024-11-04T15:23:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-18",
      type: "file",
      direction: "incoming",
      author: {
        id: "user-lia",
        name: "Lia Chen",
        avatar: "https://i.pravatar.cc/150?img=23",
      },
      content: {
        fileName: "release-notes.pdf",
        mimeType: "application/pdf",
        fileSize: "2.3 MB",
        url: "https://file-examples.com/storage/fe9bb9/2017/10/file-sample_150kB.pdf",
        preview: "Consolidated release notes for ops.",
      },
      createdAt: "2024-11-04T15:24:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-19",
      type: "link",
      direction: "incoming",
      author: {
        id: "user-sofia",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
      content: {
        url: "https://status.aabhyasa.com/incidents/ops-452",
        title: "Freeze Status Board",
        description: "Live updates and owner checklist.",
      },
      createdAt: "2024-11-04T15:25:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-20",
      type: "emoji",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        text: "🔥✅",
      },
      createdAt: "2024-11-04T15:26:00.000Z",
      status: "delivered",
    },
    {
      id: "grp-msg-21",
      type: "poll",
      direction: "outgoing",
      author: { id: agentSelfId, name: "You" },
      content: {
        question: "Which initiative should we prioritize next sprint?",
        type: "single",
        options: [
          {
            id: "opt-1",
            label: "Auth hardening",
            votes: 4,
            voters: [
              {
                id: "user-rahul",
                name: "Rahul Desai",
                avatar: "https://i.pravatar.cc/150?img=55",
              },
              {
                id: "user-lia",
                name: "Lia Chen",
                avatar: "https://i.pravatar.cc/150?img=23",
              },
            ],
          },
          {
            id: "opt-2",
            label: "Notification overhaul",
            votes: 3,
            voters: [
              {
                id: "user-sofia",
                name: "Sofia Martinez",
                avatar: "https://i.pravatar.cc/150?img=47",
              },
            ],
          },
          {
            id: "opt-3",
            label: "Ops dashboard refresh",
            votes: 5,
            voters: [
              {
                id: "user-aria",
                name: "Aria Kapoor",
                avatar: "https://i.pravatar.cc/150?img=5",
              },
              {
                id: "user-leo",
                name: "Leo Thompson",
                avatar: "https://i.pravatar.cc/150?img=17",
              },
            ],
          },
        ],
        endAt: "2024-11-04T18:00:00.000Z",
        createdBy: { id: agentSelfId, name: "You" },
        endAccess: "creator-or-admin",
        showResultsBeforeVote: true,
        totalVotes: 12,
        voterAvatars: [
          "https://i.pravatar.cc/150?img=55",
          "https://i.pravatar.cc/150?img=47",
          "https://i.pravatar.cc/150?img=23",
        ],
      },
      createdAt: "2024-11-04T15:28:00.000Z",
      status: "sent",
      metadata: { viewerRole: "admin" },
    },
    {
      id: "grp-msg-22",
      type: "poll",
      direction: "incoming",
      author: {
        id: "user-sofia",
        name: "Sofia Martinez",
        avatar: "https://i.pravatar.cc/150?img=47",
      },
      content: {
        question: "Which release note format works best?",
        type: "multiple",
        options: [
          {
            id: "opt-a",
            label: "Short bullets",
            votes: 6,
            voters: [
              {
                id: "user-rahul",
                name: "Rahul Desai",
                avatar: "https://i.pravatar.cc/150?img=55",
              },
              {
                id: "user-aria",
                name: "Aria Kapoor",
                avatar: "https://i.pravatar.cc/150?img=5",
              },
            ],
          },
          {
            id: "opt-b",
            label: "Detailed sections",
            votes: 4,
            voters: [
              {
                id: "user-lia",
                name: "Lia Chen",
                avatar: "https://i.pravatar.cc/150?img=23",
              },
            ],
          },
          {
            id: "opt-c",
            label: "Changelog table",
            votes: 3,
            voters: [
              {
                id: "user-leo",
                name: "Leo Thompson",
                avatar: "https://i.pravatar.cc/150?img=17",
              },
            ],
          },
        ],
        createdBy: {
          id: "user-sofia",
          name: "Sofia Martinez",
          avatar: "https://i.pravatar.cc/150?img=47",
        },
        endAccess: "creator-or-admin",
        showResultsBeforeVote: false,
        voterAvatars: [
          "https://i.pravatar.cc/150?img=55",
          "https://i.pravatar.cc/150?img=5",
          "https://i.pravatar.cc/150?img=23",
        ],
      },
      createdAt: "2024-11-04T15:35:00.000Z",
      status: "delivered",
      metadata: { viewerRole: "member" },
    },
    {
      id: "grp-msg-23",
      type: "poll",
      direction: "incoming",
      author: {
        id: "user-rahul",
        name: "Rahul Desai",
        avatar: "https://i.pravatar.cc/150?img=55",
      },
      content: {
        question: "Which on-call checklist update matters most?",
        type: "multiple",
        options: [
          {
            id: "rank-1",
            label: "Escalation steps clarity",
            votes: 4,
            voters: [
              {
                id: "user-rahul",
                name: "Rahul Desai",
                avatar: "https://i.pravatar.cc/150?img=55",
              },
            ],
          },
          {
            id: "rank-2",
            label: "Incident triage flow",
            votes: 3,
            voters: [
              {
                id: "user-aria",
                name: "Aria Kapoor",
                avatar: "https://i.pravatar.cc/150?img=5",
              },
            ],
          },
          {
            id: "rank-3",
            label: "Runbook quick links",
            votes: 2,
            voters: [
              {
                id: "user-leo",
                name: "Leo Thompson",
                avatar: "https://i.pravatar.cc/150?img=17",
              },
            ],
          },
          {
            id: "rank-4",
            label: "Shift handoff checklist",
            votes: 1,
            voters: [
              {
                id: "user-lia",
                name: "Lia Chen",
                avatar: "https://i.pravatar.cc/150?img=23",
              },
            ],
          },
        ],
        createdBy: {
          id: "user-rahul",
          name: "Rahul Desai",
          avatar: "https://i.pravatar.cc/150?img=55",
        },
        endAccess: "creator-or-admin",
        showResultsBeforeVote: true,
        voterAvatars: [
          "https://i.pravatar.cc/150?img=17",
          "https://i.pravatar.cc/150?img=23",
        ],
      },
      createdAt: "2024-11-04T15:40:00.000Z",
      status: "delivered",
      metadata: { viewerRole: "member" },
    },
    {
      id: "grp-event-1",
      type: "system",
      createdAt: "2024-11-04T15:45:00.000Z",
      metadata: {
        event: {
          action: "member_added",
          actor: { name: "Rahul Desai" },
          targets: [{ name: "Ava Nair" }],
        },
      },
    },
    {
      id: "grp-event-2",
      type: "system",
      createdAt: "2024-11-04T15:47:00.000Z",
      metadata: {
        event: {
          action: "member_removed",
          actor: { name: "Rahul Desai" },
          targets: [{ name: "Ava Nair" }],
        },
      },
    },
  ],
  "thread-13": [
    {
      id: "msg-1",
      type: "text",
      direction: "incoming",
      author: { id: "user-arjun", name: "Arjun Malhotra" },
      content: {
        text: "Sales deck draft looks great. Can you review the pricing slide?",
      },
      createdAt: "2024-11-01T12:10:18.000Z",
      status: "read",
    },
    {
      id: "msg-2",
      type: "file",
      direction: "incoming",
      author: { id: "user-arjun", name: "Arjun Malhotra" },
      content: {
        fileName: "Vedsu-Q4-Pricing.pptx",
        mimeType: "application/vnd.ms-powerpoint",
        fileSize: "4.8 MB",
        url: "https://file-examples.com/storage/fe9bb9/2017/08/file_example_PPT_500kB.ppt",
        preview: "Slide 7 has the updated bundle pricing.",
      },
      createdAt: "2024-11-01T12:11:45.000Z",
      status: "delivered",
    },
    {
      id: "msg-3",
      type: "text",
      direction: "outgoing",
      author: { id: "agent-self", name: "You" },
      content: {
        text: "On it. I'll leave comments by 2 PM.",
      },
      createdAt: "2024-11-01T12:12:22.000Z",
      status: "sent",
      metadata: {
        unsendAvailableUntil: "2024-11-01T12:22:22.000Z",
      },
    },
  ],
};

// Fallback copy for empty states.
export const placeholderMessage = "Static placeholder content";

// Default export retained for any default-import consumers.
export default {
  appBrandingAssets,
  mockOrganizations,
  mockThreadsByOrg,
  mockThreads,
  agentSelfId,
  mockDepartmentDirectory,
  mockDesignationDirectory,
  mockLocationDirectory,
  mockGlobalMembers,
  mockRolesDirectory,
  mockExMembers,
  mockMessages,
  mockTypingSeeds,
  placeholderMessage,
};
