# Handoff: KickMap — Sneaker Availability & Price Heatmap

## Overview

KickMap is a data-driven web app that scrapes JD Sports across Malaysia (MY), Indonesia (ID), and Singapore (SG) and helps sneakerheads find where their shoe is in stock, which size is available, and which region has the best price. The audience is cross-border shoppers and deal hunters in Southeast Asia.

This handoff covers a fully designed 6-page SPA with an interactive SVG heatmap homepage, deals feed, price comparison table, size finder, brand page, and product detail page.

---

## About the Design Files

The files in this bundle are **high-fidelity design references built in HTML/JSX** — interactive prototypes demonstrating the intended look, layout, and behavior. They are **not production code to copy directly**.

Your task is to **recreate these designs in your target codebase** (React, Next.js, Vue, etc.) using its established patterns, routing, data-fetching, and component libraries. The mock data in `data.js` shows the expected data shape — replace it with your real scraping backend.

---

## Fidelity

**High-fidelity.** These are pixel-precise mockups with final colors, typography, spacing, interactions, hover states, transitions, and copy. Recreate them as closely as possible using your codebase's component system.

---

## Design Tokens

### Colors
```
--bg:          #0a0a0a   /* page background */
--surface:     #141414   /* card / panel background */
--surface2:    #1a1a1a   /* elevated surface, hover states */
--border:      #242424   /* default border */
--border2:     #2e2e2e   /* emphasized border, hover border */
--accent:      #00ff87   /* electric green — primary accent (or #ff5c00 orange variant) */
--accent-dim:  rgba(0,255,135,0.12)  /* accent background tint */
--text:        #f0f0f0   /* primary text */
--text2:       #888888   /* secondary / label text */
--text3:       #555555   /* muted / placeholder text */

/* Region colors — fixed, used consistently everywhere */
--my:  #3b82f6   /* Malaysia — blue */
--id:  #ef4444   /* Indonesia — red */
--sg:  #f59e0b   /* Singapore — gold */

/* Region dim backgrounds */
--my-dim: rgba(59,130,246,0.15)
--id-dim: rgba(239,68,68,0.15)
--sg-dim: rgba(245,158,11,0.15)
```

### Typography
```
Font families:
  Headings / UI:  'Space Grotesk', sans-serif  (weights: 400, 500, 600, 700, 800, 900)
  Prices / data:  'JetBrains Mono', monospace   (weights: 400, 500, 600)

Type scale:
  Hero heading:    28px / weight 800 / tracking -0.03em / line-height 1.1
  Page heading:    20–24px / weight 800 / tracking -0.02em
  Brand label:     40px / weight 900 / uppercase / tracking -0.04em  (brand page)
  Card title:      14–15px / weight 700 / tracking -0.01em
  Label/meta:      10–11px / weight 600–700 / uppercase / tracking 0.06–0.1em
  Body:            12–13px / weight 400–500
  Price (mono):    13–18px / weight 600–700
  Table price:     13px mono / weight 600
  Stat figure:     20–22px mono / weight 800
```

### Spacing & Radius
```
Page padding:   0 24px horizontal
Card gap:       16px (product grid)
Row gap:        10–12px (deals list)
Border radius:  --radius: 6px (cards, buttons, inputs)
                8px (panels, region cards)
                99px (pills/badges)
Navbar height:  52px
```

### Shadows
```
Slide panel:    -24px 0 60px rgba(0,0,0,0.5)
Tooltip:        0 0 32px <accent>18, 0 4px 24px rgba(0,0,0,0.5)
Dropdown:       0 8px 24px rgba(0,0,0,0.4)
```

---

## Screens / Views

### 1. Navbar (global, sticky)
- Height: 52px, `position: sticky; top: 0; z-index: 100`
- Background: `rgba(10,10,10,0.92)` with `backdrop-filter: blur(12px)`
- Bottom border: `1px solid #242424`
- **Logo:** 28×28px green (`#00ff87`) rounded square (radius 6px) with "KM" in 13px / weight 800 / `#0a0a0a` + "KickMap" 15px weight 700
- **Nav links:** HEATMAP · DEALS · COMPARE · SIZE FINDER — 11px / weight 700 / tracking 0.08em, uppercase. Active state: `color: #00ff87; background: rgba(0,255,135,0.12)`; hover same
- **Right:** "⟳ 2h ago" in 11px mono + region badge row (🌐 MY ID SG) in a bordered pill
- Responsive: collapse nav links to hamburger on mobile (< 640px)

---

### 2. Homepage — Interactive Heatmap (`/`)

