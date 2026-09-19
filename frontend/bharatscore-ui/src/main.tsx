import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { ClerkWithRouter } from "./ClerkRouter";

// const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkWithRouter publishableKey={"pk_test_ZGFybGluZy1wb3NzdW0tMTQuY2xlcmsuYWNjb3VudHMuZGV2JA"}>
        <App />
      </ClerkWithRouter>
    </BrowserRouter>
  </React.StrictMode>
);
