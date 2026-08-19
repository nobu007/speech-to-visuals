import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  // The old assertion let createRoot(null) crash with an opaque TypeError;
  // fail loud with the missing selector named instead (Phase 147 / REQ-336).
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(<App />);
