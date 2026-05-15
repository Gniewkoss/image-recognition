/**
 * FoodLens — "Everyday Kitchen" v2
 * Stack: Expo SDK 54 · React Native Animated · System fonts · expo-haptics
 */

import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, Alert,
  ScrollView, TextInput, Modal, KeyboardAvoidingView,
  Platform, Share, Dimensions, PanResponder, FlatList, Animated,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  SafeAreaProvider, useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { C, FONT, S, R, SHADOW } from './src/design';
import {
  buildServerUrl, humanizeApiError,
  formatScanDate, getIngredientCategory, getCategoryMeta,
  pluralize, capitalize,
} from './src/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');
const SERVER_URL = buildServerUrl();

const KEYS = {
  apiKey:      '@openai_api_key',
  favorites:   '@favorite_recipes',
  history:     '@scan_history',
  ingredients: '@current_ingredients',
  recipes:     '@current_recipes',
  shopping:    '@shopping_list',
};

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Haptic Helpers ───────────────────────────────────────────────────────────

const haptic = {
  light:   () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium:  () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// ─── Press — scale feedback with RN Animated ─────────────────────────────────

function Press({ onPress, style, children, scale = 0.97, hapticType = 'light', disabled }) {
  const s = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale: s }] }, style]}>
      <TouchableOpacity
        onPress={() => {
          if (disabled) return;
          if (hapticType) haptic[hapticType]?.();
          onPress?.();
        }}
        onPressIn={() =>
          Animated.spring(s, { toValue: scale, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
        }
        onPressOut={() =>
          Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
        }
        activeOpacity={1}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Three Dots loading indicator ────────────────────────────────────────────

function ThreeDots() {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    let running = true;
    function cycle() {
      if (!running) return;
      Animated.sequence([
        Animated.timing(vals[0], { toValue: 1,   duration: 200, useNativeDriver: true }),
        Animated.timing(vals[0], { toValue: 0.3, duration: 200, useNativeDriver: true }),
        Animated.timing(vals[1], { toValue: 1,   duration: 200, useNativeDriver: true }),
        Animated.timing(vals[1], { toValue: 0.3, duration: 200, useNativeDriver: true }),
        Animated.timing(vals[2], { toValue: 1,   duration: 200, useNativeDriver: true }),
        Animated.timing(vals[2], { toValue: 0.3, duration: 200, useNativeDriver: true }),
        Animated.delay(200),
      ]).start(() => { if (running) cycle(); });
    }
    cycle();
    return () => { running = false; };
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, opacity: v }}
        />
      ))}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <View style={ui.emptyWrap}>
      <View style={ui.emptyIconBg}>
        <Ionicons name={icon} size={28} color={C.inkTer} />
      </View>
      <Text style={ui.emptyTitle}>{title}</Text>
      <Text style={ui.emptySub}>{subtitle}</Text>
      {action && onAction && (
        <Press onPress={onAction} style={{ marginTop: S[5] }} hapticType="medium">
          <View style={ui.emptyBtn}>
            <Text style={ui.emptyBtnText}>{action}</Text>
          </View>
        </Press>
      )}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ text, right }) {
  return (
    <View style={ui.sectionHeaderRow}>
      <Text style={ui.sectionHeaderText}>{text.toUpperCase()}</Text>
      {right}
    </View>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onPress, onFavorite, isFavorited }) {
  const isReady = recipe.missing_count === 0;
  const total   = (recipe.matched_count || 0) + (recipe.missing_count || 0);
  const pct     = Math.round(recipe.match_percent || 0);
  const filled  = Math.min(5, Math.max(0, Math.round(pct / 20)));

  return (
    <Press onPress={onPress} scale={0.985} style={ui.card}>
      {/* Image */}
      <View style={ui.cardImgWrap}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={ui.cardImg} />
        ) : (
          <View style={ui.cardImgPlaceholder}>
            <Text style={{ fontSize: 48 }}>{recipe.emoji || '🍽️'}</Text>
          </View>
        )}

        {/* Match % badge */}
        {pct > 0 && (
          <View style={[ui.cardMatchBadge, isReady && ui.cardMatchBadgeReady]}>
            <Text style={ui.cardMatchBadgeText}>{pct}%</Text>
          </View>
        )}

        {/* Favorite */}
        <TouchableOpacity
          style={ui.cardFavBtn}
          onPress={e => { e.stopPropagation(); haptic.light(); onFavorite(recipe); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorited ? '#ff4d6d' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={ui.cardContent}>
        <Text style={ui.cardTitle} numberOfLines={2}>{recipe.name}</Text>

        <View style={ui.cardMetaRow}>
          <View style={ui.dotsRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <View
                key={i}
                style={[ui.dot, { backgroundColor: i < filled ? C.accent : C.accentDim }]}
              />
            ))}
          </View>
          {total > 0 && (
            <Text style={ui.cardMetaText}>{recipe.matched_count}/{total} ingredients</Text>
          )}
        </View>

        <View style={ui.cardTagRow}>
          {recipe.area && <View style={ui.cardTag}><Text style={ui.cardTagText}>{recipe.area}</Text></View>}
          {recipe.category && <View style={ui.cardTag}><Text style={ui.cardTagText}>{recipe.category}</Text></View>}
          {isReady && (
            <View style={[ui.cardTag, ui.cardTagReady]}>
              <Text style={[ui.cardTagText, { color: C.successText }]}>✓ Ready</Text>
            </View>
          )}
        </View>

        {recipe.missing_count > 0 && recipe.missing_ingredients?.length > 0 && (
          <Text style={ui.cardMissing} numberOfLines={1}>
            Missing: {recipe.missing_ingredients.slice(0, 3).join(', ')}
            {recipe.missing_ingredients.length > 3 ? '…' : ''}
          </Text>
        )}
      </View>
    </Press>
  );
}

// ─── Grid Card (Saved Favorites) ──────────────────────────────────────────────

function GridCard({ recipe, onPress }) {
  return (
    <Press onPress={onPress} scale={0.96} style={ui.gridCard}>
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={ui.gridCardImg} />
      ) : (
        <View style={[ui.gridCardImg, ui.gridCardPlaceholder]}>
          <Text style={{ fontSize: 28 }}>{recipe.emoji || '🍽️'}</Text>
        </View>
      )}
      <View style={ui.gridCardOverlay}>
        <Text style={ui.gridCardTitle} numberOfLines={2}>{recipe.name}</Text>
      </View>
    </Press>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────

