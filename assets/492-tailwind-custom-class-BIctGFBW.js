const n=`---
title: "Tailwind \`@apply\` and Custom Classes"
date: 2026-05-02
id: blog0492
tag: react
toc: true
intro: "Tailwind \`@apply\` and Custom Classes"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>



### What is \`@apply\`?

\`@apply\` is a Tailwind CSS directive that lets us extract a set of utility classes into a **reusable CSS class name**. 

Instead of repeating the same long list of utilities across many files, we define them once in our CSS and reference a single class name everywhere.

\`\`\`css
/* index.css */
@layer components {
  .btn-no-border {
    @apply !border-0 !outline-none focus:!outline-none focus:!ring-0 focus:!shadow-none
           !bg-neutral-50 dark:!bg-neutral-700/80 hover:!bg-white dark:hover:!bg-neutral-600
           !backdrop-blur-sm !rounded-md !shadow-sm;
  }
}
\`\`\`

\`\`\`tsx
/* Usage in any component */
<button className="btn-no-border fixed top-3 right-4">...</button>
\`\`\`

---

### Why \`@layer components\`?

Tailwind organizes styles into three layers:

| Layer | Purpose |
|---|---|
| \`base\` | Global resets and defaults (e.g. \`h1\`, \`body\`) |
| \`components\` | Reusable class patterns, intended for \`@apply\` component classes |
| \`utilities\` | Single-purpose utility classes (Tailwind's own classes live here) |

Placing our class inside \`@layer components\` ensures it has the **correct specificity**, lower than utilities, so we can still override it with a utility class directly on an element.

\`\`\`css
/* This works: the p-4 utility overrides the padding defined in .btn-no-border */
<button className="btn-no-border p-4">...</button>
\`\`\`

If we define \`.btn-no-border\` outside any \`@layer\`, it could end up with unpredictable specificity.

---

### Comparison: three approaches

#### Exported constant (simple, no IntelliSense)

\`\`\`ts
// utils.ts
export const ghostBtnCls = "!border-0 !outline-none focus:!outline-none ...";
\`\`\`

\`\`\`tsx
<button className={\`\${ghostBtnCls} fixed top-3\`}>...</button>
\`\`\`

- Easy to set up
- Fully typed (TypeScript knows the value)
- Tailwind IntelliSense cannot read inside template literals, so there is no hover preview or autocomplete at the call site

#### \`@apply\` in CSS (recommended for stateless visual patterns)

\`\`\`css
@layer components {
  .btn-no-border {
    @apply !border-0 !outline-none ...;
  }
}
\`\`\`

\`\`\`tsx
<button className="btn-no-border fixed top-3">...</button>
\`\`\`

- IntelliSense **fully recognises** \`.btn-no-border\` and shows all applied styles on hover
- Single source of truth in CSS
- Works with any framework (React, Vue, plain HTML)
- Cannot accept dynamic values or props

#### CVA — class-variance-authority (for components with variants)

\`\`\`ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  // base classes
  "btn-no-border font-medium transition-colors",
  {
    variants: {
      size: {
        sm: "p-1 text-sm",
        md: "p-2 text-base",
      },
      intent: {
        primary: "bg-blue-500 text-white",
        ghost: "bg-transparent",
      },
    },
    defaultVariants: { size: "md", intent: "ghost" },
  }
);
\`\`\`

\`\`\`tsx
<button className={buttonVariants({ size: "sm", intent: "primary" })}>...</button>
\`\`\`

- IntelliSense works inside \`cva()\` calls (via the Tailwind CSS IntelliSense extension)
- Great for design systems to enforce consistent variants
- TypeScript provides autocomplete on the variant props
- Extra dependency; overkill for one-off classes

---

### When to use each

| Situation | Recommended approach |
|---|---|
| Simple, stateless visual pattern used in many places | \`@apply\` in CSS |
| Component with multiple visual variants (size, color, state) | CVA |
| Quick one-off, or shared logic not purely visual | Exported constant |

---

### Gotchas with \`@apply\`

#### Using \`!important\` modifiers

Tailwind's \`!\` prefix (e.g. \`!border-0\`) works inside \`@apply\`:

\`\`\`css
.btn-no-border {
  @apply !border-0 focus:!outline-none;
}
\`\`\`

#### Dark mode with \`@apply\`

If the project uses a **class-based dark mode** (e.g. \`html.dark\`), make sure the Tailwind config or CSS sets \`darkMode: 'class'\`. The \`dark:\` variant works normally inside \`@apply\`:

\`\`\`css
.btn-no-border {
  @apply bg-white dark:bg-neutral-800;
}
\`\`\`

#### \`@apply\` does not work with arbitrary values

This **does not work**:

\`\`\`css
/* Arbitrary values cannot be used with @apply */
.my-class {
  @apply w-[260px];
}
\`\`\`

Use a plain CSS property instead:

\`\`\`css
.my-class {
  width: 260px;
}
\`\`\`

---

### How IntelliSense resolves \`.btn-no-border\`

The Tailwind CSS IntelliSense VS Code extension scans our CSS files for classes defined with \`@apply\`. When we type \`btn-no-border\` in a \`className\`, hovering over it shows a tooltip listing all the applied utilities, exactly like hovering over a native Tailwind class.

To enable this, make sure the extension is installed:
- **Extension ID:** \`bradlc.vscode-tailwindcss\`
`;export{n as default};
