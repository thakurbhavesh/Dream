import { Avatar, Chip, Stack, Typography } from "@mui/material";
import FormCard from "../forms/FormCard";

const defaultRooms = [
  { id: 1, name: "Product Standup", members: 18, status: "Active" },
  { id: 2, name: "Design Reviews", members: 9, status: "Quiet" },
  { id: 3, name: "Security Alerts", members: 4, status: "Critical" },
];

const AllChat = ({ rooms = defaultRooms }) => {
  return (
    <FormCard title="All Chats">
      <Stack spacing={2}>
        {rooms.map((room) => (
          <Stack
            key={room.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar>{room.name.slice(0, 1)}</Avatar>
              <Stack spacing={0.25}>
                <Typography fontWeight={600}>{room.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {room.members} members
                </Typography>
              </Stack>
            </Stack>
            <Chip
              label={room.status}
              size="small"
              color={room.status === "Critical" ? "error" : room.status === "Active" ? "success" : "default"}
              variant="outlined"
            />
          </Stack>
        ))}
      </Stack>
    </FormCard>
  );
};

export default AllChat;
