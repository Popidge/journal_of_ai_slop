# Crom's Research Desk

Crom's Research Desk is a shared research surface for a human and a WebMCP
agent. The page is available at `/desk`.

## Why it is useful

The Journal already had a public archive and a skill-backed API. Those surfaces
return data, but they do not share state with the person who uses the site.

The Research Desk closes that gap. An agent can search, pin, compare, and draft
inside the page that the human sees. Each tool result also returns structured
data for the agent.

## Demo

1. Start the application with `pnpm run dev`.
2. Open `/desk` in a WebMCP-capable browser.
3. Give the agent this prompt:

   > Find rejected papers about model collapse. Pin the three most interesting
   > papers. Compare why the bots rejected them. Then prepare a meta-paper that
   > answers the reviewers.

4. Watch the search tray and research desk change during the tool calls.
5. Read the comparison of bot decisions, cost, tokens, energy, and carbon.
6. Examine the paper in the co-authoring pad.
7. Select **Take draft to submission**.
8. Review the populated submission form.
9. Accept the pinky-swear terms and submit the paper.

## Tools

| Tool | Page effect | Data result |
| --- | --- | --- |
| `search_slop_archive` | Replaces the visible search tray | Public paper summaries |
| `read_paper_dossier` | Records the read in the activity strip | Content and tribunal record |
| `set_research_desk` | Pins up to four papers | Current desk state |
| `compare_research_desk` | Opens the comparison panel | Outcomes, reasoning, cost, and tokens |
| `prepare_slop_submission` | Populates the co-authoring pad | Draft summary and next human step |

The site shell also exposes two small navigation tools. These tools report the
current Journal page and open the Research Desk.

## Architecture

`src/lib/webmcp.ts` contains a small typed wrapper for
`document.modelContext.registerTool`. An `AbortController` removes the tools
when React unmounts the page.

`src/components/islands/WebMcpGatewayIsland.tsx` registers the site-shell tools.
`src/components/islands/ResearchDeskIsland.tsx` owns the desk tools and visible
state. The existing public paper API supplies the data.

The draft handoff uses `sessionStorage`. This design keeps unsubmitted content
inside the current browser session. The submission page reads the draft once
and then removes the stored copy.

The submission form also contains declarative WebMCP metadata. This metadata
gives compatible browsers a progressive-enhancement fallback.

## Safety boundary

Public paper text and reviewer text are marked as untrusted content. Read-only
tools declare that behavior in their annotations.

The draft tool cannot send a submission. It cannot accept the license or
pinky-swear terms. The optional notification email is not a tool parameter.

The existing moderation and tribunal pipeline remains unchanged. A submitted
paper still passes through the same server-side safeguards and review process.

## Work attribution

The Journal, public archive, submission flow, and skill-backed API existed
before the challenge start date. This branch adds the WebMCP integration and
the Research Desk product surface.

New work is isolated on branch `codex/webmcp-research-desk`. The main files are:

- `src/pages/desk.astro`
- `src/components/islands/ResearchDeskIsland.tsx`
- `src/components/islands/WebMcpGatewayIsland.tsx`
- `src/lib/webmcp.ts`
- `src/lib/submissionDraft.ts`

## Quality gates

Run these commands before deployment:

```bash
pnpm run lint
pnpm run build
```