**Layout:** Two-column grid — SVG map (flex: 1) + right sidebar (210px fixed). Below a filter bar.

#### Hero strip
- Row: left = H1 "Find your size. Find the best price." (28px / 800 / tracking -0.03em). Second line "Find the best price." in `#00ff87`
- Subtitle: 12px / `#888` — "Live JD Sports stock · MY · ID · SG"
- Right: three stat figures — Matched / On Sale / Regions (20px mono / weight 800, label 10px uppercase)

#### Filter Bar
Panel: `background: #141414; border: 1px solid #242424; border-radius: 10px; padding: 14px 16px`

Contains four filter groups in a flex row:

1. **Brand pills** — one button per brand. Active: `background: rgba(0,255,135,0.12); color: #00ff87; border: 1px solid rgba(0,255,135,0.3)`. Inactive: `background: #1a1a1a; color: #888; border: 1px solid #242424`
2. **UK Size chips** — 36×28px buttons, font-mono 11px. Active: `background: #00ff87; color: #0a0a0a; border: var(--accent)`. Available but unselected: `#1a1a1a / #888`. Grid wraps to next line
3. **Model search** — text input with magnifier icon prefix. Type-ahead dropdown: shows brand + name + colorway per result. Up to 6 suggestions. `background: #0a0a0a; border: 1px solid #242424`
4. **Gender toggle** — segmented All / Men / Women / Unisex + "SALE ONLY" pill toggle

Active filter chips appear below the bar — each chip shows label + ✕ button, styled in accent-dim/accent.

**Filter logic:** All filters are AND-combined. Model filter matches on product name substring. Filters update the map, tooltip, region cards, and slide panel in real time — no debounce needed at this data scale.

#### SVG Heatmap
- `background: #0d1117; border: 1px solid #242424; border-radius: 10px`
- `aspect-ratio: 420/310` (matches SVG viewBox `"220 60 420 310"`)
- SVG contains: ocean fill `#0d1117`, subtle grid lines `#161b22 / 0.5px`, muted background countries `#1a1f2e / stroke #252b3b`
- **Interactive regions:** Malaysia (Peninsular + Borneo north), Indonesia (Sumatra, Java, Kalimantan, Sulawesi, island chain), Singapore (enlarged for click target)
- **Color mapping** (based on filtered matched/total ratio):
  - `pct = 0`       → fill `#ef444433` / glow `#ef4444` / label "No Stock"
  - `pct ≤ 0.25`    → fill `#f59e0b44` / glow `#f59e0b` / label "Low"
  - `pct ≤ 0.60`    → fill `#22c55e44` / glow `#22c55e` / label "Medium"
  - `pct > 0.60`    → fill `#00ff8755` / glow `#00ff87` / label "High"
- Colors transition smoothly: `transition: fill 0.25s, stroke 0.25s`
- **Hover state:** fill opacity increases to `66`, stroke becomes solid glow color, glow blur layer renders behind path, region label text switches to glow color
- **Region labels:** 7px / weight 700 / Space Grotesk — "MY", "ID", "SG" placed at centroid of each shape. Plus a 3px filled circle dot at the same point
- Bottom-left watermark: "SOUTHEAST ASIA · JD SPORTS" in 9px mono / `#2a2a2a`

#### Tooltip (hover on region)
- `position: fixed` — follows cursor at `+16px X, -10px Y`
- `background: rgba(14,14,14,0.97); border: 1px solid <glow>55; border-radius: 8px; padding: 12px 16px; min-width: 200px`
- Shadow: `0 0 32px <glow>18, 0 4px 24px rgba(0,0,0,0.5)`
- Shows: flag + region name + availability badge pill
- Mini stock bar: matched/total ratio as a 3px colored progress bar
- Data rows: Available · UK 12 in stock · UK 13 in stock · Top brand · On sale — 11px label/value pairs
- Footer: "CLICK TO EXPLORE →" in 10px accent green

#### Right Sidebar
- **Legend card:** `background: #141414; border: 1px solid #242424; border-radius: 8px; padding: 12px 14px` — 4 color swatches with labels
- **3 Region cards** (one per region): `border-left: 3px solid <glow>` accent, stock count in 16px mono glow color, mini 2px progress bar (matched/total), "X / Y" label if filters active, on-sale count in accent
- **Compare button:** full width, 10px mono uppercase, hover to accent green