function ApiKeyModal({ visible, onClose, value, onChange, onSave }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={ui.modalOverlay}
      >
        <View style={ui.modalSheet}>
          <View style={ui.modalHandle} />
          <View style={ui.modalIconRow}>
            <View style={ui.modalIconBg}>
              <Ionicons name="key-outline" size={22} color={C.accent} />
            </View>
          </View>
          <Text style={ui.modalTitle}>OpenAI API Key</Text>
          <Text style={ui.modalSub}>Required for AI ingredient detection</Text>

          <TextInput
            style={ui.input}
            placeholder="sk-…"
            placeholderTextColor={C.inkTer}
            value={value}
            onChangeText={onChange}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={ui.modalBtnRow}>
            <Press onPress={onClose} style={{ flex: 1 }}>
              <View style={ui.btnSecondary}>
                <Text style={ui.btnSecondaryText}>Cancel</Text>
              </View>
            </Press>
            <Press onPress={onSave} style={{ flex: 1 }} disabled={!value} hapticType="medium">
              <View style={[ui.btnAccent, !value && { opacity: 0.4 }]}>
                <Text style={ui.btnAccentText}>Save Key</Text>
              </View>
            </Press>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ScanScreen ───────────────────────────────────────────────────────────────

function ScanScreen({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes]         = useState([]);
  const [lastDate, setLastDate]       = useState(null);
  const [phase, setPhase]             = useState('idle');
  const [apiKey, setApiKey]           = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey]         = useState('');
  const insets = useSafeAreaInsets();

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(22)).current;
  const pulse   = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  const isLoading  = phase !== 'idle';
  const hasResults = recipes.length > 0 && !isLoading;

  const loadingLabel =
    phase === 'analyzing'  ? 'Scanning ingredients…'
    : phase === 'found'    ? `Found ${ingredients.length} ingredients!`
    : phase === 'searching'? 'Finding recipes…'
    : '';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, speed: 14, bounciness: 5, useNativeDriver: true }),
    ]).start();

    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, []);

  useEffect(() => {
    if (isLoading) pulseLoop.current?.stop();
    else           pulseLoop.current?.start();
  }, [isLoading]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  function openKeyModal() {
    setTempKey(apiKey); // pre-fill with existing key
    setShowKeyModal(true);
  }

  async function loadData() {
    try {
      const [k, ing, rec, hist] = await Promise.all([
        AsyncStorage.getItem(KEYS.apiKey),
        AsyncStorage.getItem(KEYS.ingredients),
        AsyncStorage.getItem(KEYS.recipes),
        AsyncStorage.getItem(KEYS.history),
      ]);
      if (k) setApiKey(k.trim());
      if (ing) setIngredients(JSON.parse(ing));
      if (rec) { const p = JSON.parse(rec); setRecipes(p.recipes || []); }
      if (hist) { const h = JSON.parse(hist); if (h.length) setLastDate(h[0].date); }
    } catch (e) { console.error(e); }
  }

  async function saveApiKey() {
    const k = tempKey.trim();
    if (!k) return;
    await AsyncStorage.setItem(KEYS.apiKey, k);
    setApiKey(k);
    setShowKeyModal(false);
    haptic.success();
  }

  async function startScan(useCamera) {
    if (!apiKey) { openKeyModal(); return; }
    haptic.medium();

    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow access to continue.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });

    if (!result.canceled && result.assets[0].base64) {
      analyzeImage(result.assets[0].base64, result.assets[0].uri);
    }
  }

  async function analyzeImage(base64, uri) {
    setPhase('analyzing');
    try {
      const r = await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ image_base64: base64, api_key: apiKey.trim() }),
      });
      const text = await r.text();
      if (!r.ok) throw new Error(humanizeApiError(text, r.status));

      let data;
      try { data = JSON.parse(text); } catch { throw new Error(humanizeApiError(text, r.status)); }

      const newIng = data.ingredients || [];
      setIngredients(newIng);
      await AsyncStorage.setItem(KEYS.ingredients, JSON.stringify(newIng));

      const entry = { id: Date.now().toString(), date: new Date().toISOString(), uri, ingredients: newIng };
      const hist  = await AsyncStorage.getItem(KEYS.history);
      await AsyncStorage.setItem(KEYS.history, JSON.stringify([entry, ...(hist ? JSON.parse(hist) : [])].slice(0, 30)));
      setLastDate(entry.date);

      setPhase('found');
      haptic.success();

      if (newIng.length > 0) await searchRecipes(newIng);
      else setPhase('idle');
    } catch (e) {
      Alert.alert('Analysis Failed', e.message || 'Could not analyze image.');
      setPhase('idle');
    }
  }

  async function searchRecipes(ing) {
    setPhase('searching');
    try {
      const r = await fetch(`${SERVER_URL}/search-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ ingredients: ing }),
      });
      const text = await r.text();
      if (!r.ok) throw new Error(humanizeApiError(text, r.status));

      let data;
      try { data = JSON.parse(text); } catch { throw new Error(humanizeApiError(text, r.status)); }

      const newRec = data.recipes || [];
      setRecipes(newRec);
      await AsyncStorage.setItem(KEYS.recipes, JSON.stringify({ recipes: newRec, categorized: data.categorized || {} }));

      setTimeout(() => {
        setPhase('idle');
        if (newRec.length > 0) navigation.navigate('Results', { recipes: newRec, ingredients: ing });
      }, 400);
    } catch (e) {
      Alert.alert('Search Failed', e.message || 'Could not find recipes.');
      setPhase('idle');
    }
  }

  async function clearResults() {
    haptic.light();
    setRecipes([]); setIngredients([]); setLastDate(null);
    await AsyncStorage.multiRemove([KEYS.ingredients, KEYS.recipes]);
  }

  const safeTop = insets.top || 44;

  // ── Has Previous Results ────────────────────────────────────────────────────
  if (hasResults) {
    return (
      <View style={sc.root}>
        <StatusBar style="dark" />
        <View style={{ height: safeTop }} />

        <View style={sc.header}>
          <View style={sc.logoRow}>
            <View style={sc.logoDot} />
            <Text style={sc.headerTitle}>FoodLens</Text>
          </View>
          <TouchableOpacity style={sc.settingsBtn} onPress={openKeyModal}>
            <Ionicons name="settings-outline" size={20} color={C.inkTer} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* Results summary card */}
          <View style={sc.resultCard}>
            <View style={sc.resultCardTop}>
              <View>
                <Text style={sc.resultCount}>{recipes.length}</Text>
                <Text style={sc.resultLabel}>{recipes.length === 1 ? 'recipe found' : 'recipes found'}</Text>
              </View>
              <View style={sc.resultRight}>
                <Text style={sc.resultIngCount}>{pluralize(ingredients.length, 'ingredient')}</Text>
                {lastDate && <Text style={sc.resultDate}>{formatScanDate(lastDate)}</Text>}
              </View>
            </View>
            <Press onPress={() => navigation.navigate('Results', { recipes, ingredients })} hapticType="medium">
              <View style={sc.resultViewBtn}>
                <Text style={sc.resultViewBtnText}>View All Recipes</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </Press>
          </View>

          {/* Detected ingredients */}
          <View style={{ paddingHorizontal: S[5], marginBottom: S[3] }}>
            <Text style={sc.sectionLabel}>DETECTED INGREDIENTS</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sc.chipsScroll}
            style={{ marginBottom: S[6] }}
          >
            {ingredients.map((ing, i) => (
              <View key={i} style={sc.ingChip}>
                <Text style={sc.ingChipText}>{capitalize(ing.name)}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={{ paddingHorizontal: S[5], gap: S[3] }}>
            <Press onPress={() => startScan(true)} hapticType="medium">
              <View style={sc.btnAccent}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={sc.btnAccentText}>Scan Again</Text>
              </View>
            </Press>
            <View style={sc.btnSmallRow}>
              <Press onPress={() => startScan(false)} style={{ flex: 1 }}>
                <View style={sc.btnSecSmall}>
                  <Text style={sc.btnSecSmallText}>Choose Photo</Text>
                </View>
              </Press>
              <TouchableOpacity style={[sc.btnSecSmall, { flex: 1 }]} onPress={clearResults}>
                <Text style={[sc.btnSecSmallText, { color: C.inkTer }]}>Clear Results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <ApiKeyModal
          visible={showKeyModal} onClose={() => setShowKeyModal(false)}
          value={tempKey} onChange={setTempKey} onSave={saveApiKey}
        />
      </View>
    );
  }

  // ── Empty / Loading State ───────────────────────────────────────────────────
  return (
    <View style={sc.root}>
      <StatusBar style="dark" />
      <View style={{ height: safeTop }} />

      {/* Header */}
      <View style={sc.header}>
        <View style={sc.logoRow}>
          <View style={sc.logoDot} />
          <Text style={sc.headerTitle}>FoodLens</Text>
        </View>
        <TouchableOpacity
          style={[sc.settingsBtn, !apiKey && sc.settingsBtnAlert]}
          onPress={openKeyModal}
        >
          <Ionicons
            name={apiKey ? 'settings-outline' : 'key-outline'}
            size={20}
            color={apiKey ? C.inkTer : C.accent}
          />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={sc.scrollContent}
        style={{ flex: 1, opacity: fadeIn }}
      >
        {/* Hero */}
        <Animated.View style={[sc.heroSection, { transform: [{ translateY: slideUp }] }]}>
          <View style={sc.heroBadge}>
            <Text style={sc.heroBadgeText}>✦ AI-POWERED KITCHEN ASSISTANT</Text>
          </View>
          <Text style={sc.heroTitle}>What's in{'\n'}your fridge?</Text>
          <Text style={sc.heroSub}>
            Snap a photo of your ingredients — get instant recipes you can cook right now.
          </Text>
        </Animated.View>

        {/* Scan zone */}
        <TouchableOpacity
          style={sc.scanZone}
          onPress={() => !isLoading && startScan(true)}
          activeOpacity={isLoading ? 1 : 0.82}
        >
          {isLoading ? (
            <View style={sc.scanZoneInner}>
              <ThreeDots />
              <Text style={sc.scanLoadingText}>{loadingLabel}</Text>
            </View>
          ) : (
            <View style={sc.scanZoneInner}>
              <Animated.View style={[sc.scanIconRing, { transform: [{ scale: pulse }] }]}>
                <Ionicons name="camera" size={34} color={C.accent} />
              </Animated.View>
              <Text style={sc.scanCardTitle}>Tap to scan</Text>
              <Text style={sc.scanCardSub}>Opens camera instantly</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Feature highlights */}
        <View style={sc.featureRow}>
          {[
            { icon: 'scan-outline',       text: 'Instant scan' },
            { icon: 'bulb-outline',       text: 'AI detection' },
            { icon: 'restaurant-outline', text: 'Recipe match' },
          ].map((f, i) => (
            <View key={i} style={sc.featureChip}>
              <Ionicons name={f.icon} size={13} color={C.inkSub} />
              <Text style={sc.featureChipText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA buttons */}
        <View style={sc.btnStack}>
          <Press onPress={() => startScan(true)} hapticType="medium" disabled={isLoading}>
            <View style={[sc.btnPrimary, isLoading && { opacity: 0.38 }]}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={sc.btnPrimaryText}>Take Photo</Text>
            </View>
          </Press>
          <View style={sc.btnSmallRow}>
            <Press onPress={() => startScan(false)} style={{ flex: 1 }} disabled={isLoading}>
              <View style={[sc.btnSecSmall, isLoading && { opacity: 0.38 }]}>
                <Text style={sc.btnSecSmallText}>Choose Photo</Text>
              </View>
            </Press>
            <Press onPress={() => navigation.navigate('KitchenTab')} style={{ flex: 1 }} disabled={isLoading}>
              <View style={sc.btnSecSmall}>
                <Text style={sc.btnSecSmallText}>Add Manually</Text>
              </View>
            </Press>
          </View>
        </View>
      </Animated.ScrollView>

      <ApiKeyModal
        visible={showKeyModal} onClose={() => setShowKeyModal(false)}
        value={tempKey} onChange={setTempKey} onSave={saveApiKey}
      />
    </View>
  );
}

// ─── ResultsScreen ────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: 'all',    label: 'All' },
  { id: 'ready',  label: 'Ready' },
  { id: 'almost', label: 'Almost' },
  { id: 'shop',   label: 'Missing 1–2' },
];

function ResultsScreen({ route, navigation }) {
  const { recipes = [], ingredients = [] } = route.params || {};
  const [filter, setFilter]       = useState('all');
  const [favorites, setFavorites] = useState([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(KEYS.favorites).then(s => {
      if (s) setFavorites(JSON.parse(s));
    });
  }, []);

  async function toggleFav(recipe) {
    haptic.light();
    const isFav = favorites.some(f => f.id === recipe.id);
    const upd   = isFav
      ? favorites.filter(f => f.id !== recipe.id)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...favorites];
    setFavorites(upd);
    await AsyncStorage.setItem(KEYS.favorites, JSON.stringify(upd));
  }

  const isFaved = recipe => favorites.some(f => f.id === recipe.id);

  const counts = {
    all:    recipes.length,
    ready:  recipes.filter(r => r.missing_count === 0).length,
    almost: recipes.filter(r => r.missing_count > 0 && r.missing_count <= 2).length,
    shop:   recipes.filter(r => r.missing_count > 2).length,
  };

  const visible = recipes.filter(r => {
    if (filter === 'all')    return true;
    if (filter === 'ready')  return r.missing_count === 0;
    if (filter === 'almost') return r.missing_count > 0 && r.missing_count <= 2;
    if (filter === 'shop')   return r.missing_count > 2;
    return true;
  });

  return (
    <View style={[re.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={re.header}>
        <Press onPress={() => navigation.goBack()} scale={0.9}>
          <View style={re.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </View>
        </Press>
        <View style={{ flex: 1 }}>
          <Text style={re.headerTitle}>Recipes for you</Text>
          {ingredients.length > 0 && (
            <Text style={re.headerSub}>{pluralize(ingredients.length, 'ingredient')} scanned</Text>
          )}
        </View>
        <View style={re.headerBadge}>
          <Text style={re.headerBadgeText}>{recipes.length}</Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={re.filterRow}
        style={re.filterBar}
      >
        {FILTER_TABS.map(tab => {
          const isActive = filter === tab.id;
          const count    = counts[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              style={[re.filterChip, isActive && re.filterChipActive]}
              onPress={() => { haptic.light(); setFilter(tab.id); }}
              activeOpacity={0.8}
            >
              <Text style={[re.filterChipText, isActive && re.filterChipTextActive]}>
                {tab.label}
                {count > 0 ? `  ${count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Recipe list */}
      <FlatList
        data={visible}
        keyExtractor={(item, i) => `${item.id}-${i}`}
        contentContainerStyle={re.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No recipes found"
            subtitle="Try a different filter or scan more ingredients."
            action="Show all"
            onAction={() => setFilter('all')}
          />
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => {
              haptic.light();
              navigation.navigate('RecipeDetail', { recipe: item, userIngredients: ingredients });
            }}
            onFavorite={toggleFav}
            isFavorited={isFaved(item)}
          />
        )}
      />
    </View>
  );
}

