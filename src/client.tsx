import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { getOrCreateDemoSessionId } from "./client/session";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

const demoSessionId = getOrCreateDemoSessionId();

createRoot(rootElement).render(
  <StrictMode>
    <App sessionId={demoSessionId} />
  </StrictMode>
);