#### Slide-in Panel (click on region or region card)
- `position: fixed; top:0; right:0; bottom:0; width: 400px; z-index: 400`
- Entry: `transform: translateX(100%) → translateX(0)` over 280ms `cubic-bezier(0.32,0,0.16,1)`
- Backdrop: `rgba(0,0,0,0.55)` fades in simultaneously
- **Header:** flag + region name + product count + ✕ close button + 3-stat mini grid (In Stock / On Sale / Top Brand) using glow color for values
- **Product list:** scrollable, each row = 62px thumbnail + brand label + name + price display + sizes/stock count. Click → navigate to product detail
- **Empty state:** centered ◎ icon + "No matches" message when filters return 0
- **Footer:** "COMPARE ALL REGIONS →" CTA button in accent-dim

---

### 3. Deals Feed (`/deals`)

**Layout:** Single column, full-width cards

#### Stats bar
`background: #141414; border: 1px solid #242424; border-radius: 6px; padding: 14px 16px`
Shows: "{N} products on sale across 3 regions. Biggest discount: {Brand} {Name} — {X}% off in [region badge]"

#### Deal cards
Full-width horizontal flex cards. Left-to-right:
1. **Rank column** — 44px wide, `background: #1a1a1a` (first card uses accent-dim). Shows `#N` in 13px mono. First card uses accent color
2. **Product thumbnail** — 88×88px striped placeholder
3. **Main info block** — brand (uppercase 11px) + name (15px / 700) + colorway (11px muted) + LowStockIndicator if total stock ≤ 10 + region badges for sale regions
4. **Price block** (right, flex-shrink:0) — strikethrough original price (11px mono / `#555`) → sale price (18px mono / accent) + SaleBadge + "SAVE {amount}" label

Hover: `border-color: #2e2e2e`
Click: navigate to product detail

---

### 4. Price Comparison Table (`/compare`)

**Layout:** Full-width sticky-header table with overflowX: auto

#### Controls bar
Row: page title + subtitle / right side: currency toggle (SGD|USD|MYR) + sort toggle (NAME|PRICE|DEAL) + search input

All toggles use the same segmented control pattern: `background: #141414; border: 1px solid #242424; border-radius: 6px; padding: 3px` with active child: `background: #1a1a1a; border: 1px solid #2e2e2e`

#### Table
```
thead: border-bottom: 2px solid #2e2e2e
  - PRODUCT col: position sticky left:0, background #0a0a0a, 260px wide, border-right
  - MY / ID / SG cols: min-width 130px, right-aligned, header in region color
  - BEST col: min-width 120px, border-left: 1px solid #242424

tbody rows: border-bottom: 1px solid #242424
  - Even rows: transparent; odd rows: rgba(255,255,255,0.01)
  - Hover: background #141414
  - Sticky first cell (product name) — same background as bg

Cheapest cell per row:
  background: rgba(0,255,135,0.05)
  border-left + border-right: 1px solid rgba(0,255,135,0.2)
  Price text: #00ff87
  Sub-label: "BEST" in 9px accent green

Sale indicator: small ↓ arrow (9px accent) before price
Unavailable: "—" in #555 mono
```

Currency conversion: SGD → USD (÷1.35), SGD → MYR (÷0.3157). All prices derived from SGD base.

---

### 5. Size Finder (`/size-finder`)

**Layout:** Full-width

#### Size selector panel
`background: #141414; border: 1px solid #242424; border-radius: 6px; padding: 16px`
UK sizes 3–15 including .5 increments. Button: 52×40px, border-radius 6px, font-mono 13px/700
- Has stock: `background: #1a1a1a; color: #f0f0f0; border: 1.5px solid #2e2e2e`
- Selected: `background: #00ff87; color: #0a0a0a; border: 1.5px solid #00ff87`
- No stock: `background: rgba(255,255,255,0.02); color: #555; cursor: default`

#### Results grid
`gridTemplateColumns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px`
Each card: horizontal flex — 96px thumbnail + info (brand, name, region+price pairs per matching region)

**Empty state:** ◎ icon + "No shoes found in UK {size} across MY, ID, SG" + "Try an adjacent size"

---

### 6. Brand Page (`/brand/:brandName`)

**Layout:** Header + product grid (same as homepage grid)

Header: back button ("← All Products") + brand name at 40px/900/uppercase/tracking-0.04em + meta row: "{N} products · In stock across 3 regions · {N} on sale"

Grid: identical to homepage — `repeat(auto-fill, minmax(200px, 1fr)); gap: 16px`

---

### 7. Product Detail (`/product/:productId`)

**Layout:** Two-column grid — `1fr 1.4fr; gap: 32px`

**Left column (sticky top: 72px):**
Square image container `background: #141414; border: 1px solid #242424; border-radius: 8px`. Image fills via `padding-bottom: 100%; position: relative` square crop.

