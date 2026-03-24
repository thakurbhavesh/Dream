import React, { useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Drawer,
  Button,
} from "@mui/material";
import { PiCaretDown, PiFunnelSimple, PiMagnifyingGlass } from "react-icons/pi";

const Faq = () => {
  // Side navigation data
  const sideNavData = [
    "General",
    "Groups",
    "Screen Share",
    "Orange Member",
    "Live Chat Support",
    "Audio Calling",
    "Live Location Tracking",
    "Audio Messaging",
    "Mute Conversations",
    "Favourites",
    "Flagging",
    "Respond Later",
    "Read Receipts",
    "Message Edit",
    "Notifications",
    "Group Profile",
    "Group Calling",
  ];

  // FAQ data
  const faqData = [
    {
      feature: "General",
      question: "How do I add Users/Employees?",
      answer:
        "There are two ways: Go to the Admin Dashboard, click on 'Add User,' and start adding employees. Alternatively, click 'Add Users' from the Messenger page.",
    },
    {
      feature: "Groups",
      question: "How do I create a new group?",
      answer:
        "Go to the group section in the Messenger, click on 'Create Group,' and add the members you wish to include.",
    },
    {
      feature: "Audio Messaging",
      question: "How can I send an audio message?",
      answer:
        "Click on the microphone icon in the chat window, record your message, and send it instantly.",
    },
    {
      feature: "Read Receipts",
      question: "What are read receipts?",
      answer:
        "Read receipts indicate whether the recipient has read your message. They appear as double checkmarks.",
    },
    {
      feature: "Notifications",
      question: "How do I enable or disable notifications?",
      answer:
        "Go to settings, navigate to the 'Notifications' section, and toggle the notification preferences.",
    },
  ];

  // State management
  const [selectedFeature, setSelectedFeature] = useState("General");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAccordion, setExpandedAccordion] = useState(null); // Track expanded accordion
  const [drawerOpen, setDrawerOpen] = useState(false); // For mobile filter drawer

  // Filter features in sidebar based on search query
  const filteredSideNavData = sideNavData.filter((feature) =>
    feature.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter FAQs based on selected feature
  const filteredFAQs =
    selectedFeature === "All"
      ? faqData
      : faqData.filter((faq) => faq.feature === selectedFeature);

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
    <div className="faq-container d-flex wrapper" style={{ position: "relative" }}>
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

      {/* FAQ Section */}
      <div className="faq-section flex-grow-1">
        {filteredFAQs.length > 0 ? (
          filteredFAQs.map((faq, index) => (
            <Accordion
              key={index}
              expanded={expandedAccordion === index}
              onChange={() =>
                setExpandedAccordion(expandedAccordion === index ? null : index)
              }
              sx={{
                mb: 1,
                borderRadius: "8px",
                "&:before": { display: "none" }, // Remove the default MUI Accordion line
              }}
            >
              <AccordionSummary
                expandIcon={<PiCaretDown size={20} />}
                sx={{
                  backgroundColor:
                    expandedAccordion === index ? "#eeeef2" : "#f7f9fc",
                  borderBottom: "1px solid #ff49421a",
                  "& .MuiAccordionSummary-content": { alignItems: "center" },
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: "bold",
                    color: expandedAccordion === index ? "#ff4842" : "",
                  }}
                >
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: "#fff", p: 2 }}>
                <Typography variant="body2">{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))
        ) : (
          <Typography
            variant="body1"
            sx={{ color: "#999", textAlign: "center", mt: 4 }}
          >
            No FAQs found for the selected feature.
          </Typography>
        )}
      </div>
    </div>
  );
};

export default Faq;
