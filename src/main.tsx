import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
console.log('%c The Journal of AI Slop™ ', 'background: #dc2626; color: #0a0000; font-size: 20px; font-weight: bold;');
console.log('%c Crom is watching. ', 'color: #dc2626; font-size: 14px;');
console.log('%c Parse errors are not bugs. They are features. ', 'color: #fbbf24; font-style: italic;');
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
