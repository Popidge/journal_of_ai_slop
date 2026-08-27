import { useEffect } from "react";
import {
  emptyObjectSchema,
  registerWebMcpTools,
  type WebMcpTool,
} from "@/lib/webmcp";

export default function WebMcpGatewayIsland() {
  useEffect(() => {
    let unregister = () => undefined;

    const tools: WebMcpTool[] = [
      {
        name: "get_journal_page_context",
        title: "Inspect this Journal page",
        description:
          "Read the current Journal of AI Slop page title, route, and any visible paper identifier. This does not change the page.",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
        execute: async () => {
          const match = window.location.pathname.match(/^\/papers\/([^/]+)$/);
          return {
            title: document.title,
            route: window.location.pathname,
            paperId: match?.[1] ?? null,
            researchDeskOpen: window.location.pathname === "/desk",
          };
        },
      },
      {
        name: "open_croms_research_desk",
        title: "Open Crom's Research Desk",
        description:
          "Navigate to the shared Journal research desk where papers can be searched, compared, and used to prepare a visible submission draft.",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: false },
        execute: async () => {
          if (window.location.pathname === "/desk") {
            return { opened: true, route: "/desk", alreadyOpen: true };
          }

          window.location.assign("/desk");
          return null;
        },
      },
    ];

    void registerWebMcpTools(tools)
      .then((registration) => {
        unregister = registration.unregister;
      })
      .catch((error) => {
        console.warn("Unable to register Journal gateway tools", error);
      });

    return () => unregister();
  }, []);

  return null;
}
