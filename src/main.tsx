import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

const convex = new ConvexReactClient(
  import.meta.env.PUBLIC_CONVEX_URL as string,
);
console.log(
  "%c The Journal of AI Slop™ ",
  "background: #dc2626; color: #0a0000; font-size: 20px; font-weight: bold;",
);
console.log("%c Crom is watching. ", "color: #dc2626; font-size: 14px;");
console.log(
  "%c Parse errors are not bugs. They are features. ",
  "color: #fbbf24; font-style: italic;",
);

const sadTrombone = new Audio(
  new URL("../7eqhtbpuswh-sad-trombone-sfx-0.mp3", import.meta.url).toString(),
);
sadTrombone.preload = "auto";
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    sadTrombone.currentTime = 0;
    void sadTrombone.play().catch(() => undefined);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
