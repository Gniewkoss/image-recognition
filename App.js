/**
 * FoodLens — "Everyday Kitchen" Redesign
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

// ─── Three Dots — iMessage-style loading indicator ───────────────────────────

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
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: C.accent, opacity: v,
          }}
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
  const filled  = Math.min(5, Math.max(0, Math.round((recipe.match_percent || 0) / 20)));

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
        {/* Favorite */}
        <TouchableOpacity
          style={ui.cardFavBtn}
          onPress={e => { e.stopPropagation(); haptic.light(); onFavorite(recipe); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorited ? C.danger : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={ui.cardContent}>
        <Text style={ui.cardTitle} numberOfLines={2}>{recipe.name}</Text>

        <View style={ui.cardMetaRow}>
          {/* Match dots as unicode */}
          <Text style={ui.cardDots}>
            {[0,1,2,3,4].map(i => (
              <Text key={i} style={{ color: i < filled ? C.accent : C.accentDim }}>
                {i < filled ? '●' : '○'}
              </Text>
            ))}
          </Text>
          {total > 0 && (
            <Text style={ui.cardMetaText}>{recipe.matched_count}/{total} ingredients</Text>
          )}
        </View>

        {/* Tags row */}
        <View style={ui.cardTagRow}>
          {recipe.area && <View style={ui.cardTag}><Text style={ui.cardTagText}>{recipe.area}</Text></View>}
          {recipe.category && <View style={ui.cardTag}><Text style={ui.cardTagText}>{recipe.category}</Text></View>}
          {isReady && <View style={[ui.cardTag, ui.cardTagReady]}><Text style={[ui.cardTagText, { color: C.successText }]}>Ready</Text></View>}
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
      {/* Gradient overlay — text on image */}
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
  const [phase, setPhase]             = useState('idle'); // idle | analyzing | found | searching
  const [apiKey, setApiKey]           = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey]         = useState('');
  const insets = useSafeAreaInsets();

  const isLoading  = phase !== 'idle';
  const hasResults = recipes.length > 0 && !isLoading;

  const loadingLabel =
    phase === 'analyzing' ? 'Scanning ingredients…'
    : phase === 'found'   ? `Found ${ingredients.length} ingredients!`
    : phase === 'searching' ? 'Finding recipes…'
    : '';

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

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
    if (!apiKey) { setShowKeyModal(true); return; }
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
          <Text style={sc.headerTitle}>FoodLens</Text>
          <TouchableOpacity
            style={sc.settingsBtn}
            onPress={() => { haptic.light(); setShowKeyModal(true); }}
          >
            <Ionicons name="settings-outline" size={20} color={C.inkTer} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Found count row */}
          <View style={sc.foundRow}>
            <Text style={sc.foundCount}>
              Found{' '}
              <Text style={sc.foundBold}>{ingredients.length} ingredients</Text>
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Results', { recipes, ingredients })}
            >
              <Text style={sc.seeRecipesBtn}>See {recipes.length} recipes →</Text>
            </TouchableOpacity>
          </View>

          {/* Ingredient chips horizontal scroll */}
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

          {/* Scan again */}
          <View style={{ paddingHorizontal: S[5], gap: S[3] }}>
            <Press onPress={() => startScan(true)} hapticType="medium">
              <View style={sc.btnAccent}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={sc.btnAccentText}>Scan Again</Text>
              </View>
            </Press>
            <Press onPress={() => startScan(false)}>
              <View style={sc.btnOutline}>
                <Text style={sc.btnOutlineText}>Choose Photo</Text>
              </View>
            </Press>
            <TouchableOpacity style={sc.clearBtn} onPress={clearResults}>
              <Text style={sc.clearBtnText}>Clear results</Text>
            </TouchableOpacity>
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

      <View style={sc.header}>
        <Text style={sc.headerTitle}>FoodLens</Text>
        <TouchableOpacity
          style={sc.settingsBtn}
          onPress={() => { haptic.light(); setShowKeyModal(true); }}
        >
          <Ionicons name="settings-outline" size={20} color={C.inkTer} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: S[5] }}>
        <Text style={sc.screenTitle}>What's in{'\n'}your fridge?</Text>
        <Text style={sc.screenSub}>
          Point camera at ingredients or select a photo
        </Text>

        {/* Camera zone */}
        <TouchableOpacity
          style={sc.cameraZone}
          onPress={() => !isLoading && startScan(true)}
          activeOpacity={isLoading ? 1 : 0.85}
        >
          {isLoading ? (
            <View style={sc.cameraZoneInner}>
              <ThreeDots />
              <Text style={sc.loadingText}>{loadingLabel}</Text>
            </View>
          ) : (
            <View style={sc.cameraZoneInner}>
              <Ionicons name="camera-outline" size={32} color={C.inkTer} />
              <Text style={sc.tapToScanLabel}>Tap to scan</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={sc.btnRow}>
          <Press
            onPress={() => startScan(true)}
            style={{ flex: 1 }}
            hapticType="medium"
            disabled={isLoading}
          >
            <View style={[sc.btnAccent, isLoading && { opacity: 0.38 }]}>
              <Text style={sc.btnAccentText}>Take Photo</Text>
            </View>
          </Press>
          <Press
            onPress={() => startScan(false)}
            style={{ flex: 1 }}
            disabled={isLoading}
          >
            <View style={[sc.btnOutline, isLoading && { opacity: 0.38 }]}>
              <Text style={sc.btnOutlineText}>Choose Photo</Text>
            </View>
          </Press>
        </View>

        <TouchableOpacity
          style={{ alignItems: 'center', marginTop: S[4] }}
          onPress={() => navigation.navigate('KitchenTab')}
          disabled={isLoading}
        >
          <Text style={sc.manualLink}>Add manually</Text>
        </TouchableOpacity>
      </View>

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
        <Text style={re.headerTitle}>Recipes for you</Text>
        <View style={re.headerBadge}>
          <Text style={re.headerBadgeText}>{recipes.length}</Text>
        </View>
      </View>

      {/* Filter chips — horizontal scroll, instant color swap */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={re.filterRow}
        style={{ borderBottomWidth: 1, borderBottomColor: C.border }}
      >
        {FILTER_TABS.map(tab => {
          const isActive = filter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[re.filterChip, isActive && re.filterChipActive]}
              onPress={() => { haptic.light(); setFilter(tab.id); }}
              activeOpacity={0.8}
            >
              <Text style={[re.filterChipText, isActive && re.filterChipTextActive]}>
                {tab.label}
                {counts[tab.id] > 0 ? ` ${counts[tab.id]}` : ''}
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
            subtitle="Try a different filter"
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

        {/* Big stat */}
        {loading ? (
          <View style={{ paddingHorizontal: S[5], marginBottom: S[6] }}>
            <Text style={ki.statLoading}>Loading ingredients…</Text>
          </View>
        ) : recipesCount > 0 ? (
          <TouchableOpacity
            style={{ paddingHorizontal: S[5], marginBottom: S[6] }}
            onPress={async () => {
              haptic.light();
              const s = await AsyncStorage.getItem(KEYS.recipes);
              const si = await AsyncStorage.getItem(KEYS.ingredients);
              if (s) {
                const p = JSON.parse(s);
                navigation.navigate('Results', { recipes: p.recipes || [], ingredients: si ? JSON.parse(si) : [] });
              }
            }}
            activeOpacity={0.75}
          >
            <Text style={ki.statNumber}>{recipesCount}</Text>
            <Text style={ki.statLabel}>
              {recipesCount === 1 ? 'recipe ready' : 'recipes ready'}
            </Text>
            <Text style={ki.statSub}>
              From {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
              {readyCount > 0 ? ` · ${readyCount} with all ingredients` : ''}
            </Text>
            <Text style={ki.updateLink}>Update ingredients</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ paddingHorizontal: S[5], marginBottom: S[6] }}>
            <Text style={ki.statNumber}>{ingredients.length}</Text>
            <Text style={ki.statLabel}>
              {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
            </Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={ki.updateLink}>Add ingredients</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ingredients by category */}
        {loading ? (
          <View style={{ paddingHorizontal: S[5] }}>
            <Text style={ki.loadingText}>Loading…</Text>
          </View>
        ) : ingredients.length === 0 ? (
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

  const uncheckedCount = shoppingList.filter(i => !i.checked).length;

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
                <TouchableOpacity onPress={shareList}>
                  <Ionicons name="share-outline" size={20} color={C.inkTer} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { haptic.light(); setShowInput(v => !v); }}>
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
              <Text style={sv.emptyNote}>
                Add items here, or save missing ingredients directly from any recipe.
              </Text>
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
              <Text style={sv.emptyNote}>
                Tap the heart on any recipe to save it here.
              </Text>
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
              <Text style={sv.emptyNote}>No scans yet.</Text>
            ) : (
              history.map(entry => (
                <View key={entry.id} style={sv.historyRow}>
                  {entry.uri ? (
                    <Image source={{ uri: entry.uri }} style={sv.historyThumb} />
                  ) : (
                    <View style={[sv.historyThumb, { backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }]}>
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
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image — edge to edge, no radius */}
        <View style={{ height: 240, backgroundColor: C.surface }}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 80 }}>{recipe.emoji || '🍽️'}</Text>
            </View>
          )}
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
                  <Ionicons name={isFaved ? 'heart' : 'heart-outline'} size={20} color={isFaved ? C.danger : '#fff'} />
                </View>
              </Press>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={de.content}>
          {/* Title */}
          <Text style={de.title}>{recipe.name}</Text>

          {/* Meta chips row */}
          <View style={de.chipRow}>
            {recipe.area && <View style={de.chip}><Text style={de.chipText}>{recipe.area}</Text></View>}
            {recipe.category && <View style={de.chip}><Text style={de.chipText}>{recipe.category}</Text></View>}
            {isReady ? (
              <View style={[de.chip, de.chipReady]}>
                <Text style={[de.chipText, { color: C.successText }]}>Ready to cook</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S[3] }}>
                <Text style={de.missingSectionTitle}>MISSING</Text>
                <TouchableOpacity onPress={addMissing}>
                  <Text style={de.addToListText}>Add to list</Text>
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
                    <Text style={de.ingMeasure}>{ing.measure}</Text>
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

  const progress  = useRef(new Animated.Value(0)).current;
  const textOp    = useRef(new Animated.Value(1)).current;
  const textTy    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pct = steps.length > 1 ? step / (steps.length - 1) : 1;
    Animated.timing(progress, { toValue: pct, duration: 250, useNativeDriver: false }).start();
    if (step === steps.length - 1 && steps.length > 1) setDone(false);
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={cm.doneLink}>Back to recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[cm.root, { paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <StatusBar style="dark" />

      {/* Progress bar — very top */}
      <View style={cm.progressTrack}>
        <Animated.View style={[cm.progressFill, { width: progressWidth }]} />
      </View>

      {/* Top bar */}
      <View style={cm.topBar}>
        <Text style={cm.stepLabel}>STEP {step + 1} OF {steps.length}</Text>
        <TouchableOpacity
          style={cm.closeBtn}
          onPress={() => { haptic.light(); navigation.goBack(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={C.inkSub} />
        </TouchableOpacity>
      </View>

      <Text style={cm.recipeName} numberOfLines={1}>{recipe.name}</Text>

      {/* Step text */}
      <Animated.View style={[cm.stepContent, { opacity: textOp, transform: [{ translateY: textTy }] }]}>
        <Text style={cm.stepText}>{steps[step]}</Text>
      </Animated.View>

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
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
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

// ─── Root App — no font loading gate ─────────────────────────────────────────

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

// ── Global UI ────────────────────────────────────────────────────────────────
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

  // Section header (13px UPPERCASE tracking)
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

  // Recipe card (full-width)
  card: {
    backgroundColor: C.white,
    borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  cardImgWrap: {
    height: 180,
    backgroundColor: C.surface,
  },
  cardImg: {
    width: '100%', height: '100%', resizeMode: 'cover',
  },
  cardImgPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  cardFavBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.30)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardContent: {
    padding: S[4],
  },
  cardTitle: {
    fontSize: FONT.md, fontWeight: '600',
    color: C.ink,
    letterSpacing: FONT.snug,
    marginBottom: S[2],
    lineHeight: FONT.md * 1.35,
  },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: S[3], marginBottom: S[2],
  },
  cardDots: {
    fontSize: FONT.sm,
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
    marginTop: S[2],
  },

  // Grid card (2-col favorites)
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
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  gridCardTitle: {
    fontSize: FONT.sm, fontWeight: '600',
    color: '#fff',
    lineHeight: FONT.sm * 1.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    width: 48, height: 48, borderRadius: R.btn,
    backgroundColor: C.accentTint,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: `${C.accent}20`,
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

  // Inputs
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

// ── Scan Screen ───────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[5],
    paddingBottom: S[3],
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

  // Empty/loading
  screenTitle: {
    fontSize: FONT.xl, fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.tight,
    marginBottom: S[2],
    lineHeight: FONT.xl * 1.25,
  },
  screenSub: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    lineHeight: FONT.base * 1.5,
    marginBottom: S[5],
  },
  cameraZone: {
    flex: 1,
    borderRadius: R.xl,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[4],
    minHeight: 200,
    maxHeight: H * 0.45,
  },
  cameraZoneInner: {
    alignItems: 'center', gap: S[3],
  },
  tapToScanLabel: {
    fontSize: FONT.base, fontWeight: '600',
    color: C.accent,
  },
  loadingText: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
  },
  btnRow: {
    flexDirection: 'row', gap: S[3],
    marginBottom: S[3],
  },
  manualLink: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkTer,
  },

  // Has results
  foundRow: {
    paddingHorizontal: S[5],
    marginBottom: S[4],
    gap: 6,
  },
  foundCount: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
  },
  foundBold: {
    fontWeight: '700',
    color: C.ink,
  },
  seeRecipesBtn: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.accent,
  },
  chipsScroll: {
    paddingHorizontal: S[5], gap: S[2], flexDirection: 'row',
  },
  ingChip: {
    paddingHorizontal: S[3] + 2, paddingVertical: S[2],
    borderRadius: R.chip,
    backgroundColor: C.accentTint,
    borderWidth: 1, borderColor: `${C.accent}20`,
  },
  ingChipText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.accent,
    letterSpacing: FONT.wide,
  },
  clearBtn: {
    alignItems: 'center', paddingVertical: S[3],
  },
  clearBtnText: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkTer,
  },

  // Shared button primitives used in this screen
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
});

// ── Results Screen ────────────────────────────────────────────────────────────
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
    flex: 1,
    fontSize: FONT['2xl'], fontWeight: '700',
    color: C.ink,
    letterSpacing: FONT.tight,
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

// ── Kitchen Screen ────────────────────────────────────────────────────────────
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

  // Big stat
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
    marginTop: S[3],
  },
  updateLink: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.accent,
    marginTop: S[3],
  },
  loadingText: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
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
  },
  segment: {
    flex: 1,
    paddingVertical: S[2],
    borderRadius: R.btn - 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
  },
  segLabel: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkSub,
  },
  segLabelActive: {
    color: C.ink,
    fontWeight: '600',
  },

  tabContent: {
    paddingHorizontal: S[5],
    paddingTop: S[2],
    paddingBottom: 120,
  },
  loadingText: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    paddingVertical: S[4],
  },
  emptyNote: {
    fontSize: FONT.base, fontWeight: '400',
    color: C.inkSub,
    lineHeight: FONT.base * 1.5,
    paddingVertical: S[4],
  },
  sectionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: S[4],
    marginBottom: S[3],
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
    width: 44, height: 44,
    borderRadius: R.chip,
    resizeMode: 'cover',
  },
  historyIngredients: {
    fontSize: FONT.sm, fontWeight: '500',
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
  nav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: S[5],
    zIndex: 10,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'center', alignItems: 'center',
  },

  content: {
    paddingHorizontal: S[5],
    paddingTop: S[5],
  },
  title: {
    fontSize: 24, fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 24 * 1.25,
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
    height: 52, borderRadius: R.btn,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  cookBtnText: {
    fontSize: FONT.md, fontWeight: '600',
    color: '#fff',
  },

  // Missing
  missingCard: {
    backgroundColor: C.amberBg,
    borderRadius: R.card,
    padding: S[4],
    marginBottom: S[5],
    borderWidth: 1, borderColor: `${C.amber}25`,
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
    borderWidth: 1, borderColor: `${C.amber}30`,
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
  },
  ingMeasure: {
    width: 80,
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
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  stepNumText: {
    fontSize: FONT.xs, fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: FONT.base, fontWeight: '400',
    color: C.ink,
    lineHeight: FONT.base * 1.6,
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
    height: 2,
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
    paddingVertical: S[4],
  },
  stepLabel: {
    fontSize: FONT.sm, fontWeight: '600',
    color: C.inkTer,
    letterSpacing: FONT.cap,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  recipeName: {
    fontSize: FONT.sm, fontWeight: '500',
    color: C.inkTer,
    paddingHorizontal: S[5],
    marginBottom: S[6],
    textTransform: 'uppercase',
    letterSpacing: FONT.cap,
  },

  stepContent: {
    flex: 1,
    paddingHorizontal: S[8],
    justifyContent: 'center',
  },
  stepText: {
    fontSize: FONT.xl, fontWeight: '500',
    color: C.ink,
    lineHeight: FONT.xl * 1.55,
    textAlign: 'center',
  },

  navRow: {
    flexDirection: 'row',
    paddingHorizontal: S[5],
    paddingTop: S[5],
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
    flex: 1, height: 52,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
  },
  navNextText: {
    fontSize: FONT.md, fontWeight: '600',
    color: '#fff',
  },

  // Done state
  doneCheck: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.successBg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[5],
  },
  doneTitle: {
    fontSize: FONT.xl, fontWeight: '700',
    color: C.ink,
    marginBottom: S[3],
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
    height: 84,
    paddingTop: S[2],
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
