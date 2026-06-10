# Design — Emergence Devops

A locked visual system for the frontend redesign. Every page keeps the existing UX and data flow, but uses this system for surface, type, spacing, and interaction voice.

## Genre
modern-minimal

## Macrostructure family
- App pages: Workbench — dense product surfaces, compact command controls, table/card hybrids, and inspector panels.
- Auth/onboarding pages: Split Studio — focused form or task flow with a quiet proof/brand panel.
- Data pages: Map / Diagram — graph, analytics, and repository views privilege spatial/data comprehension over decoration.

## Theme
- `--color-paper` oklch(96.9% 0.004 247)
- `--color-paper-2` oklch(94.5% 0.005 247)
- `--color-panel` oklch(98.7% 0.002 247)
- `--color-panel-2` oklch(92.9% 0.006 247)
- `--color-ink` oklch(18.5% 0.014 250)
- `--color-ink-2` oklch(38.5% 0.017 248)
- `--color-rule` oklch(85% 0.008 247)
- `--color-accent` oklch(46% 0.05 247)
- `--color-focus` oklch(54% 0.075 247)

## Typography
- Display: Geist, weight 700, normal.
- Body: Geist, weight 400.
- Mono: Geist Mono, weight 500 for metadata, ids, and graph labels.
- Display tracking: -0.035em.
- Type scale anchor: compact product UI with `--text-headline-lg` at 30px and tabular data labels.

## Spacing
4-point named scale. Pages use `var(--spacing-*)` and Tailwind theme names, not raw one-off spacing where a token exists.

## Motion
- Easings: `--ease-out`, `--ease-in`, `--ease-in-out`.
- Reveal pattern: restrained opacity/translate only for cards and transient loading states.
- Reduced motion: disable spatial movement and keep opacity changes under 150ms.

## Microinteractions stance
- Silent success, visible inline errors.
- Focus rings are immediate and high contrast.
- Hover states lift contrast and border weight, not layout.
- Loading states stay quiet: shimmer, spinner, or dots only.

## CTA voice
- Primary CTA: deep graphite filled, compact pill/rounded rectangle, direct verb.
- Secondary CTA: steel-tinted panel with visible border and restrained hover contrast.

## Per-page allowances
- App pages may use subtle surface gradients and graph/data color accents.
- App pages must not introduce decorative hero art.
- Auth/onboarding may use a restrained background field to separate them from dense app screens.
- Public landing may use Split Studio layout and a restrained hero graph field (CSS/SVG, no decorative chrome).

## What pages MUST share
- Geist typography.
- The graphite/steel palette with restrained enterprise blue emphasis.
- Compact control height, border radius, and focus ring behavior.
- Quiet command-center chrome.

## What pages MAY differ on
- Density and panel composition based on page role.
- Graph/chart accent colors when data categories require multiple hues.
- Mobile collapse patterns, as long as the existing UX order is preserved.

## Exports

### tokens.css
See `src/styles/tokens.css`.
