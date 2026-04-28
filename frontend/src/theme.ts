import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#48624c",
      light: "#6f8a72",
      dark: "#283b2c",
    },
    secondary: {
      main: "#b75d46",
      light: "#df8269",
      dark: "#7f392a",
    },
    background: {
      default: "#f7f4ee",
      paper: "#fffdfa",
    },
    text: {
      primary: "#1f261f",
      secondary: "#66705f",
    },
    success: {
      main: "#5b7f57",
    },
    warning: {
      main: "#bd7b32",
    },
  },
  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ].join(","),
    h1: {
      letterSpacing: 0,
    },
    h2: {
      letterSpacing: 0,
    },
    h3: {
      letterSpacing: 0,
    },
    h4: {
      letterSpacing: 0,
    },
    h5: {
      letterSpacing: 0,
    },
    h6: {
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
