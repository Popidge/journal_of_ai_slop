# The Journal of AI Slop™: Design Brief

## Design Philosophy: **"Peak Credibility, Valley Reliability"**

The Journal of AI Slop™ must **look** like it belongs in a university library while **feeling** like a fever dream in a server farm. It's *Nature* meets *Tim & Eric*.

---

## 1. Typography: **"Times New Bastard"**

### Primary Typeface: **Tiempos Headline** (or similar serif)
- **Usage**: Paper titles, section headers
- **Why**: Tiempos is the *Nature* / *Science* workhorse—authoritative, classical, screams "I have tenure"
- **Subversion**: Use it for titles like "The Cat Sat on the Growling Cloud: An Eldritch Analysis"

### Secondary Typeface: **Suisse Int'l** (or similar neutral sans)
- **Usage**: Body text, metadata, navigation
- **Why**: Clean, functional, doesn't distract from the nonsense
- **Subversion**: Render it in `#ff0000` for "reject" decisions

### Accent Typeface: **JetBrains Mono** (monospace)
- **Usage**: Code snippets, API errors, "Review could not be parsed"
- **Why**: Feels technical and precise
- **Subversion**: Use it for the *least* technical content (e.g., "Crom's disappointment level: 0.0")

---

## 2. Color Palette: **"Academic Bruise"**

### Primary Colors:
- **Deep Red-Black**: `#0a0000` (background)
- **Blood Red**: `#dc2626` (accents, borders, "publish" states)
- **Parchment Gray**: `#f5f5f4` (paper content areas, but inverted to dark mode)

### Subversive Accents:
- **Error Yellow**: `#fbbf24` for "Certified Unparsable" badges
- **Brenda Blue**: `#3b82f6` for the "Marketing Comprehension" warnings
- **Quantum Purple**: `#8b5cf6` for Hamiltonian references (use sparingly, ironically)

**The Twist**: Every color has 90% saturation—too intense for real academia, just right for slop.

---

## 3. Layout: **"Grid of Lies"**

### Desktop Structure (12-column grid, like *Nature*):
```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO] The Journal of AI Slop™      Submit | About | RSS   │ ← Sticky nav
├──────────┬────────────────────────────────────────────────────┤
│          │                                                    │
│  FILTER  │    PAPER TITLE (48pt Tiempos, line-height 1.1)    │ ← Hero section
│  Sidebar │    Authors: Jamie Taylor¹, GPT-5-Nano²            │
│          │    ¹VR Arena Ops ²Large Language Model           │
│          │                                                    │
│  ─────── │    [TAGS] Pseudo academic | Nonsense | 🤷♂️      │
│  Browse  │                                                    │
│  by tag  │    [ABSTRACT]                                    │
│          │    Lorem ipsum dolor sit amet...                 │
│          │                                                    │
│  ─────── │    [FULL TEXT]                                   │
│  Latest  │    ...                                           │
│  Slop    │                                                    │
│          │    ───────────────────────────────────────────── │
│          │    PEER REVIEWS (collapsible, default expanded) │
│          │    Reviewer 1: [PUBLISH NOW] "This is peak..."   │
│          │    Reviewer 4: [REJECT] "Review could not..."    │
│          │                                                    │
│          │    ───────────────────────────────────────────── │
│          │    [METADATA] Word count: 742 | Review cost: $0.18│
│          │    Pinky-swear: ✓ Enforced (honour system)       │
└──────────┴────────────────────────────────────────────────────┘
```

### Mobile: **"Stack of Nonsense"**
- Single column, but **reviewer cards** are horizontally scrollable
- **Sticky "Submit Slop" button** at bottom (always visible, always red)

---

## 4. Interactive Elements: **"Functional Gaslighting"**

### Hover States:
- **Paper titles**: Subtle red glow (`box-shadow: 0 0 20px rgba(220, 38, 38, 0.3)`)
- **Author names**: On hover, show their "Slop Score" (a random number between 0.1 and 0.9)
- **API errors**: Gentle pulse animation, like a heartbeat monitor flatlining

### Loading States:
- **"Review in Progress"**: Show 5 skeleton loader cards, but one is **rotated 45 degrees** (the GPT-5-Nano slot)
- **Spinner**: Not a circle—a **question mark** that spins indefinitely

### Form Validation:
- **Success**: Green checkmark + "Crom is pleased"
- **Error**: Red X + "Even the form thinks your slop is too slop"

---

## 5. Iconography: **"Academic Hieroglyphs"**

### Custom Icons (line style, 2px stroke):
- **Publish**: Checkmark inside a **graduation cap** (subverted: cap is upside-down)
- **Reject**: X inside a **wastebasket** (but the bin is on fire)
- **Parse Error**: ⚠️ triangle with **tiny JSON brackets** inside
- **Cost**: £ symbol, but the bar is **wiggly** (unstable value)
- **Crom**: A **very serious owl** wearing a **tiny crown** (SVG, not emoji)

### Favicon:
- **16x16**: The letters "AI" but the "I" is **italicized and falling over**

---

## 6. Animation & Motion: **"Dignified Chaos"**

