# The Journal of AI Slop™

A satirical academic journal where the papers are too glitchy to be real, but the peer review process is ridiculously earnest. We accept papers co-authored by humans and LLMs, immediately shove them through a tribunal of five random LLM reviewers, and celebrate the survivors with a heroic landing page.

## Core Workflow (yup, it actually works)

1. Submit a paper via `/submit`. Titles, authors, slop content, tags, and a morally binding pinky swear are required.
2. Convex stores the submission, immediately triggers `reviewPaper` (an internal `action`), and marks the record as `under_review`.
3. `reviewPaper` calls **all five approved OpenRouter models** with a JSON-only prompt, logs each model’s decision + reasoning, keeps track of total cost, and auto-accepts if 60% or more vote `publish_now`. Anything else is rejection; “publish_after_edits” is treated as a heartfelt rejection for the MVP.
4. Accepted papers show up on `/papers` and `/papers/:id`, where full slop + reviewer notes + total cost are displayed alongside the pinky-swear footer.

## Features

- **Submission guardrails**: (dodgy) Validation ensures at least one LLM name is mentioned, tags are chosen, and the pinky swear is toggled before Convex mutates the paper.
- **OpenRouter-powered review panel**: Five models (`anthropic/claude-3-haiku`, `x-ai/grok-4.1-fast`, `google/gemini-2.0-flash-exp:free`, `openai/gpt-5-nano`, `meta-llama/llama-3.3-70b-instruct`) are asked to respond with JSON only, and failure cases auto-reject with comedic reasoning.
- **Cost tracking**: Every review stores the `x-ephemeral-token-cost` header if present. Over $0.20 total? We log a warning, complain, and still publish the breakdown anyway.
- **Dark academic UI**: Tailwind + gradient backgrounds + serif-paper rendering for content delivery.

## Convex Layout

`convex/schema.ts` defines the `papers` table with the canonical fields (`title`, `authors`, `content`, `tags`, `submittedAt`, `status`, `reviewVotes`, `totalReviewCost`).

`convex/papers.ts` exports the public mutations/queries (`submitPaper`, `getPaper`, `listPapers`) plus internal helpers for scheduled review updates. The schema uses precise `v.union` types so decisions are always one of `publish_now`, `publish_after_edits`, or `reject`.

`convex/actions.ts` houses the `reviewPaper` action that:

- Fetches the pending paper via `ctx.runQuery`.
- Marks it `under_review` and runs each of the five models concurrently.
- Parses the JSON responses, auto-rejects if parsing fails, and records costs.
- Applies the final status + votes with `ctx.runMutation` and `updatePaperStatus`.

## Frontend Structure

- `src/components/LandingPage.tsx`: Hero copy, CTA buttons, and the “Latest Published Slop” rails with accepted paper teasers.
- `src/components/SubmitPaper.tsx`: Validated form with tags, pinky-swear, and author name checks that ensure at least one LLM is honored.
- `src/components/PapersList.tsx`: List of accepted slop (future filters and rejection views can be added later).
- `src/components/PaperDetail.tsx`: Full content, reviewer breakdown, and cost summary in a seriffed, tea-stained container.
- Global styles echo the black/red gradient aesthetic (`src/index.css`).

## Environment & Setup

```bash
npm install
```

Create a `.env.local` with:

```
VITE_CONVEX_URL=<your Convex dev URL>
OPENROUTER_API_KEY=<the key you promised to stash>
CONTENT_SAFETY_ENDPOINT=<your Azure Content Safety endpoint>
CONTENT_SAFETY_KEY=<that resource's API key>
```

## Moderation Safeguards

- Every submission now hits Azure AI Content Safety before the OpenRouter review round begins. The server-side action uses the `CONTENT_SAFETY_ENDPOINT` and `CONTENT_SAFETY_KEY` env vars, so make sure they exist in your Convex project (dev + prod).
- A paper is automatically blocked when the cumulative severity across all categories is **≥ 6** or any individual category hits **≥ 4**.
- Blocked papers never reach the LLM reviewers. Instead, Convex scrubs `title`, `authors`, `content`, and `tags`, flips the status to `rejected`, and stores the moderation summary (overall score, per-category severities, request id, and timestamp) under the `papers.moderation` field for auditing.
- Fail-closed behavior: if Azure returns an error, the moderation helper marks the paper as blocked with a `moderation_failed:*` reason so sensitive text still gets removed.
- Need to demo the flow without submitting questionable content? Set `CONTENT_SAFETY_TEST=true` (or `1/on/yes`) and the server will bypass Azure, emit a deterministic “blocked” verdict, and still redact the paper so you can exercise the UI.




The Convex action that performs moderation also needs these Azure variables. Set them in your Convex dev environment with:

```
convex env set dev CONTENT_SAFETY_ENDPOINT "https://<resource>.cognitiveservices.azure.com/"
convex env set dev CONTENT_SAFETY_KEY "<your key>"
```

Then run both Convex and the frontend together (`npm run dev`) or run them individually with `npm run dev:frontend` / `convex dev` if you enjoy terminal juggling.

## Testing

- `npm run lint` exercises `tsc` + `eslint` and ensures the codebase has no glaring type issues (check the `package.json` scripts if you want to add more).

## Cost Control & Etiquette

- Total review cost per paper targets **$0.20**. If OpenRouter decides to be expensive, we log a warning but keep moving.
- “Publish After Edits” decisions are treated as rejects for the MVP because we love the sting of failure.
- The pinky-swear clause?: purely ceremonial. But we still mention Crom.

## Deployment Notes

- The frontend can be deployed to Vercel. Set the same env variables there as well.
- Convex handles the backend; just deploy with `convex deploy` (you know the drill).

## Future / Satirical Goals

- Add AI reviewers that leave handwritten margins.
- Track rejection emails sent to fake chairs.
- Actually implement “publish after edits” once LLMs learn to obey instructions.

Crom is watching. Stay sloppy.