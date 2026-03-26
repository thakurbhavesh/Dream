import React, { useEffect, useState } from "react";
import { PiChatsCircle, PiSparkle, PiUserGear } from "react-icons/pi";
import {
  Box,
  Divider,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  Badge,
} from "@mui/material";
import useSettings from "../../hooks/useSettings";
import MaterialUISwitch from "../../components/ThemeSwitch";
import ToggleButton from "../../components/settings/drawer/ToggleButton.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import SettingsDrawer from "../../components/settings/drawer/index.jsx";
import { MdOutlineDashboardCustomize } from "react-icons/md";
import useMascot from "../../hooks/useMascot";
import useCurrentUser from "../../hooks/useCurrentUser";

const Nav_Buttons = [
  {
    index: 0,
    icon: <PiChatsCircle size={20} />,
    title: "Chats",
  },
  // {
  //   index: 1,
  //   icon: <PiScreencast />,
  //   title: "Screen Share",
  // },
  // {
  //   index: 2,
  //   icon: <FiPhone />,
  //   title: "Call",
  // },
];

const getPath = (index) => {
  switch (index) {
    case 0:
      return "/app";
    case 1:
      return "/app/screenShare";
    case 2:
      return "/app/call";
    case 3:
      return "/app/settings";
    case 4:
      return "/app/admin";
    default:
      return "/app";
  }
};