**Right column:**
- Breadcrumb pills row: brand button (navigates to brand page) + gender tag + sale badge
- Product name: 28px / 800 / tracking -0.03em
- Colorway: 13px / `#888`
- **Best deal callout** (shows only if savings > S$1): `background: rgba(0,255,135,0.12); border: 1px solid rgba(0,255,135,0.25); border-radius: 8px; padding: 14px 16px` — "BEST DEAL" label + "Cheapest in {Region} at S$XXX — save S$YYY vs other regions"
- **Regional availability grid:** `repeat(3, 1fr); gap: 10px`. Each card:
  - Clickable to switch size grid view
  - Active: `background: #1a1a1a; border: #2e2e2e`
  - Cheapest: `border: 1px solid rgba(0,255,135,0.3)` + "CHEAPEST" label in 9px accent
  - Out of stock: `opacity: 0.5; cursor: default`
  - Shows: flag + RegionBadge + PriceDisplay + LowStockIndicator
- **Size grid:** `display: flex; flex-wrap: wrap; gap: 6px` — SizeChip per size
  - Available: `background: rgba(240,240,240,0.1); color: #f0f0f0; border: 1px solid #3a3a3a`
  - Unavailable: `background: rgba(255,255,255,0.03); color: #444; border: 1px solid #1e1e1e`
  - Size: 38×28px, border-radius 4px, 11px font-mono / weight 600
- **Timestamp footer:** `border-top: 1px solid #242424; padding-top: 16px; margin-top: 32px` — "Last scraped · 2h ago · JD Sports MY, ID, SG" in 11px mono / `#555`

---

## Shared Components

### RegionBadge
Pill: `padding: 2px 7px; border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em`
- MY: `background: rgba(59,130,246,0.15); color: #3b82f6; border: 1px solid #3b82f633`
- ID: `background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid #ef444433`
- SG: `background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid #f59e0b33`

### SaleBadge
`background: rgba(0,255,135,0.12); color: #00ff87; border: 1px solid rgba(0,255,135,0.3); border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: 0.07em`
Text: "SALE −{N}%" or just "SALE"

### RegionDot
8×8px circle. Active: `background: <region-color>; border: 1.5px solid <region-color>`. Inactive: `background: transparent; border: 1.5px solid #444`

### SizeChip (see Product Detail above)

### LowStockIndicator
Shown when `stock > 0 && stock <= 10`.
Row: 40×3px progress bar (`background: #222; overflow: hidden`) + text label
- stock ≤ 3: bar `#ef4444`, text "ONLY N LEFT" in `#ef4444`
- stock 4–10: bar `#f59e0b`, text "LOW STOCK" in `#f59e0b`
Text: 10px / weight 600 / tracking 0.05em

### PriceDisplay
Inline flex, font-mono. If discounted: strikethrough original in `#555 / 0.85em` + current in accent. If not discounted: current in `#f0f0f0`.

### ProductCard
- `background: #141414; border: 1px solid #242424; border-radius: 6px; overflow: hidden`
- Hover: `background: #1a1a1a; border-color: #2e2e2e; transform: translateY(-2px)`
- Square image (via padding-bottom 100%) with sale/low-stock badges positioned `absolute top:8 left:8`
- Info section: brand label (11px uppercase / `#888`) + name (14px/700) + colorway (11px/`#555`) + region dots row + price row ("FROM" label + S$XXX + "VIEW →")

### ProductImage (placeholder)
Diagonal stripe pattern using CSS repeating-linear-gradient in `#1a1a1a / #161616`. SVG shoe silhouette centered. Colorway text below in 9px mono / `#444`.

---

## Interactions & Behavior

### Routing
Hash-based SPA routing (`window.location.hash`). Routes:
- `#/` → Heatmap homepage
- `#/deals` → Deals feed
- `#/compare` → Compare table
- `#/size-finder` → Size finder
- `#/brand/:name` → Brand page
- `#/product/:id` → Product detail

In a real Next.js or React Router app, convert to file-based or path-based routing.

### Filter Logic (homepage heatmap)
All filters are AND-combined:
```js
function applyFilters(products, filters) {
  return products.filter(p => {
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.model && !p.name.toLowerCase().includes(filters.model.toLowerCase())) return false;
    if (filters.gender && filters.gender !== "All" && p.gender !== filters.gender) return false;
    if (filters.size) {
      const hasSize = Object.values(p.regions).some(r => r.inStock && r.sizes.includes(filters.size));
      if (!hasSize) return false;
    }
    if (filters.onSaleOnly && !p.onSaleAnywhere) return false;
    return true;
  });
}
```

Map color recomputes: `matched / total` per region → color tier.

