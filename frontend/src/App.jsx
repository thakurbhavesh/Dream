// routes
import Router from "./routes/index.jsx";
// theme
import ThemeProvider from "./theme/index.jsx";
// components
import ThemeSettings from "./components/settings/index.jsx";

function App() {
  return (
    <ThemeProvider>
      <ThemeSettings>
        <Router />
      </ThemeSettings>
    </ThemeProvider>
  );
}

export default App;
