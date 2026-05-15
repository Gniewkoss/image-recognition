// ─── Utilities — FoodLens ────────────────────────────────────────────────────

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── Server URL ───────────────────────────────────────────────────────────────

const API_PORT = process.env.EXPO_PUBLIC_SERVER_PORT?.trim() || '5001';

function getExpoHost() {
  const uri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (!uri || typeof uri !== 'string') return null;
  return uri.split(':')[0] || null;
}

export function buildServerUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = getExpoHost();
  if (host && host !== 'localhost') return `http://${host}:${API_PORT}`;
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  return `http://127.0.0.1:${API_PORT}`;
}

export function humanizeApiError(body, httpStatus) {
  if (!body || typeof body !== 'string') {
    return httpStatus ? `Request failed (HTTP ${httpStatus}).` : 'Request failed.';
  }
  const t = body.trim();
  if (t.startsWith('<!DOCTYPE') || t.startsWith('<html')) {
    if (/ERR_NGROK_3200|endpoint .+ is offline/i.test(t))
      return `Backend offline. Start Flask on port ${API_PORT} or set EXPO_PUBLIC_SERVER_URL.`;
    return `Server returned HTML (HTTP ${httpStatus ?? '?'}). Check the backend is running.`;
  }
  try {
    const j = JSON.parse(t);
    if (j.error) return String(j.error);
    if (j.message) return String(j.message);
  } catch (_) {}
  return t.length > 320 ? `${t.slice(0, 320)}…` : t;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatScanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  const time = `${h}:${m}`;
  if (day.getTime() === today.getTime()) return `Today · ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.getTime() === yesterday.getTime()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${time}`;
}

// ─── Ingredient Categorization ────────────────────────────────────────────────

const CAT_PATTERNS = [
  ['Proteins',    /chicken|beef|pork|fish|egg|salmon|tuna|lamb|duck|turkey|sausage|bacon|ham|prawn|shrimp|seafood|crab|lobster|tofu|tempeh/],
  ['Dairy',       /milk|cream|cheese|butter|yogurt|cheddar|mozzarella|parmesan|ricotta|brie|gouda|feta/],
  ['Vegetables',  /tomato|carrot|onion|garlic|potato|lettuce|spinach|pepper|broccoli|mushroom|cucumber|zucchini|celery|corn|avocado|pea|bean|lentil|kale|cabbage|leek|asparagus|artichoke|aubergine|eggplant/],
  ['Fruits',      /apple|banana|orange|lemon|lime|berry|strawberry|blueberry|raspberry|grape|pineapple|mango|watermelon|melon|peach|plum|cherry/],
  ['Grains',      /bread|rice|pasta|noodle|spaghetti|flour|oat|cereal|wheat|penne|macaroni|tortilla|quinoa|barley|couscous/],
  ['Condiments',  /sauce|ketchup|mayo|mustard|dressing|oil|vinegar|honey|sugar|salt|spice|seasoning|herb|soy|chili|pepper|paprika|cumin|turmeric|cinnamon|basil|oregano|thyme/],
];

export function getIngredientCategory(name) {
  const l = name.toLowerCase();
  for (const [cat, rx] of CAT_PATTERNS) {
    if (rx.test(l)) return cat;
  }
  return 'Other';
}

const CATEGORY_META = {
  Proteins:   { emoji: '🥩', color: '#C0392B' },
  Dairy:      { emoji: '🧀', color: '#F4D03F' },
  Vegetables: { emoji: '🥦', color: '#27AE60' },
  Fruits:     { emoji: '🍎', color: '#E74C3C' },
  Grains:     { emoji: '🌾', color: '#D4A574' },
  Condiments: { emoji: '🫙', color: '#95A5A6' },
  Other:      { emoji: '📦', color: '#8E8E93' },
};

export function getCategoryMeta(cat) {
  return CATEGORY_META[cat] || CATEGORY_META.Other;
}

// ─── Recipe Matching ──────────────────────────────────────────────────────────

export function getMatchLevel(matchPercent) {
  if (matchPercent >= 100) return 'ready';
  if (matchPercent >= 70)  return 'almost';
  if (matchPercent >= 40)  return 'partial';
  return 'low';
}

export function getMatchDots(matchPercent) {
  return Math.min(5, Math.max(0, Math.round((matchPercent || 0) / 20)));
}

// ─── Text Helpers ─────────────────────────────────────────────────────────────

export function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
