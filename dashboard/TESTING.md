# TraceFlow AML Dashboard - Verification & Testing Checklist

This manual verification checklist covers the user experience and interface requirements for Tier-1 AML analysts.

## Step 1: Clean-up (Remove 'Dev' Feel)
- [x] **No Debug/Dev Strings**: Zero occurrences of `TODO`, `console.log` in UI, `lorem`, raw exception messages, or test labels visible to analysts.
- [x] **Analyst Terminology**:
  - Replaced technical `cluster` with `Case` / `Investigation Case`.
  - Replaced raw `pass_through` with `Rapid Pass-Through`.
  - Replaced `cycle` with `Circular Cycle`.
  - Replaced `fan_out` / `fan_in` with `Fan-Out Dispersion` / `Fan-In Aggregation`.
  - Replaced `CLUSTER TRANSFERS` with `CASE TRANSFERS`.
  - Replaced `Search cluster ID` with `Search cases`.
- [x] **Suspicious vs Confirmed Invariant**: All detections and alerts strictly state `Suspicious` or `Flagged`, never `Confirmed`.
- [x] **Unobtrusive Synthetic Data Note**: The synthetic experimental ground-truth disclaimer in the narrative panel is styled as an unobtrusive, subtle 10px muted footnote.
- [x] **Compact Identifiers**: Raw UUIDs/hashes formatted as short human-readable references (`Case #...` / `ID: ...`).
- [x] **No Redundant Headings or Buttons**: Streamlined action bars and headers.

## Step 2: Layout & Alignment
- [ ] Spacing scale adhered to (4/8/12/16/24/32 px).
- [ ] Font hierarchy restrained to 4 sizes (display 20-22px, card header 14-16px, body 12-13px, micro/meta 10-11px).
- [ ] 3-Pane Main View: Left ranked case queue, Centre graph canvas, Right details & STR report panel.
- [ ] Responsive grid: No horizontal scroll at 1280px+ and down to tablet width.
- [ ] Sticky headers on queue tables and main navigation.

## Step 3: Simple Forms & Feedback Buttons
- [ ] Single-column forms with short labels above fields and helpful defaults.
- [ ] Three distinct, calm decision buttons: Confirm (Green), Reject (Red/Muted), Unsure (Amber).
- [ ] Safety confirmation dialogs for model actions (Retrain, Rollback).
- [ ] Add Incident modal with inline validation and 'More options' disclosure.
- [ ] Keyboard navigation: Tab order, Enter to submit, Esc to dismiss modal.

## Step 4: Large Information & Progressive Disclosure
- [ ] Progressive disclosure summaries with clear chevron expand/collapse.
- [ ] Risk scores displayed with both numeric value and visual badge/bar.
- [ ] Report sentence hover highlights corresponding edges on the graph and rows in transaction tables.
- [ ] Graph capped at 30 nodes maximum with zoom and fit-to-view controls.
- [ ] Small 'Verified' badge for reports passing evidence verification.

## Step 5: Realistic User States
- [ ] Skeleton placeholders during data fetching (no blank screens).
- [ ] Friendly empty states with clear next actions.
- [ ] Plain-language error handling with Retry action (no stack traces).
- [ ] Auto-dismissing success toasts (1.5-2.5s).
- [ ] Truncated overflow text with tooltip on hover.

## Step 6: Visual Polish & Theme
- [ ] Restrained color palette with WCAG AA contrast.
- [ ] Support system dark/light mode preference.
- [ ] 150-200ms smooth CSS transitions.
- [ ] Crisp typography and consistent iconography.

## Step 7: Analyst Workflow Improvements
- [ ] Session-persistent queue filters (typology, risk range, review status).
- [ ] Keyboard shortcuts: `J` / `K` for queue traversal, `C` / `R` / `U` for triage decisions, `?` for shortcut sheet.
- [ ] One-click 'Copy Case Summary' button for SAR drafting.
- [ ] 'Time since alert' and review status badges on case rows.

## Step 8: Accessibility & Final E2E Automated Checks
- [ ] Focus outlines visible on keyboard focus.
- [ ] Full automated screenshot capture script across light and dark modes.
