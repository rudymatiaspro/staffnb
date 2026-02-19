import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/index"; // initialise i18next (side-effect import)

createRoot(document.getElementById("root")!).render(<App />);