// ─── KitchenScreen ────────────────────────────────────────────────────────────

function KitchenScreen({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipesCount, setRecipesCount] = useState(0);
  const [readyCount, setReadyCount]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [editIdx, setEditIdx]         = useState(null);
  const [editName, setEditName]       = useState('');
  const [editQty, setEditQty]         = useState('');
  const [newName, setNewName]         = useState('');
  const [newQty, setNewQty]           = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  async function load() {
    try {
      const [i, r] = await Promise.all([
        AsyncStorage.getItem(KEYS.ingredients),
        AsyncStorage.getItem(KEYS.recipes),
      ]);
      if (i) setIngredients(JSON.parse(i));
      if (r) {
        const p = JSON.parse(r);
        const recs = p.recipes || [];
        setRecipesCount(recs.length);
        setReadyCount(recs.filter(x => x.missing_count === 0).length);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function save(updated) {
    setIngredients(updated);
    await AsyncStorage.setItem(KEYS.ingredients, JSON.stringify(updated));
  }

  function deleteIng(idx) {
    Alert.alert('Remove', 'Remove this ingredient?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        haptic.medium(); save(ingredients.filter((_, i) => i !== idx)); setEditIdx(null);
      }},
    ]);
  }

  function openEdit(idx) {
    haptic.light();
    setEditIdx(idx);
    setEditName(ingredients[idx].name);
    setEditQty(ingredients[idx].quantity || '');
  }

  function saveEdit() {
    if (!editName.trim()) return;
    const upd = [...ingredients];
    upd[editIdx] = { name: editName.trim(), quantity: editQty.trim() };
    save(upd);
    setEditIdx(null);
    haptic.success();
  }

  function addIng() {
    if (!newName.trim()) return;
    save([...ingredients, { name: newName.trim(), quantity: newQty.trim() }]);
    setNewName(''); setNewQty(''); setShowAdd(false);
    haptic.success();
  }

  const grouped = {};
  ingredients.forEach((ing, idx) => {
    const cat = getIngredientCategory(ing.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...ing, idx });
  });
  const CAT_ORDER = ['Proteins', 'Dairy', 'Vegetables', 'Fruits', 'Grains', 'Condiments', 'Other'];
  const cats = CAT_ORDER.filter(c => grouped[c]);

  return (
    <View style={ki.root}>
      <StatusBar style="dark" />
      <View style={{ height: insets.top || 44 }} />

      <View style={ki.header}>
        <Text style={ki.headerTitle}>Kitchen</Text>
        <Press onPress={() => { haptic.light(); setShowAdd(true); }} scale={0.9}>
          <View style={ki.addIconBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        </Press>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Stat card */}
        {loading ? (
          <View style={ki.statCard}>
            <Text style={ki.statLoading}>Loading…</Text>
          </View>
        ) : recipesCount > 0 ? (
          <TouchableOpacity
            style={ki.statCard}
            onPress={async () => {
              haptic.light();
              const s  = await AsyncStorage.getItem(KEYS.recipes);
              const si = await AsyncStorage.getItem(KEYS.ingredients);
              if (s) {
                const p = JSON.parse(s);
                navigation.navigate('Results', { recipes: p.recipes || [], ingredients: si ? JSON.parse(si) : [] });
              }
            }}
            activeOpacity={0.75}
          >
            <View style={ki.statCardInner}>
              <View>
                <Text style={ki.statNumber}>{recipesCount}</Text>
                <Text style={ki.statLabel}>{recipesCount === 1 ? 'recipe ready' : 'recipes ready'}</Text>
                <Text style={ki.statSub}>
                  From {pluralize(ingredients.length, 'ingredient')}
                  {readyCount > 0 ? ` · ${readyCount} complete` : ''}
                </Text>
              </View>
              <View style={ki.statArrow}>
                <Ionicons name="arrow-forward" size={18} color={C.accent} />
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowAdd(true)} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={ki.updateLink}>Update ingredients →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View style={ki.statCard}>
            <Text style={ki.statNumber}>{ingredients.length}</Text>
            <Text style={ki.statLabel}>{ingredients.length === 1 ? 'ingredient' : 'ingredients'}</Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={ki.updateLink}>Add ingredients →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ingredients by category */}
        {loading ? null : ingredients.length === 0 ? (
          <EmptyState
            icon="nutrition-outline"
            title="Your pantry is empty"
            subtitle="Scan your fridge or add items manually to get started."
            action="Scan Fridge"
            onAction={() => navigation.navigate('ScanTab')}
          />
        ) : (
          <View style={ki.categories}>
            <SectionHeader text="Your Ingredients" />
            {cats.map(cat => {
              const meta = getCategoryMeta(cat);
              return (
                <View key={cat} style={ki.catSection}>
                  <Text style={ki.catLabel}>{meta.emoji} {cat}</Text>
                  <View style={ki.chipRow}>
                    {grouped[cat].map(({ name, quantity, idx }) => (
                      <Press key={idx} onPress={() => openEdit(idx)} scale={0.95} hapticType="light">
                        <View style={ki.chip}>
                          <Text style={ki.chipText}>{capitalize(name)}</Text>
                          {quantity ? <Text style={ki.chipQty}> · {quantity}</Text> : null}
                        </View>
                      </Press>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={ki.addRow} onPress={() => { haptic.light(); setShowAdd(true); }}>
          <Ionicons name="add-circle-outline" size={18} color={C.accent} />
          <Text style={ki.addRowText}>Add ingredient</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editIdx !== null} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalOverlay}>
          <View style={ui.modalSheet}>
            <View style={ui.modalHandle} />
            <Text style={ui.modalTitle}>Edit ingredient</Text>
            <TextInput style={ui.input} placeholder="Name" value={editName} onChangeText={setEditName} placeholderTextColor={C.inkTer} />
            <TextInput style={ui.input} placeholder="Quantity (optional)" value={editQty} onChangeText={setEditQty} placeholderTextColor={C.inkTer} />
            <View style={ui.modalBtnRow}>
              <Press onPress={() => deleteIng(editIdx)} style={{ flex: 1 }}>
                <View style={ui.btnDanger}><Text style={ui.btnDangerText}>Remove</Text></View>
              </Press>
              <Press onPress={() => setEditIdx(null)} style={{ flex: 1 }}>
                <View style={ui.btnSecondary}><Text style={ui.btnSecondaryText}>Cancel</Text></View>
              </Press>
              <Press onPress={saveEdit} style={{ flex: 1 }} hapticType="medium">
                <View style={ui.btnAccent}><Text style={ui.btnAccentText}>Save</Text></View>
              </Press>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalOverlay}>
          <View style={ui.modalSheet}>
            <View style={ui.modalHandle} />
            <Text style={ui.modalTitle}>Add ingredient</Text>
            <TextInput style={ui.input} placeholder="Name" value={newName} onChangeText={setNewName} autoFocus placeholderTextColor={C.inkTer} />
            <TextInput style={ui.input} placeholder="Quantity (optional)" value={newQty} onChangeText={setNewQty} placeholderTextColor={C.inkTer} />
            <View style={ui.modalBtnRow}>
              <Press onPress={() => setShowAdd(false)} style={{ flex: 1 }}>
                <View style={ui.btnSecondary}><Text style={ui.btnSecondaryText}>Cancel</Text></View>
              </Press>
              <Press onPress={addIng} style={{ flex: 2 }} hapticType="medium">
                <View style={[ui.btnAccent, !newName.trim() && { opacity: 0.4 }]}>
                  <Text style={ui.btnAccentText}>Add</Text>
                </View>
              </Press>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── SavedScreen ──────────────────────────────────────────────────────────────

const SAVED_TABS = ['Shopping', 'Favorites', 'History'];

function SavedScreen({ navigation }) {
  const [savedTab, setSavedTab]         = useState(0);
  const [favorites, setFavorites]       = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [history, setHistory]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showInput, setShowInput]       = useState(false);
  const [newItem, setNewItem]           = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    return unsub;
  }, [navigation]);

  async function loadAll() {
    try {
      const [f, s, h] = await Promise.all([
        AsyncStorage.getItem(KEYS.favorites),
        AsyncStorage.getItem(KEYS.shopping),
        AsyncStorage.getItem(KEYS.history),
      ]);
      if (f) setFavorites(JSON.parse(f));
      if (s) setShoppingList(JSON.parse(s));
      if (h) setHistory(JSON.parse(h).slice(0, 10));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveList(list) {
    setShoppingList(list);
    await AsyncStorage.setItem(KEYS.shopping, JSON.stringify(list));
  }

  function toggleItem(i) {
    haptic.light();
    const upd = [...shoppingList];
    upd[i] = { ...upd[i], checked: !upd[i].checked };
    saveList(upd);
  }

  function addItem() {
    if (!newItem.trim()) return;
    saveList([...shoppingList, { name: newItem.trim(), checked: false }]);
    setNewItem(''); setShowInput(false);
    haptic.success();
  }

  async function removeFav(recipe) {
    haptic.light();
    const upd = favorites.filter(f => f.id !== recipe.id);
    setFavorites(upd);
    await AsyncStorage.setItem(KEYS.favorites, JSON.stringify(upd));
  }

  async function shareList() {
    const items = shoppingList.filter(i => !i.checked);
    if (!items.length) { Alert.alert('Empty', 'No items to share.'); return; }
    await Share.share({
      message: `Shopping List\n\n${items.map(i => `☐ ${i.name}${i.recipeName ? ` (${i.recipeName})` : ''}`).join('\n')}`,
    });
  }

  return (
    <View style={sv.root}>
      <StatusBar style="dark" />
      <View style={{ height: insets.top || 44 }} />

      <View style={sv.header}>
        <Text style={sv.headerTitle}>Saved</Text>
      </View>

      {/* Segmented control */}
      <View style={sv.segWrapper}>
        {SAVED_TABS.map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[sv.segment, savedTab === i && sv.segmentActive]}
            onPress={() => { haptic.light(); setSavedTab(i); }}
            activeOpacity={0.8}
          >
            <Text style={[sv.segLabel, savedTab === i && sv.segLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Shopping */}
      {savedTab === 0 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={sv.tabContent}>
            <View style={sv.sectionActions}>
              {shoppingList.length > 0 && (
                <TouchableOpacity onPress={shareList} style={sv.iconAction}>
                  <Ionicons name="share-outline" size={20} color={C.inkSub} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { haptic.light(); setShowInput(v => !v); }} style={sv.iconAction}>
                <Ionicons name={showInput ? 'close' : 'add'} size={22} color={C.accent} />
              </TouchableOpacity>
            </View>

            {showInput && (
              <View style={sv.addRow}>
                <TextInput
                  style={sv.addInput}
                  placeholder="Add item…"
                  placeholderTextColor={C.inkTer}
                  value={newItem}
                  onChangeText={setNewItem}
                  onSubmitEditing={addItem}
                  returnKeyType="done"
                  autoFocus
                />
                <Press onPress={addItem} hapticType="medium">
                  <View style={sv.addBtn}><Text style={sv.addBtnText}>Add</Text></View>
                </Press>
              </View>
            )}

            {loading ? (
              <Text style={sv.loadingText}>Loading…</Text>
            ) : shoppingList.length === 0 ? (
              <EmptyState
                icon="cart-outline"
                title="Shopping list is empty"
                subtitle="Add items here, or save missing ingredients from any recipe."
              />
            ) : (
              <View style={{ gap: 1 }}>
                {shoppingList.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={sv.shoppingRow}
                    onPress={() => toggleItem(idx)}
                    activeOpacity={0.85}
                  >
                    <View style={[sv.checkbox, item.checked && sv.checkboxDone]}>
                      {item.checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[sv.itemName, item.checked && sv.itemNameDone]}>{item.name}</Text>
                      {item.recipeName && <Text style={sv.itemRecipe}>{item.recipeName}</Text>}
                    </View>
                    <TouchableOpacity
                      onPress={() => { haptic.light(); saveList(shoppingList.filter((_, i) => i !== idx)); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={15} color={C.inkTer} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                {shoppingList.filter(i => i.checked).length > 0 && (
                  <TouchableOpacity
                    style={sv.clearDoneBtn}
                    onPress={() => { haptic.light(); saveList(shoppingList.filter(i => !i.checked)); }}
                  >
                    <Ionicons name="trash-outline" size={13} color={C.danger} />
                    <Text style={sv.clearDoneText}>
                      Clear {shoppingList.filter(i => i.checked).length} checked
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Favorites */}
      {savedTab === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={sv.tabContent}>
            {loading ? (
              <Text style={sv.loadingText}>Loading…</Text>
            ) : favorites.length === 0 ? (
              <EmptyState
                icon="heart-outline"
                title="No saved recipes yet"
                subtitle="Tap the heart on any recipe to save it here."
                action="Browse Recipes"
                onAction={() => navigation.navigate('ScanTab')}
              />
            ) : (
              <View style={sv.favGrid}>
                {favorites.map((rec, i) => (
                  <GridCard
                    key={`${rec.id}-${i}`}
                    recipe={rec}
                    onPress={() => { haptic.light(); navigation.navigate('RecipeDetail', { recipe: rec }); }}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* History */}
      {savedTab === 2 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={sv.tabContent}>
            {loading ? (
              <Text style={sv.loadingText}>Loading…</Text>
            ) : history.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="No scans yet"
                subtitle="Start by scanning your fridge or pantry to build your history."
                action="Scan Now"
                onAction={() => navigation.navigate('ScanTab')}
              />
            ) : (
              history.map(entry => (
                <View key={entry.id} style={sv.historyRow}>
                  {entry.uri ? (
                    <Image source={{ uri: entry.uri }} style={sv.historyThumb} />
                  ) : (
                    <View style={[sv.historyThumb, sv.historyThumbEmpty]}>
                      <Ionicons name="camera-outline" size={18} color={C.inkTer} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={sv.historyIngredients}>
                      {pluralize(entry.ingredients?.length || 0, 'ingredient')}
                    </Text>
                    <Text style={sv.historyDate}>{formatScanDate(entry.date)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── RecipeDetailScreen ───────────────────────────────────────────────────────

function RecipeDetailScreen({ route, navigation }) {
  const { recipe, userIngredients = [] } = route.params;
  const [isFaved, setIsFaved] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(KEYS.favorites).then(s => {
      if (s) setIsFaved(JSON.parse(s).some(f => f.id === recipe.id));
    });
  }, []);

  async function toggleFav() {
    haptic.medium();
    const s = await AsyncStorage.getItem(KEYS.favorites);
    let favs = s ? JSON.parse(s) : [];
    favs = isFaved
      ? favs.filter(f => f.id !== recipe.id)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...favs];
    await AsyncStorage.setItem(KEYS.favorites, JSON.stringify(favs));
    setIsFaved(!isFaved);
    if (!isFaved) haptic.success();
  }

  async function addMissing() {
    const missing = recipe.missing_ingredients || [];
    if (!missing.length) { Alert.alert('All Set!', 'You have all ingredients.'); return; }
    const s    = await AsyncStorage.getItem(KEYS.shopping);
    const list = s ? JSON.parse(s) : [];
    const existing = list.map(i => i.name.toLowerCase());
    const newItems  = missing
      .filter(m => !existing.includes(m.toLowerCase()))
      .map(name => ({ name, checked: false, recipeName: recipe.name }));
    if (!newItems.length) { Alert.alert('Already Added', 'All missing items are in your list.'); return; }
    await AsyncStorage.setItem(KEYS.shopping, JSON.stringify([...list, ...newItems]));
    haptic.success();
    Alert.alert('Added!', `${pluralize(newItems.length, 'item')} added to your shopping list.`);
  }

  const total   = (recipe.matched_count || 0) + (recipe.missing_count || 0);
  const isReady = recipe.missing_count === 0;
  const hasCook = recipe.steps?.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={{ height: 280, backgroundColor: C.surface }}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.accentTint }}>
              <Text style={{ fontSize: 88 }}>{recipe.emoji || '🍽️'}</Text>
            </View>
          )}
          {/* Bottom fade overlay */}
          <View style={de.heroFade} />
          {/* Nav bar overlay */}
          <View style={[de.nav, { paddingTop: insets.top + S[2] }]}>
            <Press onPress={() => navigation.goBack()} scale={0.9}>
              <View style={de.navBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </View>
            </Press>
            <View style={{ flexDirection: 'row', gap: S[2] }}>
              {recipe.youtube && (
                <Press onPress={() => Linking.openURL(recipe.youtube)} scale={0.9}>
                  <View style={de.navBtn}>
                    <Ionicons name="logo-youtube" size={20} color="#FF3B30" />
                  </View>
                </Press>
              )}
              <Press onPress={toggleFav} scale={0.9}>
                <View style={de.navBtn}>
                  <Ionicons
                    name={isFaved ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isFaved ? '#ff4d6d' : '#fff'}
                  />
                </View>
              </Press>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={de.content}>
          <Text style={de.title}>{recipe.name}</Text>

          {/* Meta chips */}
          <View style={de.chipRow}>
            {recipe.area && <View style={de.chip}><Text style={de.chipText}>{recipe.area}</Text></View>}
            {recipe.category && <View style={de.chip}><Text style={de.chipText}>{recipe.category}</Text></View>}
            {isReady ? (
              <View style={[de.chip, de.chipReady]}>
                <Text style={[de.chipText, { color: C.successText }]}>✓ Ready to cook</Text>
              </View>
            ) : recipe.missing_count > 0 && (
              <View style={[de.chip, de.chipMissing]}>
                <Text style={[de.chipText, { color: C.amberText }]}>Missing {recipe.missing_count}</Text>
              </View>
            )}
          </View>

          {/* CTA */}
          {hasCook && (
            <Press
              onPress={() => { haptic.medium(); navigation.navigate('CookMode', { recipe }); }}
              hapticType="medium"
              style={{ marginBottom: S[5] }}
            >
              <View style={de.cookBtn}>
                <Ionicons name="flame-outline" size={20} color="#fff" />
                <Text style={de.cookBtnText}>Start Cooking</Text>
              </View>
            </Press>
          )}

          {/* Missing ingredients */}
          {recipe.missing_ingredients?.length > 0 && (
            <View style={de.missingCard}>
              <View style={de.missingSectionRow}>
                <Text style={de.missingSectionTitle}>MISSING</Text>
                <TouchableOpacity onPress={addMissing}>
                  <Text style={de.addToListText}>+ Add to list</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S[2] }}>
                {recipe.missing_ingredients.map((m, i) => (
                  <View key={i} style={de.missingPill}>
                    <Text style={de.missingPillText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Ingredients */}
          {recipe.ingredients?.length > 0 && (
            <View style={de.section}>
              <Text style={de.sectionTitle}>INGREDIENTS</Text>
              {recipe.ingredients.map((ing, i) => {
                const have = recipe.matched_ingredients?.some(m =>
                  m.toLowerCase().includes(ing.name.toLowerCase()) ||
                  ing.name.toLowerCase().includes(m.toLowerCase())
                );
                return (
                  <View key={i} style={[de.ingRow, i < recipe.ingredients.length - 1 && de.ingRowBorder]}>
                    <View style={[de.ingDot, { backgroundColor: have ? C.successBg : C.surface }]}>
                      <Ionicons name={have ? 'checkmark' : 'remove'} size={11} color={have ? C.success : C.inkTer} />
                    </View>
                    <Text style={de.ingMeasure} numberOfLines={1}>{ing.measure}</Text>
                    <Text style={[de.ingName, !have && { color: C.inkTer }]}>{ing.name}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Steps */}
          {recipe.steps?.length > 0 && (
            <View style={de.section}>
              <Text style={de.sectionTitle}>STEPS</Text>
              {recipe.steps.map((step, i) => (
                <View key={i} style={de.stepRow}>
                  <View style={de.stepNumBadge}>
                    <Text style={de.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={de.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Secondary actions */}
          <View style={de.secActions}>
            <Press onPress={toggleFav} style={{ flex: 1 }}>
              <View style={de.secBtn}>
                <Ionicons name={isFaved ? 'heart' : 'heart-outline'} size={17} color={isFaved ? C.danger : C.accent} />
                <Text style={de.secBtnText}>{isFaved ? 'Saved' : 'Save'}</Text>
              </View>
            </Press>
            {(recipe.source || recipe.youtube) && (
              <Press onPress={() => Linking.openURL(recipe.source || recipe.youtube)} style={{ flex: 1 }}>
                <View style={de.secBtn}>
                  <Ionicons name="open-outline" size={17} color={C.accent} />
                  <Text style={de.secBtnText}>Source</Text>
                </View>
              </Press>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── CookModeScreen ───────────────────────────────────────────────────────────

function CookModeScreen({ route, navigation }) {
  const { recipe } = route.params;
  const steps = recipe.steps || [];
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const insets = useSafeAreaInsets();

  const progress = useRef(new Animated.Value(0)).current;
  const textOp   = useRef(new Animated.Value(1)).current;
  const textTy   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pct = steps.length > 1 ? step / (steps.length - 1) : 1;
    Animated.timing(progress, { toValue: pct, duration: 280, useNativeDriver: false }).start();
  }, [step]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, W],
  });

  function animStep(direction, cb) {
    Animated.parallel([
      Animated.timing(textOp, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(textTy, { toValue: direction * -14, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      cb();
      textTy.setValue(direction * 14);
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(textTy, { toValue: 0, useNativeDriver: true, speed: 20 }),
      ]).start();
    });
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dy) < 60,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && step < steps.length - 1) goNext();
        if (g.dx > 50  && step > 0)               goPrev();
      },
    })
  ).current;

  function goNext() {
    if (step < steps.length - 1) {
      haptic.medium();
      animStep(1, () => setStep(s => s + 1));
    } else {
      haptic.success();
      setDone(true);
    }
  }

  function goPrev() {
    if (step > 0) {
      haptic.light();
      animStep(-1, () => setStep(s => s - 1));
    }
  }

  const isLast = step === steps.length - 1;

  if (!steps.length) {
    return (
      <View style={[cm.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <EmptyState icon="reader-outline" title="No instructions" subtitle="This recipe has no steps." />
        <TouchableOpacity style={cm.exitBtn} onPress={() => navigation.goBack()}>
          <Text style={cm.exitBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[cm.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="dark" />
        <View style={cm.doneCheck}>
          <Ionicons name="checkmark" size={36} color={C.success} />
        </View>
        <Text style={cm.doneTitle}>Recipe complete!</Text>
        <Text style={cm.doneSub}>Enjoy your meal.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: S[5] }}>
          <Text style={cm.doneLink}>Back to recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[cm.root, { paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <StatusBar style="dark" />

      {/* Progress bar */}
      <View style={cm.progressTrack}>
        <Animated.View style={[cm.progressFill, { width: progressWidth }]} />
      </View>

      {/* Top bar */}
      <View style={cm.topBar}>
        <View>
          <Text style={cm.stepLabel}>STEP {step + 1} OF {steps.length}</Text>
          <Text style={cm.recipeName} numberOfLines={1}>{recipe.name}</Text>
        </View>
        <TouchableOpacity
          style={cm.closeBtn}
          onPress={() => { haptic.light(); navigation.goBack(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={C.inkSub} />
        </TouchableOpacity>
      </View>

      {/* Step text */}
      <Animated.View style={[cm.stepContent, { opacity: textOp, transform: [{ translateY: textTy }] }]}>
        <Text style={cm.stepText}>{steps[step]}</Text>
      </Animated.View>

      {/* Swipe hint */}
      <Text style={cm.swipeHint}>Swipe left/right to navigate</Text>

      {/* Navigation */}
      <View style={[cm.navRow, { paddingBottom: Math.max(insets.bottom, S[4]) + S[4] }]}>
        <TouchableOpacity
          style={[cm.navBack, step === 0 && { opacity: 0.3 }]}
          onPress={goPrev}
          disabled={step === 0}
        >
          <Ionicons name="chevron-back" size={20} color={C.inkSub} />
          <Text style={cm.navBackText}>Back</Text>
        </TouchableOpacity>

        <Press onPress={goNext} scale={0.97} style={cm.navNextWrap} hapticType="medium">
          <View style={cm.navNext}>
            <Text style={cm.navNextText}>{isLast ? 'Done' : 'Next'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'chevron-forward'} size={20} color="#fff" />
          </View>
        </Press>
      </View>
    </View>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          tb.bar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
        ],
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.inkTer,
        tabBarLabelStyle: tb.label,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scan-circle' : 'scan-circle-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="KitchenTab"
        component={KitchenScreen}
        options={{
          tabBarLabel: 'Kitchen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SavedTab"
        component={SavedScreen}
        options={{
          tabBarLabel: 'Saved',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen name="CookMode" component={CookModeScreen} options={{ animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// ── Global UI ─────────────────────────────────────────────────────────────────
const ui = StyleSheet.create({
  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: S[10],
    paddingHorizontal: S[8],
  },
  emptyIconBg: {
    width: 64, height: 64, borderRadius: R.card,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[5],
    borderWidth: 1, borderColor: C.border,
  },
  emptyTitle: {
    fontSize: FONT.md, fontWeight: '600',
    color: C.ink,
    marginBottom: S[2], textAlign: 'center',
    letterSpacing: FONT.snug,
  },
  emptySub: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    textAlign: 'center',
    lineHeight: FONT.base * 1.5,
  },
  emptyBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: S[6], paddingVertical: S[3] + 2,
    borderRadius: R.btn,
  },
  emptyBtnText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: '#fff',
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S[3],
  },
  sectionHeaderText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.inkTer,
    textTransform: 'uppercase',
    letterSpacing: FONT.cap,
  },

  // Recipe card
  card: {
    backgroundColor: C.white,
    borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  cardImgWrap: {
    height: 188,
    backgroundColor: C.surface,
  },
  cardImg: {
    width: '100%', height: '100%', resizeMode: 'cover',
  },
  cardImgPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  cardMatchBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: R.chip,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cardMatchBadgeReady: {
    backgroundColor: C.success,
  },
  cardMatchBadgeText: {
    fontSize: 11, fontWeight: '700',
    color: '#fff',
  },
  cardFavBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.30)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardContent: {
    padding: S[4],
    gap: S[2],
  },
  cardTitle: {
    fontSize: FONT.md, fontWeight: '600',
    color: C.ink,
    letterSpacing: FONT.snug,
    lineHeight: FONT.md * 1.35,
  },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: S[3],
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  cardMetaText: {
    fontSize: FONT.sm, fontWeight: '400',
    color: C.inkSub,
  },
  cardTagRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: S[2],
  },
  cardTag: {
    paddingHorizontal: S[2] + 2, paddingVertical: 4,
    borderRadius: R.chip,
    borderWidth: 1, borderColor: C.border,
  },
  cardTagText: {
    fontSize: FONT.xs, fontWeight: '500',
    color: C.inkSub,
    letterSpacing: FONT.wide,
  },
  cardTagReady: {
    backgroundColor: C.successBg,
    borderColor: C.successBg,
  },
  cardMissing: {
    fontSize: FONT.sm, fontWeight: '400',
    color: C.amber,
  },

  // Grid card
  gridCard: {
    width: (W - S[5] * 2 - S[3]) / 2,
    aspectRatio: 1,
    borderRadius: R.btn,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  gridCardImg: {
    width: '100%', height: '100%', resizeMode: 'cover',
    position: 'absolute',
  },
  gridCardPlaceholder: {
    justifyContent: 'center', alignItems: 'center',
  },
  gridCardOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: S[3], paddingBottom: S[3],
    paddingTop: S[8],
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  gridCardTitle: {
    fontSize: FONT.sm, fontWeight: '600',
    color: '#fff',
    lineHeight: FONT.sm * 1.4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    padding: S[6],
    paddingBottom: S[12],
    ...SHADOW.float,
  },
  modalHandle: {
    width: 36, height: 4,
    backgroundColor: C.border,
    borderRadius: R.full,
    alignSelf: 'center',
    marginBottom: S[5],
  },
  modalIconRow: { alignItems: 'center', marginBottom: S[4] },
  modalIconBg: {
    width: 52, height: 52, borderRadius: R.btn,
    backgroundColor: C.accentTint,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: `${C.accent}25`,
  },
  modalTitle: {
    fontSize: FONT.lg, fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
    marginBottom: S[1],
    letterSpacing: FONT.snug,
  },
  modalSub: {
    fontSize: FONT.sm, fontWeight: '400',
    color: C.inkSub,
    textAlign: 'center',
    marginBottom: S[5],
  },

  // Input
  input: {
    height: 52,
    backgroundColor: C.surface,
    borderRadius: R.btn,
    paddingHorizontal: S[4],
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
    marginBottom: S[3],
    borderWidth: 1.5,
    borderColor: C.border,
  },

  // Button row
  modalBtnRow: {
    flexDirection: 'row', gap: S[2], marginTop: S[2],
  },

  // Buttons
  btnAccent: {
    height: 52, borderRadius: R.btn,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  btnAccentText: {
    fontSize: FONT.base, fontWeight: '600',
    color: '#fff',
  },
  btnOutline: {
    height: 52, borderRadius: R.btn,
    backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.accent,
  },
  btnSecondary: {
    height: 52, borderRadius: R.btn,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.inkSub,
  },
  btnDanger: {
    height: 52, borderRadius: R.btn,
    backgroundColor: C.dangerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDangerText: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.danger,
  },
});

// ── Scan Screen ────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[5],
    paddingVertical: S[3],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  logoDot: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: C.accent,
  },
  headerTitle: {
    fontSize: FONT.md, fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.snug,
  },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  settingsBtnAlert: {
    backgroundColor: C.accentTint,
    borderColor: `${C.accent}30`,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: S[5],
    paddingTop: S[2],
    paddingBottom: 48,
  },

  // Hero
  heroSection: {
    marginBottom: S[6],
    paddingTop: S[2],
  },
  heroBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: C.accentTint,
    borderRadius: R.chip,
    paddingHorizontal: S[3],
    paddingVertical: 5,
    marginBottom: S[4],
    borderWidth: 1, borderColor: `${C.accent}25`,
  },
  heroBadgeText: {
    fontSize: 10, fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.7,
  },
  heroTitle: {
    fontSize: 34, fontWeight: '800',
    color: C.ink,
    letterSpacing: -1.2,
    lineHeight: 34 * 1.15,
    marginBottom: S[3],
  },
  heroSub: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    lineHeight: FONT.base * 1.6,
  },

  // Scan zone
  scanZone: {
    borderRadius: R.xl,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: S[4],
    paddingVertical: S[8],
    minHeight: 160,
    maxHeight: H * 0.30,
  },
  scanZoneInner: {
    alignItems: 'center',
    gap: S[2],
  },
  scanIconRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.accentTint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${C.accent}35`,
    marginBottom: S[2],
  },
  scanCardTitle: {
    fontSize: FONT.md, fontWeight: '600',
    color: C.ink,
    letterSpacing: FONT.snug,
  },
  scanCardSub: {
    fontSize: FONT.sm, fontWeight: '400',
    color: C.inkTer,
  },
  scanLoadingText: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    marginTop: S[3],
  },

  // Feature chips
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S[2],
    marginBottom: S[5],
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.surface,
    borderRadius: R.chip,
    paddingHorizontal: S[3],
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureChipText: {
    fontSize: FONT.xs, fontWeight: '500',
    color: C.inkSub,
  },

  // Buttons
  btnStack: {
    gap: S[3],
  },
  btnPrimary: {
    height: 56, borderRadius: R.btn,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
  },
  btnPrimaryText: {
    fontSize: FONT.md, fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  btnSmallRow: {
    flexDirection: 'row',
    gap: S[2],
  },
  btnSecSmall: {
    height: 48, borderRadius: R.btn,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S[4],
  },
  btnSecSmallText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.inkSub,
  },

  // Results state
  sectionLabel: {
    fontSize: FONT.xs, fontWeight: '600',
    color: C.inkTer,
    letterSpacing: FONT.cap,
    textTransform: 'uppercase',
    marginBottom: S[3],
  },
  resultCard: {
    marginHorizontal: S[5],
    marginBottom: S[5],
    backgroundColor: C.ink,
    borderRadius: R.card,
    padding: S[5],
  },
  resultCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S[4],
  },
  resultCount: {
    fontSize: FONT.hero, fontWeight: '800',
    color: '#fff',
    letterSpacing: -2,
    lineHeight: FONT.hero,
  },
  resultLabel: {
    fontSize: FONT.base, fontWeight: '400',
    color: 'rgba(255,255,255,0.65)',
  },
  resultRight: {
    alignItems: 'flex-end',
    paddingTop: S[2],
  },
  resultIngCount: {
    fontSize: FONT.sm, fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  resultDate: {
    fontSize: FONT.xs, fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
  },
  resultViewBtn: {
    height: 46,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
  },
  resultViewBtnText: {
    fontSize: FONT.base, fontWeight: '600',
    color: '#fff',
  },

  // Ingredient chips (results state)
  chipsScroll: {
    paddingHorizontal: S[5], gap: S[2], flexDirection: 'row',
  },
  ingChip: {
    paddingHorizontal: S[3] + 2, paddingVertical: S[2],
    borderRadius: R.chip,
    backgroundColor: C.accentTint,
    borderWidth: 1, borderColor: `${C.accent}25`,
  },
  ingChipText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.accent,
    letterSpacing: FONT.wide,
  },

  // Shared button re-use in results state
  btnAccent: {
    height: 52, borderRadius: R.btn,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  btnAccentText: {
    fontSize: FONT.base, fontWeight: '600',
    color: '#fff',
  },
});

// ── Results Screen ─────────────────────────────────────────────────────────────
const re = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S[5],
    paddingTop: S[3],
    paddingBottom: S[4],
    gap: S[3],
  },
  backBtn: {
    width: 40, height: 40, borderRadius: R.btn,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerTitle: {
    fontSize: FONT['2xl'], fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.tight,
  },
  headerSub: {
    fontSize: FONT.xs, fontWeight: '400',
    color: C.inkTer,
    marginTop: 1,
  },
  headerBadge: {
    backgroundColor: C.accent,
    borderRadius: R.full,
    minWidth: 28, height: 28,
    paddingHorizontal: S[2],
    justifyContent: 'center', alignItems: 'center',
  },
  headerBadgeText: {
    fontSize: FONT.sm, fontWeight: '700',
    color: '#fff',
  },

  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: S[5],
    paddingVertical: S[3],
    gap: S[2],
  },
  filterChip: {
    paddingHorizontal: S[3] + 2, paddingVertical: S[2],
    borderRadius: R.chip,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  filterChipText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkSub,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  listContent: {
    paddingHorizontal: S[5],
    paddingTop: S[4],
    paddingBottom: 120,
    gap: S[4],
  },
});

// ── Kitchen Screen ─────────────────────────────────────────────────────────────
const ki = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[5],
    paddingBottom: S[4],
  },
  headerTitle: {
    fontSize: FONT['2xl'], fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.tight,
  },
  addIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
  },

  // Stat card
  statCard: {
    marginHorizontal: S[5],
    marginBottom: S[6],
    padding: S[5],
    borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.white,
  },
  statCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S[3],
  },
  statArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accentTint,
    justifyContent: 'center', alignItems: 'center',
    marginTop: S[2],
  },
  statNumber: {
    fontSize: FONT.hero, fontWeight: '700',
    color: C.ink,
    letterSpacing: -1.5,
    lineHeight: FONT.hero * 1.0,
  },
  statLabel: {
    fontSize: FONT.xl, fontWeight: '400',
    color: C.ink,
    marginTop: 4, marginBottom: S[1],
  },
  statSub: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    lineHeight: FONT.base * 1.5,
  },
  statLoading: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
  },
  updateLink: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.accent,
    marginTop: S[3],
  },

  // Ingredient categories
  categories: {
    paddingHorizontal: S[5],
    gap: S[6],
  },
  catSection: {},
  catLabel: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkSub,
    marginBottom: S[3],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: R.chip,
    paddingHorizontal: S[3] + 2,
    paddingVertical: S[2],
    borderWidth: 1, borderColor: C.border,
  },
  chipText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.ink,
  },
  chipQty: {
    fontSize: FONT.sm, fontWeight: '400',
    color: C.inkSub,
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    marginHorizontal: S[5],
    marginTop: S[6],
    paddingVertical: S[4],
    borderRadius: R.btn,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  addRowText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.accent,
  },
});

// ── Saved Screen ──────────────────────────────────────────────────────────────
const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  header: {
    paddingHorizontal: S[5],
    paddingBottom: S[3],
  },
  headerTitle: {
    fontSize: FONT['2xl'], fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.tight,
  },

  // Segmented control
  segWrapper: {
    flexDirection: 'row',
    marginHorizontal: S[5],
    marginBottom: S[4],
    backgroundColor: C.surface,
    borderRadius: R.btn,
    padding: 3,
    borderWidth: 1, borderColor: C.border,
  },
  segment: {
    flex: 1,
    paddingVertical: S[2] + 1,
    borderRadius: R.btn - 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  segLabel: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkTer,
  },
  segLabelActive: {
    color: C.ink,
    fontWeight: '600',
  },

  tabContent: {
    paddingHorizontal: S[5],
    paddingTop: S[2],
  },
  loadingText: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    paddingVertical: S[4],
  },

  sectionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: S[3],
    marginBottom: S[3],
  },
  iconAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  addRow: {
    flexDirection: 'row',
    gap: S[2],
    marginBottom: S[4],
  },
  addInput: {
    flex: 1, height: 48,
    backgroundColor: C.surface,
    borderRadius: R.btn,
    paddingHorizontal: S[4],
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
    borderWidth: 1.5, borderColor: C.border,
  },
  addBtn: {
    height: 48, paddingHorizontal: S[4],
    backgroundColor: C.accent,
    borderRadius: R.btn,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: '#fff',
  },

  // Shopping list
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S[4],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: S[3],
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  itemName: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
  },
  itemNameDone: {
    textDecorationLine: 'line-through',
    color: C.inkTer,
  },
  itemRecipe: {
    fontSize: FONT.xs, fontWeight: '400',
    color: C.inkTer,
    fontStyle: 'italic',
    marginTop: 2,
  },
  clearDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4],
  },
  clearDoneText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.danger,
  },

  // Favorites grid
  favGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S[3],
  },

  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S[3],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: S[3],
  },
  historyThumb: {
    width: 48, height: 48,
    borderRadius: R.chip,
    resizeMode: 'cover',
  },
  historyThumbEmpty: {
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  historyIngredients: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.ink,
  },
  historyDate: {
    fontSize: FONT.xs, fontWeight: '400',
    color: C.inkTer,
    marginTop: 2,
  },
});

// ── Recipe Detail ─────────────────────────────────────────────────────────────
const de = StyleSheet.create({
  heroFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  nav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: S[5],
    zIndex: 10,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },

  content: {
    paddingHorizontal: S[5],
    paddingTop: S[5],
  },
  title: {
    fontSize: 26, fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 26 * 1.25,
    marginBottom: S[3],
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: S[2], marginBottom: S[5],
  },
  chip: {
    paddingHorizontal: S[3], paddingVertical: S[1] + 2,
    borderRadius: R.chip,
    borderWidth: 1, borderColor: C.border,
  },
  chipText: {
    fontSize: FONT.xs, fontWeight: '500',
    color: C.inkSub,
  },
  chipReady: {
    backgroundColor: C.successBg, borderColor: C.successBg,
  },
  chipMissing: {
    backgroundColor: C.amberBg, borderColor: `${C.amber}30`,
  },

  cookBtn: {
    height: 54, borderRadius: R.btn,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  cookBtnText: {
    fontSize: FONT.md, fontWeight: '700',
    color: '#fff',
  },

  // Missing
  missingCard: {
    backgroundColor: C.amberBg,
    borderRadius: R.card,
    padding: S[4],
    marginBottom: S[5],
    borderWidth: 1, borderColor: `${C.amber}20`,
  },
  missingSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S[3],
  },
  missingSectionTitle: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.amberText,
    letterSpacing: FONT.cap,
  },
  addToListText: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.accent,
  },
  missingPill: {
    paddingHorizontal: S[3], paddingVertical: 5,
    borderRadius: R.chip,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: `${C.amber}25`,
  },
  missingPillText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.ink,
  },

  section: { marginBottom: S[6] },
  sectionTitle: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.inkTer,
    letterSpacing: FONT.cap,
    textTransform: 'uppercase',
    marginBottom: S[3],
  },

  // Ingredients list
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S[3],
    gap: S[3],
  },
  ingRowBorder: {
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  ingDot: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  ingMeasure: {
    minWidth: 70, maxWidth: 110,
    fontSize: FONT.sm, fontWeight: '600',
    color: C.inkSub,
  },
  ingName: {
    flex: 1,
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    gap: S[3],
    marginBottom: S[4],
  },
  stepNumBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNumText: {
    fontSize: FONT.xs, fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
    lineHeight: FONT.base * 1.65,
  },

  // Secondary actions
  secActions: {
    flexDirection: 'row', gap: S[2],
    marginTop: S[2], marginBottom: S[6],
  },
  secBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[3] + 2,
    borderRadius: R.btn,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  secBtnText: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.accent,
  },
});

// ── Cook Mode ─────────────────────────────────────────────────────────────────
const cm = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  progressTrack: {
    height: 3,
    backgroundColor: C.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[5],
    paddingTop: S[4],
    paddingBottom: S[2],
  },
  stepLabel: {
    fontSize: FONT.sm, fontWeight: '700',
    color: C.accent,
    letterSpacing: FONT.cap,
  },
  recipeName: {
    fontSize: FONT.xs, fontWeight: '500',
    color: C.inkTer,
    marginTop: 2,
    letterSpacing: FONT.wide,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  stepContent: {
    flex: 1,
    paddingHorizontal: S[8],
    justifyContent: 'center',
  },
  stepText: {
    fontSize: FONT.xl, fontWeight: '500',
    color: C.ink,
    lineHeight: FONT.xl * 1.6,
    textAlign: 'center',
  },

  swipeHint: {
    textAlign: 'center',
    fontSize: FONT.xs, fontWeight: '400',
    color: C.inkTer,
    marginBottom: S[3],
    letterSpacing: FONT.wide,
  },

  navRow: {
    flexDirection: 'row',
    paddingHorizontal: S[5],
    paddingTop: S[4],
    gap: S[3],
    alignItems: 'center',
  },
  navBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[1],
    paddingVertical: S[4],
    paddingRight: S[3],
  },
  navBackText: {
    fontSize: FONT.base, fontWeight: '500',
    color: C.inkSub,
  },
  navNextWrap: { flex: 1 },
  navNext: {
    flex: 1, height: 54,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  navNextText: {
    fontSize: FONT.md, fontWeight: '700',
    color: '#fff',
  },

  // Done state
  doneCheck: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.successBg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[5],
    borderWidth: 1, borderColor: `${C.success}30`,
  },
  doneTitle: {
    fontSize: FONT.xl, fontWeight: '700',
    color: C.ink,
    marginBottom: S[2],
    letterSpacing: FONT.tight,
  },
  doneSub: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
  },
  doneLink: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.accent,
  },

  // No steps
  exitBtn: {
    marginHorizontal: S[5],
    paddingVertical: S[4],
    borderRadius: R.btn,
    backgroundColor: C.surface,
    alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  exitBtnText: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.inkSub,
  },
});

// ── Tab Bar ───────────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  bar: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: Platform.OS === 'ios' ? 80 : 60,
    paddingTop: S[2],
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