### Slide Panel animation
Entry: `transform: translateX(100%) → translateX(0)` — 280ms `cubic-bezier(0.32,0,0.16,1)`
Exit: reverse + wait 280ms before unmounting. Backdrop fades in/out at same duration.

### Tooltip
`position: fixed`, follows `mousemove` event. Offset: `+16px X, -10px Y` from cursor. Unmount on `mouseleave`.

### Table hover rows
`onMouseEnter` / `onMouseLeave` on `<tr>` elements — set background inline.

---

## Data Shape

```typescript
interface Region {
  price: number;          // local currency
  originalPrice: number;  // pre-sale price (equals price if not on sale)
  currency: "MYR" | "IDR" | "SGD";
  inStock: boolean;
  onSale: boolean;
  stock: number;          // units in stock
  sizes: string[];        // UK sizes available e.g. ["7", "7.5", "8"]
}

interface Product {
  id: string;             // e.g. "NK-AM90-001"
  name: string;           // e.g. "Air Max 90"
  brand: string;
  gender: "Men" | "Women" | "Unisex";
  colorway: string;
  image: string | null;   // URL or null for placeholder
  regions: {
    MY: Region;
    ID: Region;
    SG: Region;
  };
  lowestSGD: number;       // pre-computed lowest price in SGD
  onSaleAnywhere: boolean; // pre-computed
  discountPct: number;     // highest discount % across regions
}
```

### Currency conversion rates
```js
MYR → SGD: × 0.3157
IDR → SGD: × 0.000082
USD → SGD: × 1.35
```

---

## Assets

- **Fonts:** Space Grotesk + JetBrains Mono — load from Google Fonts or self-host via `fontsource`
  ```
  https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap
  ```
- **Product images:** Placeholder in the prototype. In production, use the JD Sports product image CDN URL or your own image pipeline. The image container always crops to a 1:1 square.
- **Flags:** Unicode emoji (🇲🇾 🇮🇩 🇸🇬) — no external asset needed
- **Icons:** All icons are Unicode characters (⌕ ← → ✕ ◎ ↓ ⟳) — no icon library needed

---

## Files in This Package

| File | Description |
|------|-------------|
| `KickMap.html` | Main HTML entry point — loads all scripts, CSS variables, React + Babel |
| `data.js` | Mock data — products, currency rates, helper functions. Replace with real API |
| `km-shared.jsx` | Shared components: RegionBadge, SaleBadge, RegionDot, SizeChip, LowStockIndicator, ProductImage, PriceDisplay, ProductCard, Navbar, FilterBar |
| `km-home.jsx` | Homepage: HeatmapSVG, HeatmapFilterBar, MapTooltip, SlidePanel, HomePage |
| `km-pages-1.jsx` | DealsPage, ComparePage |
| `km-pages-2.jsx` | SizeFinderPage, BrandPage, ProductDetailPage |
| `tweaks-panel.jsx` | Tweaks panel scaffold (dev tool, not needed in production) |

---

## Implementation Notes for Claude Code

1. **Start with the design tokens** — set up a `theme.ts` or CSS variables file first with all colors, fonts, and spacing values listed above.

2. **Build shared components first** — RegionBadge, SaleBadge, SizeChip, LowStockIndicator, PriceDisplay, ProductCard are used across every page.

3. **The SVG map** — the simplified paths in `km-home.jsx` are hand-drawn for the prototype. For production, consider using a proper GeoJSON → SVG library (like `d3-geo` with Natural Earth data) for accurate country shapes at the same viewBox. The interactive region IDs (MY, ID, SG) and the color/hover logic stay the same.

4. **The filter system** — the `applyFilters` function is self-contained and pure. Wire it up to your state management (Zustand, Jotai, Redux, React context — any works at this data scale).

5. **Real data** — replace `data.js` with API calls to your scraping backend. The `Product` and `Region` interfaces above define the contract. Pre-compute `lowestSGD`, `onSaleAnywhere`, and `discountPct` either server-side or in a transformation layer.

6. **Images** — swap the `ProductImage` placeholder component for a real `<Image>` component (Next.js `next/image` recommended) with a 1:1 aspect ratio crop and a fallback to the striped placeholder on error.

7. **Routing** — convert hash routing to Next.js App Router pages: `app/page.tsx`, `app/deals/page.tsx`, `app/compare/page.tsx`, `app/size-finder/page.tsx`, `app/brand/[brand]/page.tsx`, `app/product/[id]/page.tsx`.

8. **Performance** — the filter `useMemo` in `HomePage` is important — don't skip it. At 1000+ products, recomputing on every render keystroke will cause jank.