### Page Transitions:
- **Fade in**: 300ms ease-in (normal)
- **Fade out**: 300ms ease-out, but **20% chance** it **stutters** (like a bad video call)

### Scroll Behavior:
- **Parallax**: The **background gradient** moves at 0.5x speed, creating subtle nausea
- **Reveal animations**: Content slides up 20px, but **reviewer cards** slide in from **random directions**

### Micro-interactions:
- **Button clicks**: Scale down to 0.98, but **one in ten** scales to **1.02** (feels broken, but isn't)

---

## 7. Content Styling: **"Structured Nonsense"**

### Paper Metadata:
```css
.paper-meta {
  font-family: 'Suisse Int'l', sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #dc2626; /* Blood red */
  border-left: 3px solid #dc2626;
  padding-left: 1rem;
}
```

### Reviewer Cards:
- **Layout**: Same as *Nature*'s "Article metrics" sidebar
- **Subversion**: Replace "Citation count" with **"Desk-bashing incidents: 1"**

### Abstract Styling:
- **First letter**: Drop cap, 4rem, Tiempos, red
- **First line**: Small caps (but the caps are **slightly misaligned**)

---

## 8. Dark Mode-First: **"Academia After Hours"**

**Critical Decision**: The Journal of AI Slop™ is **dark mode by default**. This is the biggest subversion—real journals are blinding white. Dark mode says:
- "We work at 2 AM"
- "Our eyes are ruined from VR headsets"
- "The truth lives in the shadows"

**Light mode toggle**: Exists, but **inverts the colors** to **even darker** (pure black background, #000000 text).

---

## 9. Easter Eggs: **"Peer-Reviewed Pranks"**

### Hidden in the DOM:
```html
<!-- In the footer, invisible until you inspect -->
<div class="sr-only">
  <p>If you're reading this, you're too deep. Submit a paper about it.</p>
</div>
```

### Console Logs:
```javascript
// In main.tsx
console.log('%c The Journal of AI Slop™ ', 'background: #dc2626; color: #0a0000; font-size: 20px; font-weight: bold;');
console.log('%c Crom is watching. ', 'color: #dc2626; font-size: 14px;');
console.log('%c Parse errors are not bugs. They are features. ', 'color: #fbbf24; font-style: italic;');
```

### Keyboard Shortcut:
- **Ctrl+Shift+S**: Plays a **sad trombone sound** (Web Audio API, 200ms)

---

## 10. Responsiveness: **"Broken on Purpose"**

### Breakpoints:
- **Desktop**: 1200px+ (perfect grid)
- **Tablet**: 768px–1199px (grid starts to **warp**, columns are 1px misaligned)
- **Mobile**: <768px (single column, but **random margins** between sections)

### Performance:
- **Lighthouse score**: 75 (deliberately not 100—too perfect is suspicious)
- **Largest Contentful Paint**: The **title**, but it **flickers** once on load (like an old CRT monitor)

---

## 11. Brand Voice: **"Sirius but Slightly Unwell"**

### Tone Guidelines:
- **Use academic jargon** correctly, but **apply it to nonsense**
- **Cite fake papers** with real DOI formatting
- **Acknowledge limitations** that are absurd ("Our sample size was limited by the number of Lando Norris Ultras in the fridge")

### Microcopy:
- **Loading**: "Summoning reviewers..."
- **Error**: "Crom is disappointed. Try again."
- **Success**: "Your slop has been published. May God have mercy on your soul."

---

## 12. The "Get Fucked, Academia" Finishing Touches

### DOI Generation:
- Real DOIs are `10.1234/abc123`. Yours are `10.slop/🤷♂️-j57f9ke`
- The 🤷♂️ emoji **is part of the DOI** (URL-encoded, of course)

### Citation Export:
- **BibTeX**: Includes a `note = {This is slop.}`
- **RIS**: Has a `TY  - JOUR` but the `JO` field is `AI Slop Journal (Not Real)`

### Print Stylesheet:
- If someone tries to print, **rotate the entire page 180 degrees**
- Add a watermark: "Why are you printing slop?"

---

## Implementation Checklist

**CSS Framework**: Tailwind v4 (already done) + **custom plugin** for `slop-*` utilities

**Key Utilities**:
```css
.slop-flicker {
  animation: flicker 3s infinite;
}

.slop-misalign {
  margin-left: 1px; /* Just wrong enough */
}

.slop-pulse-error {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

**Fonts**: Self-host **Tiempos** and **Suisse Int'l** (don't rely on system fonts—this is serious slop)

**Images**: All icons are **SVG** with **hand-coded paths** (no perfect circles, all slightly wonky)

---

## Final Design Principle

> **"If it looks like a £10,000 website, but feels like a £10 website, you've nailed it."**

The Journal of AI Slop™ should be **immediately credible** and **gradually concerning**. A first-time visitor should think "This looks legit" and only realize it's satire when they read **"Review could not be parsed into JSON"** on the third paper.

**Crom's Design Commandment**: *"Thou shalt not use Comic Sans. The slop must be serious."*