// routes
import Router from "./routes/index.jsx";
// theme
import ThemeProvider from "./theme/index.jsx";
// components
import ThemeSettings from "./components/settings/index.jsx";
import {
  SiteBrandingProvider,
  SiteTitleSync,
} from "./contexts/SiteBrandingContext.jsx";

function App() {
  return (
    <SiteBrandingProvider>
      <SiteTitleSync />
      <ThemeProvider>
        <ThemeSettings>
          <Router />
        </ThemeSettings>
      </ThemeProvider>
    </SiteBrandingProvider>
  );
}

export default App;
