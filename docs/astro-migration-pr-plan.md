# Astro Migration PR Convention

## Branch naming

- `feat/astro-pr1-foundation-static`
- `feat/astro-pr2-papers-ssr-isr`
- `feat/astro-pr3-islands-cutover`

## Merge order

1. `feat/astro-pr1-foundation-static` -> `main`
2. `feat/astro-pr2-papers-ssr-isr` (branched from updated `main`) -> `main`
3. `feat/astro-pr3-islands-cutover` (branched from updated `main`) -> `main`

## PR and deployment notes

- Each PR targets `main` directly and relies on Vercel preview deployments from GitHub branch pushes.
- Preview environment uses Convex dev URL and preview-only secrets.
- Production environment variables and production Convex deployment remain unchanged until merges land.
- Do not run parallel migration PRs against stale base branches; always rebase or branch from current `main` before starting the next PR.
