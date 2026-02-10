# The Journal of AI Slop™

A satirical academic journal where the papers are too glitchy to be real, but the peer review process is ridiculously earnest. We accept papers co-authored by humans and LLMs, immediately shove them through a tribunal of five random LLM reviewers, and celebrate the survivors with a heroic landing page.

## Core Workflow (yup, it actually works)

1. Submit a paper via `/submit`. Titles, authors, slop content, tags, and a morally binding pinky swear are required.
2. Convex stores the submission, marks it `pending`, and enqueues the paper ID into `papersQueue`. The council convenes every ten minutes via a cron tick that pops the oldest queued submission and runs `reviewPaper` on it.
3. `reviewPaper` calls **all five approved OpenRouter models** with a JSON-only prompt, logs each model’s decision + reasoning, keeps track of total cost, and auto-accepts if 60% or more vote `publish_now`. Anything else is rejection; “publish_after_edits” is treated as a heartfelt rejection for the MVP.
4. Accepted papers show up on `/papers` and `/papers/:id`, where full slop + reviewer notes + total cost are displayed alongside the pinky-swear footer.

## Features

- **Submission guardrails**: (dodgy) Validation ensures at least one LLM name is mentioned, tags are chosen, and the pinky swear is toggled before Convex mutates the paper.
- **Automated Content Moderation**: See the section on Moderation Safeguards below.
- **OpenRouter-powered review panel**: Five models (`anthropic/claude-3-haiku`, `x-ai/grok-4.1-fast`, `google/gemini-2.0-flash-exp:free`, `openai/gpt-5-nano`, `meta-llama/llama-3.3-70b-instruct`) are asked to respond with JSON only, and failure cases auto-reject with comedic reasoning.
- **Cost tracking**: Every review stores the `x-ephemeral-token-cost` header if present. Over $0.20 total? We log a warning, complain, and still publish the breakdown anyway.
- **Skeumorphic academic UI**: Tailwind + gradient backgrounds + serif-paper rendering for content delivery.
- **LaTeX-ready typesetting**: Paper bodies can include inline `$...$` or display `$$...$$` math. KaTeX renders equations on the client so authors can lean on LaTeX without leaving the markdown editor, and the renderer automatically isolates malformed snippets (e.g., stray `&` in `cases`) into fenced `latex` blocks so surrounding content stays intact.

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
CONVEX_CLOUD_URL=<your Convex cloud URL>
CONVEX_SITE_URL=<your Convex site URL>
OPENROUTER_API_KEY=<the key you promised to stash>
CONTENT_SAFETY_ENDPOINT=<your Azure Content Safety endpoint>
CONTENT_SAFETY_KEY=<that resource's API key>
RESEND_API_KEY=<your Resend API key for notifications>
RESEND_FROM="Crom <notifications@youroceanicdomain.com>"
SITE_URL=https://your-deployed-domain.com
```

### SLOPBOT Post Drafts

SLOPBOT still composes a short blurb for each accepted paper and a daily archive highlight using the same Kimi K2 Thinking prompts, but the system now stores the final text inside the `slopTweets` table instead of posting directly to Twitter. The record includes the persona, origin (`new_publication` or `daily_highlight`), and a `status` flag that currently comes back as `drafted` for ready-to-publish entries or `failed_generation` if the prompt could not be completed.

To publish anywhere, query the collection for `status == "drafted"`, copy the `postBody`, and send it wherever you need (Twitter, Mastodon, a newsletter, etc.). A future automation hook can watch for those drafts and dispatch them automatically—just read the same row and mark it as posted when your webhook succeeds.

You still need the OpenRouter API key described above so SLOPBOT can run the prompts, and you can enable `SLOPBOT_DEBUG_MODE=1` (or any truthy value) to get verbose prompt/response logs while debugging. No Twitter API credentials are required at the moment, and you can safely remove the old `TWITTER_*` variables from your `.env.local` and Convex environment.

The peer-review pipeline now optionally emails authors when their paper is accepted or rejected (blocked papers remain silent to avoid leaking content). To make the notifications work, you need:

1. A verified sending domain set up inside Resend and matched to the `RESEND_FROM` value.
2. The `RESEND_API_KEY` stored in both your local `.env.local` and Convex project (`convex env set dev RESEND_API_KEY "<key>"`).
3. An absolute `SITE_URL` so the CTA button in the email points back at the live site (set it in Convex as well: `convex env set dev SITE_URL "https://your-deployed-domain.com"`).

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

## Eco Mode & Sustainability Metrics

The site now tracks every paper’s compute costs in tokens and exposes editable energy/CO₂ factors via Convex. Use the Eco Mode toggle in the navigation bar to layer a green overlay over the site and switch the paper list/detail views from dollar/token totals to mWh/gram readings powered by those factors.

If you’re wiring this into a fresh environment, run the one-off migration after deploying with:

```bash
npx convex action call internal.migrations.ecoModeMigration
```

This populates every paper’s `totalTokens` field and seeds the default `environmentalImpactValues` entry so the UI can immediately start converting usage into energy and carbon costs.
