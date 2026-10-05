---
name: Daybook
description: A quiet timetable for a student's internship record, in light and dark.
colors:
  # Light theme values. Dark values are in apps/web/src/app/globals.css (--paper #0f1519, --surface #171e24, --ink #e6ecef, --link #a5b4ff).
  ink: "#16232a"
  muted: "#4f5f68"
  paper: "#ecefee"
  surface: "#fcfdfc"
  surface-soft: "#e2e7e6"
  accent: "#3346a8"
  line: "#d3dbd9"
  line-strong: "#7f8d92"
  success-bg: "#dff1e6"
  success-ink: "#14532f"
  warning-bg: "#fbecc8"
  warning-ink: "#6b4506"
  danger-bg: "#fae4e1"
  danger-ink: "#8f2a25"
typography:
  headline:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "clamp(1.85rem, 2.2vw, 2.35rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  title:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  control: "0.55rem"
  panel: "0.85rem"
  status: "999px"
spacing:
  control-y: "0.65rem"
  control-x: "1.05rem"
  panel: "1.35rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "2.85rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "2.85rem"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
---

# Design System: Daybook

## Overview

**Creative North Star: “A quiet timetable.”** Daybook organizes dates, state, and next actions as a dependable personal record. Forms and lists carry the visual interest; progress is expressed with real numbers and a single track. The system is deliberately compact enough for frequent phone use and calm enough for longer report writing.

## Colors

Every colour is a token in `apps/web/src/app/globals.css`, defined once for light and once for dark; components never use raw hex values. Light is cool mineral paper with near-white surfaces and deep ink. Dark is blue-black with slightly lighter surfaces. Ballpoint-ink indigo marks primary actions, links and active navigation, and stays distinct from the state colours: green means worked or saved, amber means unfinished or review needed, red marks absence, errors and destructive actions. Status always uses words as well as colour. Text pairs meet 4.5:1 and borders, focus rings and the progress fill meet 3:1 in both themes.

## Themes

Dark follows the system setting by default. The header toggle (and the login page) overrides it, stores the choice in the browser, and a small inline script applies it before first paint. Panels use a fine border and a low shadow in light, and border only in dark.

## Typography

One typeface, IBM Plex Sans, serves the whole system: titles, body, labels, tables and numbers. It is loaded with `next/font` (self-hosted at build time) and defined once as `--font-sans` in `apps/web/src/app/globals.css`, so changing the font is a one-line change in `layout.tsx` plus that token. Weights in use: 400 body, 600 labels and navigation, 700 titles and figures. Hierarchy comes from size and weight, not from a second family. Table headings are sentence case. Numbers use tabular figures where alignment matters. Explanatory copy stays near 65 characters wide when the layout permits.

## Layout

The main content has a 96rem maximum width. The report editor may expand to 104rem on wide displays while retaining centered viewport gutters, and its history panel stays visible during desktop scrolling. Desktop work areas pair a main task with a narrower context column. The workspace header pairs the Daybook identity with a compact Philippine date/time indicator; tabular time figures prevent width changes. At phone widths, the header keeps only that identity and time context while a safe-area-aware bottom navigation keeps the five primary destinations one tap away. Appearance and sign-out actions move to the mobile Profile screen. History changes from a table to full-content record rows below the `md` breakpoint; it does not rely on horizontal scrolling to expose edit actions. In the Draft editor toolbar, editing actions stay left and saved-Draft downloads align right on wider screens, then wrap below on phones.

## Elevation & Depth

Panels use a fine border and low offset shadow. State surfaces rely on tonal fills and clear text rather than heavy elevation.

## Shapes

Controls use a 0.55rem radius, panels 0.85rem, and status labels are pills. A 1px rule separates records and sections. Corners remain consistent across forms, feedback, and navigation.

## Components

Primary and secondary buttons share a 2.85rem minimum height. Inputs, selects, and textareas use the same border, radius, and minimum height. Navigation exposes the active route with `aria-current`. Notices and status labels share success, warning, and danger colors. Focus uses a visible orange outline; reduced-motion preference shortens animation and transitions.

### Popups and confirmations

- Students use these panels to finish a day, find feature guidance, or review an editor change. Keep the saved record distinct from unsaved editor changes.
- Use `PopupHeader` for a titled panel with a small indigo emblem, explanatory subtitle, and a 44px close control. Refresh is a secondary icon action with an accessible label.
- Popup tokens (`--popup-space-*`, `--popup-text-*`, `--popup-radius`, `--popup-shadow`, `--popup-duration`, `--popup-ease`) live in `globals.css`. Spacing follows a 4px rhythm; type is 12/14/18/24px; panel corners remain 0.85rem. Light surfaces have two quiet shadow layers; dark surfaces use borders.
- Reminders use readable dated records and quiet inline actions. Show a matching skeleton while loading, an actionable empty state, and retry on failure. Retain the last loaded list with a warning when refreshing fails.
- Help uses a paper conversation area, indigo question bubbles, surface answer cards, and a separate composer. Starter questions are secondary; Send is the primary action. Keep scope and data-use information visible.
- Confirmation dialogs name the activity or replacement and explain the consequence. Show an activity excerpt or import count. Focus the cancel action first; distinguish danger and replacement actions with words and semantic colors. Cancellation never alters editor rows.
- Panels become safe-area-aware bottom sheets at 700px. Confirmations stay centered and fit within the viewport. Each panel scrolls internally; actions stay reachable.
- Use native dialogs for focus containment and Escape dismissal; restore trigger focus after closing. Mount transient reminders controls only when open to retain stable hydration.
- Occasional popup entrances use 180ms opacity/transform transitions with `--popup-ease`. Reduced motion removes entrance movement and press scaling. No bounce, animated dimensions, or decorative loading motion.

## Do's and Don'ts

- Do show the date and state beside every attendance or report record.
- Do present prominent report dates in a readable long form such as `September 23, 2026`, while retaining ISO dates for inputs and machine-readable values.
- Do make completion, absence, and review warnings explicit in text.
- Do keep report rows readable and wrap long task text on narrow screens.
- Don't use decorative dashboard metrics or color without a state or action purpose.
