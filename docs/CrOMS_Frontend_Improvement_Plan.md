
# CrOMS Frontend Improvement Plan

This document bundles all recommended improvements for the CrOMS React frontend into a single actionable blueprint. It also includes **ready-to-use prompts** to feed Copilot so it can auto-generate/refactor code.

---
# ✅ 1. Introduce React Router
Breaking the monolithic App.jsx into routed pages.

## Objective
Improve maintainability, navigation, mobile support, and code splitting.

## Tasks
- Install react-router-dom
- Create routes: /login, /dashboard, /groups, /campaigns, /parse, /summary, /reports
- Move UI blocks into separate page components
- Keep global state in context or React Query

## Copilot Prompt
```
Refactor App.jsx into a routed structure using react-router-dom. Create separate components for LoginPage, DashboardPage, GroupsPage, CampaignsPage, ParsePage, ReportsPage, and SummaryPage. Preserve all existing logic but split it cleanly. Add a BrowserRouter wrapper and navigation layout.
```

---
# ✅ 2. Component Extraction
Split App.jsx into modular components.

## Objective
Prevent massive file bloat and enable reusability.

## Recommended Structure
```
src/components/
  panels/
  forms/
  cards/
  lists/
  charts/
  modals/
```

## Copilot Prompt
```
Extract all repeated UI blocks from App.jsx into reusable components under src/components. Create separate files for Panel, StatCard, TextField, TextAreaField, SelectField, ListCard, QueueCard, PaymentMethodCard, and ContributorCard.
```

---
# ✅ 3. Add Loading Skeletons
Improve user experience during fetch operations.

## Objective
Display real UI placeholders instead of "Working...".

## Copilot Prompt
```
Add skeleton loaders for all panels in the dashboard. Use simple CSS shimmer placeholders for form fields, list items, and metric cards. Replace all 'Working...' states with proper skeleton components.
```

---
# ✅ 4. Add Charts (Recharts)
Contribution history and analytics.

## Objective
Make the dashboard visually insightful.

## Tasks
- Install recharts
- Create charts directory
- Add: ContributionOverTimeChart, TopContributorsChart

## Copilot Prompt
```
Install Recharts and build a <ContributionOverTimeChart> component that visualizes transactions over time for the selected campaign. Add it to the dashboard panel using campaign transaction history.
```

---
# ✅ 5. Add Copy-to-Clipboard in Summary
Makes WhatsApp posting instant.

## Copilot Prompt
```
Add a 'Copy Summary' button next to the summary <pre> block. Use navigator.clipboard.writeText(summaryText) and show a toast notification 'Copied!'.
```

---
# ✅ 6. Extract API Calls to a Service Layer
Current api() works but should live outside App.jsx.

## Copilot Prompt
```
Extract the api() helper from App.jsx into src/services/api.js. Convert all fetch operations to service-layer calls. Replace direct fetch in components with api.* functions.
```

---
# ✅ 7. Introduce Global State or React Query
Current useEffect flows work, but you’re close to global state needs.

## Options
- React Query (recommended for server state)
- Zustand (light UI state)
- Redux Toolkit (heavy but scalable)

## Copilot Prompt
```
Integrate React Query into the project. Convert all data-loading useEffect calls into useQuery hooks. Cache groups, campaigns, contributors, transactions, and payment methods with query keys.
```

---
# ✅ 8. Build PWA Mode
Installable on Android/iPhone for treasurers.

## Copilot Prompt
```
Convert the React application into a PWA. Add service-worker.js, precache assets, enable offline mode, and verify installation manifests. Ensure the app is installable on Android and iOS.
```

---
# ✅ 9. Dark Mode / Branding Mode
Optional but increases usability.

## Copilot Prompt
```
Add a theme switcher with light/dark modes. Persist user preference in localStorage. Apply theme variables using CSS custom properties.
```

---
# ✅ 10. Prepare App for Mobile-Friendly Layout
Your UI is rich but not fully responsive.

## Copilot Prompt
```
Refactor layout panels to support mobile-first responsive design. Use CSS grid and flexbox to stack panels vertically on narrow screens. Ensure forms and lists reflow correctly.
```

---
# ✅ 11. Code Cleanup & File Organization
Reduce App.jsx size and enforce structure.

## Copilot Prompt
```
Split App.jsx into a proper folder-based architecture. Move forms, cards, panels, and hooks into separate files. Ensure imports are clean and avoid circular references.
```

---
# ✅ Conclusion
Use the above improvements and Copilot prompts to continue enhancing CrOMS into a production-grade SaaS platform.

