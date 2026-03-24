import { Card, CardContent, CardHeader, useTheme } from "@mui/material";

const FormCard = ({ title, subheader, action, children, contentProps, ...cardProps }) => {
  const theme = useTheme();
  return (
    <Card
      {...cardProps}
      sx={{
        borderRadius: 1,
        border: "1px solid rgba(145, 158, 171, 0.18)",
        backgroundColor:
                theme.palette.mode === "light"
                  ? "#fff"
                  : theme.palette.background.paper,
        height: "100%",
        ...cardProps.sx,
      }}
    >
      {(title || action) && (
        <CardHeader
          title={title}
          subheader={subheader}
          action={action}
          sx={{
            pb: 0,
            "& .MuiCardHeader-title": {
              fontWeight: 700,
              fontSize: 15,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            },
            "& .MuiCardHeader-subheader": {
              fontSize: 13,
            },
          }}
        />
      )}
      <CardContent
        {...contentProps}
        sx={{
          pt: title ? 2.5 : 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          ...contentProps?.sx,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
};

export default FormCard;
