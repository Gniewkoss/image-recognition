// ─── Design System — FoodLens ────────────────────────────────────────────────
// Single source of truth for all visual tokens.
// Inspired by Linear, Stripe, and Apple HIG.

// ─── Color Tokens ─────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds — warm ivory palette
  bgBase:      '#F5F1EA',   // warm ivory page background
  bgSurface:   '#FFFFFF',   // card surface
  bgSubtle:    '#EDE9E1',   // section / input background
  bgInverse:   '#0A0F0C',   // dark inversion

  // Dark theme (Scan + Cook screens)
  dark:        '#080D0A',   // deepest background
  darkSurface: '#0E1812',   // card surface on dark
  darkRim:     '#172218',   // elevated surface
  darkBorder:  'rgba(160,200,175,0.1)',
  darkDivider: 'rgba(160,200,175,0.06)',
  darkSage:    '#7CB898',   // muted sage accent on dark
  darkText:    '#DDE9E2',   // primary text on dark
  darkTextSub: '#607A6B',   // secondary text on dark

  // Brand — forest green
  brand:       '#1A3D2A',   // primary CTA, active states
  brandMid:    '#236640',   // hover, pressed
  brandLight:  '#35875A',   // lighter variant
  brandTint:   '#E5F2EB',   // very light brand background
  brandBorder: '#B8DDCA',   // brand-tinted border

  // Text hierarchy
  ink900:      '#0B0906',   // headlines
  ink700:      '#2D2920',   // primary body
  ink500:      '#6A6259',   // secondary
  ink400:      '#8C847B',   // placeholder
  ink300:      '#ACA49C',   // disabled, tertiary
  ink100:      '#D4CEC7',   // very subtle

  // Borders & Dividers
  rim:         '#E4DED7',   // default border
  rimSubtle:   '#EDE9E2',   // subtle border

  // Status — match indicator
  emerald:     '#1A9E52',   // ready/matched (vivid green)
  emeraldDim:  '#C4DED0',   // empty dot / unmatched
  emeraldBg:   '#EDFAF4',   // ready chip background
  emeraldText: '#0F6633',   // ready chip text

  // Status — warning
  amber:       '#D97706',
  amberBg:     '#FEF3C7',
  amberText:   '#924D00',

  // Destructive
  rose:        '#DC2626',
  roseBg:      '#FEF2F2',
  roseText:    '#991B1B',
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT = {
  // Families
  serif:       'Playfair-Bold',
  serifSemi:   'Playfair-SemiBold',
  sans:        'Inter-Regular',
  sansMed:     'Inter-Medium',
  sansSemi:    'Inter-SemiBold',
  sansBold:    'Inter-Bold',

  // Size scale (Major Third — 1.250 ratio)
  xs:    11,
  sm:    13,
  base:  15,
  md:    17,
  lg:    20,
  xl:    24,
  '2xl': 29,
  '3xl': 35,
  '4xl': 42,

  // Tracking
  tight:  -0.5,
  snug:   -0.3,
  normal:  0,
  wide:    0.3,
  wider:   0.8,

  // Leading multipliers
  none:   1.0,
  tight2: 1.2,
  snug2:  1.35,
  normal2:1.5,
  loose:  1.7,
};

// ─── Spacing (8pt grid) ───────────────────────────────────────────────────────
export const S = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const R = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  xs: {
    shadowColor: '#1A0F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A0F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A0F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A0F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 24,
    elevation: 8,
  },
};

// ─── Spring Configs (Reanimated) ──────────────────────────────────────────────
export const SPRING = {
  default: { damping: 20, stiffness: 280, mass: 1 },
  snappy:  { damping: 22, stiffness: 380, mass: 0.8 },
  bouncy:  { damping: 14, stiffness: 220, mass: 1 },
  gentle:  { damping: 28, stiffness: 180, mass: 1 },
  slow:    { damping: 35, stiffness: 120, mass: 1 },
};

// ─── Timing ───────────────────────────────────────────────────────────────────
export const TIMING = {
  instant: 80,
  fast:    160,
  normal:  280,
  slow:    450,
  verySlow:700,
};
