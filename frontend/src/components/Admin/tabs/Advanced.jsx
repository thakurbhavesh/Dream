import { useState } from "react";
import { Box, Button, Grid, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import awsConfig from "../config/awsConfig";
import Track from "../sections/Track";
import UserActivity from "../sections/UserActivity";

const advancedTabs = ["Chat", "AWS S3 Data", "Track Server", "User Activity"];

const ChatPanel = () => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
    <Stack spacing={2}>
      <Typography variant="h6" color="primary">
        Chat Interface
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField select fullWidth label="Select Sender" SelectProps={{ native: true }}>
            <option value="">Select</option>
            <option value="1">Rahul</option>
            <option value="2">Emily</option>
          </TextField>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField select fullWidth label="Select Receiver" SelectProps={{ native: true }}>
            <option value="">Select</option>
            <option value="1">Product</option>
            <option value="2">Support</option>
          </TextField>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1} alignItems="center" height="100%">
            <Button variant="contained">Load Chat</Button>
            <Button variant="outlined">Export Chat</Button>
          </Stack>
        </Grid>
      </Grid>
      <TextField fullWidth placeholder="Search Messages" InputProps={{ startAdornment: <Box component="span" sx={{ mr: 1 }}>??</Box> }} />
      <Paper elevation={0} sx={{ p: 4, border: "1px dashed", borderColor: "divider", borderRadius: 3, textAlign: "center", minHeight: 260 }}>
        <Typography color="text.secondary">No messages found</Typography>
      </Paper>
    </Stack>
  </Paper>
);

const AwsPanel = () => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
    <Typography variant="h6" gutterBottom>
      AWS S3 Data
    </Typography>
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" gutterBottom>
            Buckets
          </Typography>
          <Stack spacing={1}>
            {awsConfig.buckets.map((bucket) => (
              <Box key={bucket.name}>
                <Typography fontWeight={600}>{bucket.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Lifecycle: {bucket.lifecycle}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" gutterBottom>
            IAM Roles
          </Typography>
          <Stack spacing={1}>
            {awsConfig.iamRoles.map((role) => (
              <Box key={role.name}>
                <Typography fontWeight={600}>{role.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.permissions.join(", ")}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  </Paper>
);

const Advanced = () => {
  const [currentTab, setCurrentTab] = useState(advancedTabs[0]);

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Tabs
          value={currentTab}
          onChange={(_, value) => setCurrentTab(value)}
          variant="scrollable"
          TabIndicatorProps={{ sx: { backgroundColor: "primary.main", height: 3, borderRadius: 3 } }}
          sx={{ px: 2 }}
        >
          {advancedTabs.map((tab) => (
            <Tab key={tab} value={tab} label={tab} sx={{ fontWeight: 600 }} />
          ))}
        </Tabs>
      </Paper>

      {currentTab === "Chat" && <ChatPanel />}
      {currentTab === "AWS S3 Data" && <AwsPanel />}
      {currentTab === "Track Server" && <Track />}
      {currentTab === "User Activity" && <UserActivity />}
    </Stack>
  );
};

export default Advanced;
