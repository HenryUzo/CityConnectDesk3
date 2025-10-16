# CityConnect Admin Dashboard Design Guidelines

## Design Approach
**System-Based:** Building on ShadCN UI foundation with inspiration from Linear's precision and Vercel's dashboard clarity. Focus on information hierarchy, functional efficiency, and clear visual states for multi-tenant context switching.

## Color Palette

**Dark Mode Primary (Default):**
- Background Base: `222 47% 11%` (rich dark)
- Surface: `222 47% 14%` (elevated panels)
- Border: `215 20% 25%` (subtle separation)
- Primary Brand: `200 95% 55%` (vibrant cyan-blue for actions)
- Global Mode Accent: `280 85% 65%` (purple indicator)
- Estate Mode Accent: `160 75% 55%` (teal indicator)
- Text Primary: `210 40% 98%`
- Text Secondary: `215 20% 65%`

**Light Mode:**
- Background: `0 0% 100%`
- Surface: `210 20% 98%`
- Border: `214 32% 91%`
- Maintain same accent colors with adjusted lightness for contrast

## Typography
**Font Stack:** Inter (via Google Fonts) for superior legibility in data-dense contexts

**Hierarchy:**
- Dashboard Headers: 32px/600 (tracking -0.02em)
- Section Titles: 20px/600
- Data Labels: 14px/500 (uppercase, tracking 0.05em)
- Body/Table Text: 15px/400
- Micro-labels: 13px/500

## Layout System
**Spacing Primitives:** Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm

**Grid Structure:**
- Sidebar: Fixed 280px (desktop), collapsible on tablet
- Main Content: `max-w-[1400px] mx-auto px-8`
- Dashboard Cards: `p-6` with `rounded-lg`
- Table Rows: `py-3 px-4`

## Global/Estate Toggle Component

**Placement & Hierarchy:**
Position toggle prominently in page header, left-aligned after breadcrumbs:
```
[Breadcrumbs] → [Global/Estate Toggle] → [Search] → [Filters] → [Action Buttons]
```

**Toggle Design:**
- Segmented Control Pattern (2 options)
- Height: `h-10` with `rounded-lg`
- Background: Surface color with border
- Active State: Filled with respective accent color (purple for Global, teal for Estate)
- Typography: 14px/600
- Include icons: Globe icon for Global, Building icon for Estate
- Smooth transition: `transition-all duration-200`

**Estate Selector (when Estate mode active):**
- Dropdown appears adjacent to toggle
- Width: `w-[280px]`
- Search-enabled with keyboard navigation
- Show estate count badge
- Display: Estate Name + Location (secondary text)

## Visual Distinction Strategy

**Global Mode Indicators:**
- Subtle purple glow on toggle (`shadow-[0_0_20px_rgba(168,85,247,0.15)]`)
- Page header background: Very subtle purple tint (`bg-purple-500/5`)
- Data badge prefix: "All Users" with purple dot indicator
- Stats cards show aggregated totals with "(Global)" suffix

**Estate Mode Indicators:**
- Teal accent implementation matching above pattern
- Header displays selected estate name prominently (24px/600)
- Breadcrumb shows estate hierarchy: `Dashboard → Estates → [Estate Name] → Users`
- Data scoped badge: Estate name chip with teal background
- Filter pills show "Estate: [Name]" prefix on all applied filters

**Transition Behavior:**
- Fade-out/fade-in animation (200ms) when switching contexts
- Skeleton loaders for table rows during data fetch
- Persistent toggle state in URL parameters

## Component Library Specifications

**Data Tables:**
- Sticky header with `backdrop-blur-xl bg-background/95`
- Row hover: `hover:bg-accent/50`
- Zebra striping: Subtle `even:bg-muted/30`
- Column sorting icons: ShadCN ChevronUp/Down
- Pagination: Show 25/50/100 options

**Stats Cards:**
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Each card: Icon (accent color), Label, Large Number (32px), Trend indicator
- Comparison metrics: Show "vs Global" or "vs Other Estates" in tooltip

**Action Patterns:**
- Primary CTAs: Filled buttons with brand color
- Secondary: Ghost buttons with border
- Destructive: Red accent (`0 84% 60%`)
- Always include loading states with spinner

**Navigation:**
- Sidebar items: `rounded-md px-3 py-2` with icon + label
- Active state: Accent background with border-left indicator (`border-l-4`)
- Collapsible sections for multi-tenant navigation

## Accessibility
- Minimum contrast ratio: 4.5:1 for all text
- Focus rings: 2px solid accent color with 2px offset
- ARIA labels for toggle state: "Viewing all users globally" / "Viewing users for [Estate Name]"
- Keyboard shortcuts: `G` for Global, `E` for Estate selector

## Images
**Not Applicable** - Admin dashboards are data-driven interfaces without hero sections or marketing imagery. Focus remains on functional UI clarity and information architecture.