---
name: project-redesign
description: FoodLens v2 — Everyday Kitchen design with premium landing ScanScreen, all bug fixes, full App.js rewrite May 2026
metadata:
  type: project
---

## v2 Upgrade — May 2026 (latest)

Complete App.js rewrite. design.js tokens unchanged. Key changes:

**ScanScreen (Home/Landing — premium)**
- Hero title: 34px weight 800, letterSpacing -1.2 (was 22px)
- Badge pill: "✦ AI-POWERED KITCHEN ASSISTANT" in accentTint
- Scan zone: 76px icon ring with pulse animation (1.07 scale loop), dashed container
- Entrance: fade (400ms) + spring slideUp on hero
- 3 feature chips: Instant scan / AI detection / Recipe match
- CTA: 56px primary "Take Photo" + 2×48px secondary buttons
- Results state: dark card (C.ink bg) with 48px recipe count + "View All Recipes"

**Bugs fixed**
- `foundRow` missing `flexDirection: 'row'` → replaced with dark result card
- `ApiKeyModal`: `openKeyModal()` now pre-fills tempKey with existing apiKey
- RecipeCard dots: replaced nested `<Text>` map with `<View>` dot rows
- Match % badge added to card image (top-left)

**Other screen improvements**
- KitchenScreen: stat in bordered card, arrow badge affordance
- SavedScreen: all 3 tabs use `<EmptyState>` consistently; icon action buttons in 36px circles
- RecipeDetail: hero 280px, accentTint emoji bg, StatusBar light, `heroFade` overlay, `ingMeasure` flexible width
- CookMode: 3px progress bar, swipe hint text, step label in accent color, recipe name inline in topBar
- TabBar: `Platform.OS === 'ios' ? 80 : 60` height (was static 84px)

---

## Active Design Direction: "Everyday Kitchen"

Completed a full visual break from the prior forest green (#1A3D2A) + warm ivory (#F5F1EA) + Playfair Display editorial palette.

**Why:** The previous design looked polished but generic — "premium food startup" aesthetic. Goal: feel like a tool for someone standing at their fridge at 6pm.

**How to apply:** When any visual change is requested, follow the Everyday Kitchen tokens and philosophy below. Don't reintroduce serif fonts, dark backgrounds, ivory/parchment colors, gradients, or heavy shadows.

---

### Color Palette (src/design.js — C tokens)
- `C.white` `#FFFFFF` — all screen backgrounds
- `C.surface` `#F8F8F7` — faintest warm gray (segmented control containers)
- `C.border` `#EBEBEA` — 1px borders everywhere (shadows replaced with borders)
- `C.ink` `#1A1A18` — primary text
- `C.inkSub` `#6B6B67` — secondary text
- `C.inkTer` `#A8A8A4` — tertiary / placeholder / inactive icons
- `C.accent` `#FF5C2B` — ONE bold color: CTAs, active states, scan trigger, progress
- `C.accentTint` `#FFF0EB` — chip backgrounds (~8% opacity fill)
- `C.accentDim` `#FFCBB8` — empty match dots, inactive indicators
- `C.danger` `#E53E3E`, `C.dangerBg` `#FFF1F1`
- `C.success` `#22A45D`, `C.successBg` `#EDFAF4`, `C.successText` `#166534`
- `C.amber` `#B45309`, `C.amberBg` `#FFFBEB`, `C.amberText` `#92400E`

### Typography
- System fonts only (no Google Fonts, no font loading gate). `fontWeight` only, no `fontFamily`.
- Screen titles: 28px weight 700, tight tracking
- Hero stats: 48px weight 700, letterSpacing -1.5
- Section headers: 13px weight 600 UPPERCASE tracking +0.6
- Card titles: 17px weight 600
- Body: 15px weight 400, lineHeight 1.5
- Chips/captions: 12-13px weight 500

### Key Architecture Decisions
- **No Reanimated** — replaced with React Native `Animated` API throughout
- **No Google Fonts / useFonts** — App renders immediately, no font loading gate
- **No LinearGradient** — borders replace shadows; grid card overlays use rgba dark tint
- **No skeleton loaders** — replaced with text placeholders ("Loading…")
- **No staggered list animations** — flat FlatList
- **No pulse rings** — ThreeDots component (iMessage-style) for loading state
- **No dark mode screens** — everything is white (including Scan and Cook mode)

### Screen Changes
- **ScanScreen**: White bg, camera zone (dashed border rect), ThreeDots loader in zone
- **ResultsScreen**: Filter chips with instant color swap (no animated sliding indicator)
- **KitchenScreen**: 48px hero stat number at top, text loading placeholder
- **SavedScreen**: Segmented control (Shopping/Favorites/History) instead of all-in-scroll
- **RecipeDetail**: Edge-to-edge 240px image (no radius), system font title
- **CookMode**: White background, thin orange progress bar at very top, simple nav buttons
- **Tab bar**: White bg, 1px top border, accent orange active state
