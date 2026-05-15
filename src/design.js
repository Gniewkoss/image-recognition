// ─── Design System — FoodLens "Everyday Kitchen" ─────────────────────────────
// Clean break from the forest green / ivory editorial direction.
// One accent, borders over shadows, system fonts, 8pt grid.

// ─── Color Tokens ─────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds
  white:       '#FFFFFF',       // all screen backgrounds
  surface:     '#F8F8F7',       // faintest warm gray (segmented control container)
  border:      '#EBEBEA',       // 1px borders throughout

  // Text hierarchy
  ink:         '#1A1A18',       // primary text
  inkSub:      '#6B6B67',       // secondary text
  inkTer:      '#A8A8A4',       // tertiary, placeholder, inactive icons

  // Accent — vivid warm orange-red (ONE bold color, used strictly)
  accent:      '#FF5C2B',       // primary CTA, active states, scan trigger
  accentTint:  '#FFF0EB',       // chip backgrounds, subtle fills (~8% opacity)
  accentDim:   '#FFCBB8',       // empty match dots, inactive indicators

  // Status
  danger:      '#E53E3E',
  dangerBg:    '#FFF1F1',
  success:     '#22A45D',
  successBg:   '#EDFAF4',
  successText: '#166534',

  // Amber (missing ingredients)
  amber:       '#B45309',
  amberBg:     '#FFFBEB',
  amberText:   '#92400E',
};

// ─── Typography — system fonts, no loading gate ───────────────────────────────
// Use fontWeight only (no fontFamily). Both platforms default to their
// system font: SF Pro on iOS, Roboto on Android.
export const FONT = {
  // Sizes
  xs:    12,   // caption, chip labels
  sm:    13,   // section headers (uppercase), supporting text
  base:  15,   // body text
  md:    17,   // card titles
  lg:    20,   // reserved
  xl:    22,   // screen titles (scan)
  '2xl': 28,   // screen titles (kitchen)
  hero:  48,   // big stat numbers

  // Letter spacing
  tight:  -0.8,  // hero numbers, screen titles
  snug:   -0.2,  // card titles
  normal:  0,
  cap:     0.6,  // uppercase section headers (13px UPPERCASE)
  wide:    0.1,  // chip labels
};

// ─── Spacing (8pt grid) ───────────────────────────────────────────────────────
export const S = {
  '1':  4,
  '2':  8,
  '3':  12,
  '4':  16,
  '5':  20,   // screen horizontal padding
  '6':  24,   // stack gap between sections
  '7':  28,
  '8':  32,
  '10': 40,
  '12': 48,
  '16': 64,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const R = {
  chip:  8,    // chips, tags — rectangular, editorial
  sm:    8,
  btn:   12,   // buttons — not pill, not square
  md:    12,
  card:  16,   // cards
  lg:    16,
  xl:    20,
  sheet: 24,   // bottom sheets / modals
  '2xl': 24,
  full:  9999,
};

// ─── Shadows — nearly none ────────────────────────────────────────────────────
// Borders over shadows. Only floating elements (sheets, FABs) get shadow.
export const SHADOW = {
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
};
