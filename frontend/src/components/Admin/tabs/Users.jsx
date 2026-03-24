import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  Paper,
  Stack,
  Tab,
  Tabs,
  useTheme,
} from "@mui/material";
import AddUserForm from "../forms/AddUserForm";
import UsersListSection from "./users/UsersListSection";
import GlobalMembersSection from "./users/GlobalMembersSection";
import DesignationSection from "./users/DesignationSection";
import DepartmentSection from "./users/DepartmentSection";
import LocationsSection from "./users/LocationsSection";
import ExMembersSection from "./users/ExMembersSection";
import RolesSection from "./users/RolesSection";

const userTabs = [
  "Users",
  "Global Members",
  "Designation",
  "Department",
  "Locations",
  "Ex-Members",
  "Roles",
];

const Users = ({ adminData, initialTab = "Users" }) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(userTabs[0]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const users = adminData?.users || [];
  const globalMembers = adminData?.globalMembers || [];
  const exMembers = adminData?.exMembers || [];
  const departments = adminData?.departments || [];
  const designations = adminData?.designations || [];
  const locations = adminData?.locations || [];
  const roles = adminData?.roles || [];
  const organizationCustomDomain =
    String(adminData?.organizationSummary?.organization?.custom_domain || "").trim();
  const maxUsers = Number(adminData?.organizationSummary?.current_plan?.max_users || 0);
  const activeUsers = Number(adminData?.organizationSummary?.counts?.active_members || 0);
  const refreshForce = async () => {
    if (typeof adminData?.refresh === "function") {
      await adminData.refresh({ force: true });
    }
  };

  const tabItems = useMemo(() => userTabs, []);

  useEffect(() => {
    if (tabItems.includes(initialTab)) {
      setCurrentTab(initialTab);
    }
  }, [initialTab, tabItems]);

  const renderContent = () => {
    switch (currentTab) {
      case "Users":
        return (
          <UsersListSection
            users={users}
            onAddUser={() => setAddUserOpen(true)}
            onUsersChanged={refreshForce}
            departments={departments}
            designations={designations}
            locations={locations}
            roles={roles}
            organizationCustomDomain={organizationCustomDomain}
            maxUsers={maxUsers}
            activeUsers={activeUsers}
          />
        );
      case "Global Members":
        return (
          <GlobalMembersSection
            users={users}
            globalMembers={globalMembers}
            onUsersChanged={refreshForce}
            departments={departments}
            designations={designations}
            locations={locations}
            roles={roles}
          />
        );
      case "Designation":
        return (
          <DesignationSection
            designations={designations}
            departments={departments}
            onDesignationsChanged={refreshForce}
          />
        );
      case "Department":
        return (
          <DepartmentSection
            departments={departments}
            onDepartmentsChanged={refreshForce}
          />
        );
      case "Locations":
        return (
          <LocationsSection
            locations={locations}
            onLocationsChanged={refreshForce}
          />
        );
      case "Ex-Members":
        return (
          <ExMembersSection
            users={exMembers}
            onUsersChanged={refreshForce}
          />
        );
      case "Roles":
        return (
          <RolesSection
            users={users}
            roles={roles}
            onUsersChanged={refreshForce}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Stack spacing={1}>
      <Paper
        elevation={0}
        sx={{ borderRadius:1, border: "1px solid", borderColor: "divider",paddingX: "4px", }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          variant="scrollable"
          TabIndicatorProps={{
            sx: {
              height: 2,
              borderRadius: 3,
              
              backgroundColor: theme.palette.primary.main,
            },
          }}
          sx={{ minHeight: 50 }}
        >
          {tabItems.map((tab) => (
            <Tab key={tab} label={tab} value={tab} disableRipple />
          ))}
        </Tabs>
      </Paper>

      {renderContent()}

      <Dialog
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent
          dividers
          sx={{ backgroundColor: theme.palette.background.default }}
        >
          <AddUserForm
            departments={departments}
            designations={designations}
            locations={locations}
            roles={roles}
            organizationCustomDomain={organizationCustomDomain}
            maxUsers={maxUsers}
            activeUsers={activeUsers}
            onSuccess={() => {
              setAddUserOpen(false);
              void refreshForce();
            }}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default Users;