const SideBar = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { themeMode, onToggleMode } = useSettings();

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Sync sidebar icon when assistant closes itself (via X button)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.open === false) setAssistantOpen(false);
    };
    window.addEventListener("teamchatx:assistant", handler);
    return () => window.removeEventListener("teamchatx:assistant", handler);
  }, []);
  const [unreadCount, setUnreadCount] = useState(0); // State for unread message count
  const mascotSrc = useMascot();
  const currentUser = useCurrentUser();
  const role = Number(currentUser?.role || 3);

  const handleToggle = () => {
    setToggleOpen((prev) => !prev);
  };

  useEffect(() => {
    if (toggleOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [toggleOpen]);

  // Fetch role, selected tab, and unread message count on mount
  useEffect(() => {
    const savedTab = localStorage.getItem("selectedTab");
    const pathname = location?.pathname || "";
    const resolveIndexFromPath = () => {
      if (pathname.startsWith("/app/settings")) return 3;
      if (pathname.startsWith("/app/admin")) return 4;
      if (pathname.startsWith("/app")) return 0;
      return null;
    };
    const pathIndex = resolveIndexFromPath();
    if (pathIndex !== null) {
      setSelected(pathIndex);
      localStorage.setItem("selectedTab", String(pathIndex));
    } else if (savedTab !== null) {
      const index = parseInt(savedTab);
      setSelected(index);
      navigate(getPath(index));
    } else {
      setSelected(0);
    }
    setLoading(false);
  }, [navigate, location?.pathname]);

  const handleChangeTab = (index) => {
    setSelected(index);
    localStorage.setItem("selectedTab", index);
    navigate(getPath(index));
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <Box
      py={2}
      px={0}
      sx={{
        backgroundColor: theme.palette.background.default,
        height: "auto",
        width: 80,
        boxShadow: "inset -1px 0px 0px rgba(0, 0, 0, 0.15)",
      }}
    >
      <Stack
        direction="column"
        alignItems={"center"}
        sx={{ height: "100%", width: 80 }}
        spacing={3}
        justifyContent={"space-between"}
      >
        <Stack alignItems={"center"} spacing={2}>
          <Box
            sx={{
              height: "30px",
              minHeight: "30px",
              maxHeight: "100%",
              width: "90%",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                themeMode === "dark"
                  ? "rgba(255, 255, 255, 0.8)"
                  : "",
              boxShadow:
                themeMode === "dark"
                  ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12)"
                  : "",
              padding: "4px",
              flex: 1,
              overflow: "hidden"
            }}
          >
            <img
              src={mascotSrc}
              alt={"TeamChatX"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </Box>
          {/* <Divider
            sx={{
              width: "48px",
              bgcolor: theme.palette.mode === "light" ? "#666" : "#ddd",
            }}
          /> */}
          <Stack
            spacing={2}
            direction="column"
            alignItems={"center"}
            sx={{ width: "max-content" }}
          >
            {Nav_Buttons.map((el) =>
              el.index === selected ? (
                <Box
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: 1,
                    height: 45,
                    width: 45,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  key={el.index}
                >
                  <IconButton
                    onClick={() => handleChangeTab(el.index)}
                    sx={{ width: "max-content", color: "#fff" }}
                  >
                    {el.icon}
                  </IconButton>
                </Box>
              ) : (
                <Tooltip title={el.title} placement="right" key={el.index}>
                  <Badge
                    badgeContent={el.index === 0 ? unreadCount : 0} // Show unread count on the first button (e.g., chat)
                    color="primary"
                    max={9}
                  >
                    <IconButton
                      onClick={() => handleChangeTab(el.index)}
                      sx={{
                        width: "max-content",
                        color:
                          theme.palette.mode === "light"
                            ? "#000"
                            : theme.palette.text.primary,
                      }}
                    >
                      {el.icon}
                    </IconButton>
                  </Badge>
                </Tooltip>
              )
            )}
            <Divider sx={{ width: "48px" }} />
            {role !== 4 &&
              (selected === 4 ? (
                <Box
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: 1,
                    height: 45,
                    width: 45,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <IconButton sx={{ width: "max-content", color: "#fff" }}>
                    <MdOutlineDashboardCustomize />
                  </IconButton>
                </Box>
              ) : (
                <Tooltip title="Admin" placement="right">
                  <IconButton
                    onClick={() => handleChangeTab(4)}
                    sx={{
                      width: "max-content",
                      color:
                        theme.palette.mode === "light"
                          ? "#000"
                          : theme.palette.text.primary,
                    }}
                  >
                    <MdOutlineDashboardCustomize />
                  </IconButton>
                </Tooltip>
              ))}
          </Stack>
        </Stack>

        <Stack alignItems={"center"} spacing={2.5}>
          <Tooltip title="AI Assistant" placement="right">
            <Box
              sx={{
                borderRadius: "50%",
                position: "relative",
                ...(assistantOpen && {
                  backgroundColor: theme.palette.primary.main,
                }),
              }}
            >
              <IconButton
                onClick={() => {
                  const next = !assistantOpen;
                  setAssistantOpen(next);
                  window.dispatchEvent(new CustomEvent("teamchatx:assistant", { detail: { open: next } }));
                }}
                sx={{
                  color: assistantOpen ? "#fff" : theme.palette.mode === "light" ? "#000" : theme.palette.text.primary,
                  transition: "all 0.3s ease",
                  ...(assistantOpen && {
                    animation: "sidebar-lamp-active 2s ease-in-out infinite",
                    "@keyframes sidebar-lamp-active": {
                      "0%, 100%": { filter: "drop-shadow(0 0 4px rgba(251,191,36,0.4))" },
                      "50%": { filter: "drop-shadow(0 0 10px rgba(251,191,36,0.7))" },
                    },
                  }),
                }}
              >
                <PiSparkle size={20} />
              </IconButton>
              {/* Golden lamp glow ring when opening */}
              {assistantOpen && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: -4,
                    borderRadius: "50%",
                    border: "2px solid rgba(251,191,36,0.5)",
                    animation: "sidebar-glow-ring 1s ease-out forwards",
                    "@keyframes sidebar-glow-ring": {
                      "0%": { transform: "scale(0.5)", opacity: 1, borderColor: "rgba(251,191,36,0.8)" },
                      "50%": { transform: "scale(1.3)", opacity: 0.6 },
                      "100%": { transform: "scale(1.6)", opacity: 0, borderColor: "rgba(139,92,246,0)" },
                    },
                    pointerEvents: "none",
                  }}
                />
              )}
            </Box>
          </Tooltip>
          <ToggleButton
            notDefault={true}
            open={toggleOpen}
            onToggle={handleToggle}
          />
          <SettingsDrawer open={toggleOpen} setOpen={setToggleOpen} />
          <Tooltip title="Profile" placement="right">
            {selected === 3 ? (
              <Box
                sx={{
                  borderRadius: "50%",
                  border: selected ? "#fff": `1px solid ${theme.palette.primary.main}`,
                  backgroundColor: theme.palette.primary.main,
                }}
              >
                <IconButton
                  id="profile-button"
                  onClick={() => handleChangeTab(3)}
                  sx={{
                    color: selected ? "#fff": theme.palette.primary.main,
                  }}
                >
                  <PiUserGear size={20} />
                </IconButton>
              </Box>
            ) : (
              <IconButton
                id="profile-button"
                onClick={() => handleChangeTab(3)}
                sx={{
                  width: "max-content",
                  color:
                    theme.palette.mode === "light"
                      ? "#000"
                      : theme.palette.text.primary,
                  borderRadius: "50%",
                  border:
                    theme.palette.mode === "light"
                      ? "1px solid #000"
                      : "1px solid #ddd",
                }}
              >
                <PiUserGear size={18} />
              </IconButton>
            )}
          </Tooltip>
          <MaterialUISwitch
            checked={themeMode === "dark"}
            onChange={() => {
              onToggleMode();
            }}
          />
        </Stack>
      </Stack>
    </Box>
  );
};

export default SideBar;
