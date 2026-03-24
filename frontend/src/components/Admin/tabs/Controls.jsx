import { useState } from "react";
import {
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import { HiOutlineChevronRight } from "react-icons/hi";

import { PANEL_MIN_HEIGHT, sectionMetadata } from "./controls/config";
import GlobalMembersPanel from "./controls/GlobalMembersPanel";
import IndicatorsPanel from "./controls/IndicatorsPanel";
import StatusPanel from "./controls/StatusPanel";
import RecallPanel from "./controls/RecallPanel";
import EditPanel from "./controls/EditPanel";
import AccessPanel from "./controls/AccessPanel";
import MessageInfoPanel from "./controls/MessageInfoPanel";
import DeletePanel from "./controls/DeletePanel";
import MessageMenuPanel from "./controls/MessageMenuPanel";

// Each panel is self-contained: loads & saves its own data via API.
const sectionComponents = {
  globalMembers: GlobalMembersPanel,
  indicators: IndicatorsPanel,
  status: StatusPanel,
  recall: RecallPanel,
  edit: EditPanel,
  access: AccessPanel,
  messageInfo: MessageInfoPanel,
  delete: DeletePanel,
  messageMenu: MessageMenuPanel,
};

const Controls = () => {
  const theme = useTheme();
  const [activeSection, setActiveSection] = useState(sectionMetadata[0].id);

  const ActivePanel = sectionComponents[activeSection];

  return (
    <Grid container spacing={2} p={1}>
      <Grid item xs={12} md={4} flex={1 / 3}>
        <Paper
          square
          elevation={0}
          sx={{ border: "1px solid", borderColor: "divider", minHeight: PANEL_MIN_HEIGHT }}
        >
          <List disablePadding>
            {sectionMetadata.map((section, index) => (
              <ListItemButton
                key={section.id}
                selected={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
                sx={{
                  borderBottom: index === sectionMetadata.length - 1 ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <ListItemText
                  primary={section.title}
                  primaryTypographyProps={{
                    fontWeight: activeSection === section.id ? 500 : 400,
                    color:
                      activeSection === section.id
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                  }}
                />
                <HiOutlineChevronRight
                  color={
                    activeSection === section.id
                      ? theme.palette.primary.main
                      : theme.palette.text.primary
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8} flex={1}>
        <Paper
          square
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            p: 3,
            minHeight: PANEL_MIN_HEIGHT,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {ActivePanel ? (
            <ActivePanel />
          ) : (
            <Typography color="text.secondary">No configuration available.</Typography>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Controls;
