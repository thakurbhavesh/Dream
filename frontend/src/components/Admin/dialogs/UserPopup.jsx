import { useState } from "react";
import { Avatar, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

const defaultUser = {
  name: "Anita Sharma",
  email: "anita@aabhyasa.com",
  department: "Product",
  role: "Workspace Admin",
};

const UserPopup = ({ user = defaultUser, triggerLabel = "View profile" }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>User profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Avatar sx={{ width: 72, height: 72 }}>{user.name.slice(0, 1)}</Avatar>
            <Stack spacing={0.5} textAlign="center">
              <Typography variant="h6">{user.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.department} · {user.role}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UserPopup;
