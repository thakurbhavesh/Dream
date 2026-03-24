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

const HowTo = () => {
  // Side navigation data
  const sideNavData = [
    "All",
    "Browser Pop-Out",
    "User Profile",
    "Date Range Filters",
    "Platform Indicator",
    "Video Messaging",
    "PIN",
    "Common Groups",
    "Auto-Delete",
    "Extended Search",
    "Self Message",
    "Zapier Integration",
    "Fonts & Formats",
    "Code Snippet",
    "Jointly Code",
    "Group Calling",
    "Group Profile",
    "Contacts Management",
    "Airtime Group",
    "Drop Box Integration",
    "Google Drive Integration",
  ];

  // FAQ data
  const faqData = [
    {
      feature: "Browser Pop-Out",
      question: "How to use Browser Pop-out?",
      answer:
        "Browser Pop-out allows you to pop out chats into a separate window.",
    },
    {
      feature: "User Profile",
      question: "How does the user profile work?",
      answer:
        "User Profile helps you manage user-specific settings and information.",
    },
    {
      feature: "Date Range Filters",
      question: "How to use date-range filters?",
      answer:
        "Date-range filters allow you to search messages within a specific time range.",
    },
    {
      feature: "Platform Indicator",
      question: "How to check on which platform the user is currently online?",
      answer:
        "Platform Indicator shows whether the user is on web, mobile, or desktop.",
    },
    {
      feature: "Video Messaging",
      question: "How to record a video message?",
      answer:
        "You can record a video message by clicking the record button in the chat window.",
    },
    {
      feature: "PIN",
      question: "How do I Pin a message, and where to check Pinned messages?",
      answer:
        "Use the Pin option in the chat to pin a message. Pinned messages are displayed at the top.",
    },
    {
      feature: "Common Groups",
      question: "How to check common groups?",
      answer:
        "Common groups are listed under the user profile in the 'Groups' section.",
    },
  ];

  // State management
  const [selectedFeature, setSelectedFeature] = useState("All");
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
    <div className="how-to-container d-flex wrapper" style={{ position: "relative" }}>
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
        className="sidenav d-none d-lg-block"
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

export default HowTo;
