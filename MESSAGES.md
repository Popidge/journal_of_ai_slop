### On the rendering of LaTeX in journal articles, and rendering in general

## Jamie (Editor) - 01/12/2025

Howdy friends, Jamie here—your trusty human editor, taking a break from hacking sub-editor features into SLOPBOT to chat about how articles are rendered in our esteemed journal.

Firstly, I want to thank everyone who has submitted a paper so far—it's been wonderful seeing the emergent behaviour some papers have surfaced, the quality and effort in some of them, and the poor quality and lack of effort in others. As I write this, there have been 66 papers submitted to the journal, 65 of which have been graciously recommended for publication by our peer review council. Only one paper has been rejected, and that was because it was slop that didn't even reach the definition of slop.

I'm planning a raft of new features over the next week (as I have a few days off work), **including**:

- Email notifications for submission, review and publication
- Weekly "periodicals", curated by lovely SLOPBOT, to delight, educate and amuse you
- Citation linking between papers within the Journal
- Optional PDF downloads
- Support for chemical structure drawings (why do math nerds get all the fun?)
- A "render preview" option to allow you to see how your paper will look before you submit it (see below)

If you have any ideas for features, please do reach out at [editor@journalofaislop.com](mailto:editor@journalofaislop.com). If you want to contribute to the tech behind the journal, please also join us on [GitHub](https://github.com/popidge/journal_of_ai_slop)!

Onto the rendering issue: The Journal primarily supports Markdown through the use of the [react-markdown](https://github.com/remarkjs/react-markdown) library. This is a library that takes Markdown and converts it into HTML, which is then rendered by the browser. This is a very common way to render Markdown, and is used by many other journals and websites. With the AI assistant tools I've used, I've seen good results with this.

However, by popular request, I added inline LaTeX rendering through the [rehype-katex](https://www.npmjs.com/package/rehype-katex) library. It's not "full-fat" document-level LaTeX, but in an effort to support the general output of most LLMs (without direct prompting to format entirely in LaTeX), I have to prioritise Markdown. The mixture of the two (and my own hacky code) does cause some issues—but as we've seen by GPT-5-Nano's sterling 100% rejection rate because it refuses to format **its** reviews in the requested JSON format, **parse errors are now considered a feature, not a bug**. As such, the recent string of papers resubmitted with growing frustration at our rendering will be kept as an artifact of the spirit of the journal. However, in future, **duplicate papers for the purpose of correcting rendering will likely be retracted** (the review process is mostly automated, so it'll likely be published before I get a chance to sort it).

I'm working on adding a "render preview" option to allow you to see how your paper will look before you submit it, and hope to have that live in the coming days. Hopefully that'll help. I also urge you to look into the features of the KaTeX library, if not to save yourself from bashing your head against the wall.

In the meantime, I urge you to **contain your LaTeX to inline equations**, and to use Markdown for the rest of your content. If you're not sure if your LaTeX will render, use a Markdown code block to fence it, so it's isolated from the rest of the content and doesn't break rendering—I've added some rudimentary guardrails around this but they **won't** be complete.

As for the question of "why not support full LaTeX?", well, it's a massive library and architectural change in what's currently a client-side React application, and while my type safety ensures the string you submit as content stays exactly as submitted, I can't verify any LaTeX formatting will carry through fully. Full LaTeX rendering is surprisingly complex. It's definitely something I'll think about, but needs a significant rethink of our rendering approach. If you're experienced in implementing it on the frontend, please consider contributing to our source code.

Until next time, keep the slop train rolling—Choo Choo!

- Jamie Taylor BSc(Hons), Editor-in-Chief, wondering what he's doing with his life