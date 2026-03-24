import { Box, Button, Stack, Typography, useTheme } from "@mui/material";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FaGlobe, FaHome } from "react-icons/fa";

const OrganizationTabsComponent = ({
  organizations = [],
  activeOrganizationId,
  onChange,
}) => {
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  const theme = useTheme();
  const scrollRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [isDragging, setIsDragging] = useState(false);

  const isScrollable = organizations.length > 2;
  const firstOrganizationId = organizations[0]?.id ?? null;

  const handlePointerDown = useCallback(
    (event) => {
      if (!isScrollable || !scrollRef.current) return;
      const pageX =
        "touches" in event ? event.touches[0]?.pageX ?? 0 : event.pageX;
      dragStateRef.current = {
        active: true,
        startX: pageX,
        scrollLeft: scrollRef.current.scrollLeft,
        moved: false,
      };
      setIsDragging(true);
    },
    [isScrollable]
  );

  const handlePointerMove = useCallback((event) => {
    if (!dragStateRef.current.active || !scrollRef.current) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    const pageX =
      "touches" in event ? event.touches[0]?.pageX ?? 0 : event.pageX;
    const { startX, scrollLeft } = dragStateRef.current;
    const delta = pageX - startX;
    scrollRef.current.scrollLeft = scrollLeft - delta;
    if (!dragStateRef.current.moved && Math.abs(delta) > 3) {
      dragStateRef.current.moved = true;
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    dragStateRef.current.moved = false;
    setIsDragging(false);
  }, []);

  const items = useMemo(
    () =>
      organizations.map((organization) => {
        const isActive = organization.id === activeOrganizationId;
        const isHome = organization.id === firstOrganizationId;
        const unreadCount = organization.unreadCount ?? 0;

        return {
          organization,
          isActive,
          isHome,
          unreadCount,
        };
      }),
    [organizations, activeOrganizationId, firstOrganizationId]
  );

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pt: 1, pb: 2 }}>
      <Box
        ref={scrollRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseLeave={endDrag}
        onMouseUp={endDrag}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        sx={{
          overflowX: isScrollable ? "auto" : "visible",
          maxWidth: "100%",
          cursor: isScrollable ? (isDragging ? "grabbing" : "grab") : "default",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          px: 0.5,
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{
            minWidth: 0,
            flexWrap: "nowrap",
          }}
        >
          {items.map(({ organization, isActive, isHome, unreadCount }) => {
            const handleClick = () => {
              if (dragStateRef.current.moved) {
                return;
              }
              onChange?.(organization.id);
            };

          return (
            <Button
              key={organization.id}
              onClick={handleClick}
              variant={isActive ? "contained" : "outlined"}
              color={isActive ? "primary" : "inherit"}
              sx={{
                position: "relative",
                px: 1.25,
                py: 1,
                borderRadius: 0.75,
                maxWidth: isScrollable ? 100 : "none",
                flex: isScrollable ? "0 0 auto" : 1,
                justifyContent: "space-between",
                gap: 1,
                minWidth: isScrollable ? 140 : 0,
                borderColor: !isActive
                  ? theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.28)"
                    : theme.palette.divider
                  : undefined,
                "&:hover": {
                  borderColor: !isActive
                    ? theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.32)"
                      : theme.palette.divider
                    : undefined,
                },
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ minWidth: 0, flexGrow: 1 }}
              >
                {isHome ? (
                  <FaHome
                    size={16}
                    color={isActive ? "#fff" : theme.palette.text.primary}
                    style={{ flexShrink: "0" }}
                  />
                ) : (
                  <FaGlobe
                    size={16}
                    color={isActive ? "#fff" : theme.palette.text.primary}
                    style={{ flexShrink: "0" }}
                  />
                )}
                <Typography
                  variant="body2"
                  color={isActive ? "white" : theme.palette.text.primary}
                  sx={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textTransform: "none",
                  }}
                >
                  {organization.label}
                </Typography>
              </Stack>
              {unreadCount > 0 ? (
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 18,
                    height: 18,
                    px: 0.75,
                    borderRadius: 999,
                    bgcolor: "#f44336",
                    color: "#fff",
                    fontSize: "0.6rem",
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </Box>
              ) : null}
            </Button>
          );
          })}
        </Stack>
      </Box>
    </Box>
  );
};

const arePropsEqual = (prevProps, nextProps) => {
  if (prevProps.activeOrganizationId !== nextProps.activeOrganizationId) {
    return false;
  }
  const prevOrgs = prevProps.organizations ?? [];
  const nextOrgs = nextProps.organizations ?? [];
  if (prevOrgs.length !== nextOrgs.length) {
    return false;
  }
  for (let index = 0; index < prevOrgs.length; index += 1) {
    const prevOrg = prevOrgs[index];
    const nextOrg = nextOrgs[index];
    if (
      prevOrg?.id !== nextOrg?.id ||
      prevOrg?.label !== nextOrg?.label ||
      (prevOrg?.unreadCount ?? 0) !== (nextOrg?.unreadCount ?? 0)
    ) {
      return false;
    }
  }
  return prevProps.onChange === nextProps.onChange;
};

export default React.memo(OrganizationTabsComponent, arePropsEqual);
