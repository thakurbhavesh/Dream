import React, { useState } from "react";
import {
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Drawer,
  Button,
  Grid,
  Typography,
} from "@mui/material";
import { PiFunnelSimple, PiMagnifyingGlass, PiPlayCircle } from "react-icons/pi";

const Videos = () => {
  // Side navigation data
  const sideNavData = [
    "All",
    "Google Drive Integration",
    "Forkout",
    "Burnout",
    "Audio Calling",
    "Mute Conversations",
    "Respond Later",
    "Message Edit",
    "Personal Settings",
    "Audio Messaging",
    "Admin-Dashboard",
  ];

  // Video data
  const videoData = [
    {
      feature: "Google Drive Integration",
      title: "Google Drive integration with TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Forkout",
      title: "How to use Forkout Feature - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Burnout",
      title: "Burnout is an exceptional privacy feature of TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Audio Calling",
      title: "Audio & Video Calls - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Mute Conversations",
      title: "Mute Conversations - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Respond Later",
      title: "How to Respond Messages Later - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Message Edit",
      title: "Edit a Message - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Personal Settings",
      title: "User Personal Settings",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
    {
      feature: "Audio Messaging",
      title: "Audio Message - TeamChatX",
      thumbnail: "https://via.placeholder.com/300", // Replace with actual thumbnail URL
    },
  ];

  // State management
  const [selectedFeature, setSelectedFeature] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false); // For mobile filter drawer

  // Filter features in sidebar based on search query
  const filteredSideNavData = sideNavData.filter((feature) =>
    feature.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter videos based on selected feature
  const filteredVideos =
    selectedFeature === "All"
      ? videoData
      : videoData.filter((video) => video.feature === selectedFeature);

  const renderFilterContent = () => (
    <Paper
      elevation={3}
      sx={{
        width: "100%",
        p: 2,
        borderRadius: "8px",
        backgroundColor: "#f7f9fc",
      }}
    >
      {/* Search Field */}
      <TextField
        variant="outlined"
        size="small"
        fullWidth
        placeholder="Filter by Feature"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <PiMagnifyingGlass
              size={18}
              style={{ marginRight: "8px", color: "#999" }}
            />
          ),
        }}
        sx={{ mb: 2 }}
      />
      {/* Feature List */}
      <List>
        {filteredSideNavData.map((feature) => (
          <ListItem key={feature} disablePadding>
            <ListItemButton
              selected={selectedFeature === feature}
              onClick={() => {
                setSelectedFeature(feature);
                setDrawerOpen(false); // Close drawer on mobile when a feature is selected
              }}
              sx={{
                borderRadius: "8px",
                "&.Mui-selected": {
                  backgroundColor: "#e3f2fd",
                  color: "#1976d2",
                },
              }}
            >
              <ListItemText primary={feature} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );

  return (
    <div className="videos-container d-flex wrapper" style={{ position: "relative" }}>
      {/* Filters Button for Small Screens */}
      <Button
        variant="contained"
        startIcon={<PiFunnelSimple size={18} />}
        sx={{
          display: { md: "none" },
          position: "absolute",
          top: "10px",
          right: "10px",
        }}
        onClick={() => setDrawerOpen(true)}
      >
        Filters
      </Button>

      {/* Side Navigation for Larger Screens */}
      <div
        style={{
          display: drawerOpen ? "none" : "block",
          width: "250px",
          marginRight: "20px",
        }}
        className="sidenav d-none d-md-block"
      >
        {renderFilterContent()}
      </div>

      {/* Drawer for Small Screens */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: "250px",
            p: 2,
            backgroundColor: "#f7f9fc",
          },
        }}
      >
        {renderFilterContent()}
      </Drawer>

      {/* Videos Section */}
      <div className="videos-section flex-grow-1">
        {filteredVideos.length > 0 ? (
          <Grid container spacing={3}>
            {filteredVideos.map((video, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  elevation={3}
                  sx={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      paddingTop: "56.25%", // Aspect ratio for video thumbnail
                    }}
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <PiPlayCircle
                      size={48}
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "#fff",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        borderRadius: "50%",
                        padding: "10px",
                      }}
                    />
                  </div>
                  <Typography
                    variant="body1"
                    sx={{
                      p: 2,
                      textAlign: "center",
                      fontWeight: "bold",
                      color: "#1976d2",
                    }}
                  >
                    {video.title}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography
            variant="body1"
            sx={{ color: "#999", textAlign: "center", mt: 4 }}
          >
            No Videos found for the selected feature.
          </Typography>
        )}
      </div>
    </div>
  );
};

export default Videos;
