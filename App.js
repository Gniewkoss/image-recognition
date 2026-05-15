/**
 * FoodLens — Premium React Native App
 * Stack: Expo SDK 54 · Reanimated 3 · Inter + Playfair Display · expo-haptics
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, Alert,
  ScrollView, TextInput, Modal, KeyboardAvoidingView,
  Platform, Share, Dimensions, Linking, PanResponder,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  SafeAreaProvider, useSafeAreaInsets,
  SafeAreaView as SAV,
} from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay, withRepeat, withSequence,
  interpolate, Extrapolation, runOnJS,
} from 'react-native-reanimated';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_700Bold, PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';

import { C, FONT, S, R, SHADOW, SPRING, TIMING } from './src/design';
import {
  buildServerUrl, humanizeApiError,
  formatScanDate, getIngredientCategory, getCategoryMeta,
  getMatchDots, pluralize, capitalize,
} from './src/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');
const SERVER_URL = buildServerUrl();

const KEYS = {
  apiKey:   '@openai_api_key',
  favorites:'@favorite_recipes',
  history:  '@scan_history',
  ingredients: '@current_ingredients',
  recipes:  '@current_recipes',
  shopping: '@shopping_list',
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

// ─── Primitive: Pressable with spring scale ───────────────────────────────────

function Press({ onPress, style, children, scale = 0.97, hapticType = 'light', disabled }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Animated.View style={[anim, style]}>
      <TouchableOpacity
        onPress={() => {
          if (disabled) return;
          if (hapticType) haptic[hapticType]?.();
          onPress?.();
        }}
        onPressIn={() => { s.value = withSpring(scale, SPRING.snappy); }}
        onPressOut={() => { s.value = withSpring(1, SPRING.snappy); }}
        activeOpacity={1}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Skeleton Pulse ───────────────────────────────────────────────────────────

function Skeleton({ width, height, radius = R.md, style }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 })
      ), -1
    );
  }, []);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: C.rim }, anim, style]}
    />
  );
}

// ─── Match Dots ───────────────────────────────────────────────────────────────

function MatchDots({ matchPercent, size = 8 }) {
  const filled = getMatchDots(matchPercent);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[0,1,2,3,4].map(i => (
        <View
          key={i}
          style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: i < filled ? C.emerald : C.emeraldDim,
          }}
        />
      ))}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, action, onAction, dark }) {
  return (
    <View style={[ui.emptyWrap]}>
      <View style={[ui.emptyIcon, dark && { backgroundColor: 'rgba(124,184,152,0.12)' }]}>
        <Ionicons name={icon} size={34} color={dark ? C.darkSage : C.brand} />
      </View>
      <Text style={[ui.emptyTitle, dark && { color: C.darkText, fontFamily: FONT.sans }]}>
        {title}
      </Text>
      <Text style={[ui.emptySub, dark && { color: C.darkTextSub }]}>
        {subtitle}
      </Text>
      {action && onAction && (
        <Press onPress={onAction} style={ui.emptyBtn} hapticType="medium">
          <View style={[ui.emptyBtnInner, dark && { backgroundColor: C.darkSage }]}>
            <Text style={[ui.emptyBtnText, dark && { color: C.dark }]}>{action}</Text>
          </View>
        </Press>
      )}
    </View>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ text, right }) {
  return (
    <View style={ui.sectionLabelRow}>
      <Text style={ui.sectionLabel}>{text}</Text>
      {right}
    </View>
  );
}

// ─── Pulsing Ring (ScanScreen) ────────────────────────────────────────────────

function PulseRing({ delay = 0, size = 140, color = C.darkSage }) {
  const scale   = useSharedValue(0.7);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.9, { duration: 2000 }),
        withTiming(0.7, { duration: 0 })
      ), -1
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0, { duration: 2000 }),
        withTiming(0.5, { duration: 0 })
      ), -1
    ));
  }, []);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 1, borderColor: color,
      }, anim]}
    />
  );
}

// ─── Stagger Item (list entrance) ────────────────────────────────────────────

function StaggerItem({ index, children }) {
  const opacity = useSharedValue(0);
  const ty      = useSharedValue(18);

  useEffect(() => {
    const d = Math.min(index * 55, 600);
    opacity.value = withDelay(d, withTiming(1, { duration: TIMING.normal }));
    ty.value      = withDelay(d, withSpring(0, SPRING.gentle));
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={anim}>{children}</Animated.View>;
}

// ─── Recipe Card (full-width, Results screen) ─────────────────────────────────

function RecipeCard({ recipe, onPress, onFavorite, isFavorited }) {
  const isReady  = recipe.missing_count === 0;
  const total    = (recipe.matched_count || 0) + (recipe.missing_count || 0);

  return (
    <Press onPress={onPress} scale={0.985} style={ui.card}>
      {/* Image */}
      <View style={ui.cardImageWrap}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={ui.cardImage} />
        ) : (
          <View style={[ui.cardImagePlaceholder]}>
            <Text style={{ fontSize: 56 }}>{recipe.emoji || '🍽️'}</Text>
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(10,15,12,0.55)']}
          style={ui.cardGradient}
        />

        {/* Ready badge on image */}
        {isReady && (
          <View style={ui.cardReadyBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#fff" />
            <Text style={ui.cardReadyText}>Ready to cook</Text>
          </View>
        )}

        {/* Cuisine tag */}
        {(recipe.area || recipe.category) && (
          <View style={ui.cardCuisineTag}>
            <Text style={ui.cardCuisineText}>{recipe.area || recipe.category}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={ui.cardContent}>
        <Text style={ui.cardTitle} numberOfLines={2}>{recipe.name}</Text>

        <View style={ui.cardMetaRow}>
          <MatchDots matchPercent={recipe.match_percent} />
          {total > 0 && (
            <Text style={ui.cardMetaText}>
              {recipe.matched_count}/{total} ingredients
            </Text>
          )}
        </View>

        {recipe.missing_count > 0 && (
          <Text style={ui.cardMissing}>
            {pluralize(recipe.missing_count, 'ingredient')} missing
          </Text>
        )}
      </View>

      {/* Heart */}
      <TouchableOpacity
        style={ui.cardHeart}
        onPress={(e) => {
          e.stopPropagation();
          haptic.light();
          onFavorite(recipe);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorited ? C.rose : C.ink300}
        />
      </TouchableOpacity>
    </Press>
  );
}

// ─── Small grid card (Saved screen) ──────────────────────────────────────────

function GridCard({ recipe, onPress }) {
  return (
    <Press onPress={onPress} scale={0.96} style={ui.gridCard}>
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={ui.gridCardImg} />
      ) : (
        <View style={ui.gridCardPlaceholder}>
          <Text style={{ fontSize: 30 }}>{recipe.emoji || '🍽️'}</Text>
        </View>
      )}
      <View style={ui.gridCardBody}>
        <Text style={ui.gridCardTitle} numberOfLines={2}>{recipe.name}</Text>
      </View>
    </Press>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────

function ApiKeyModal({ visible, onClose, value, onChange, onSave }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={ui.modalOverlay}
      >
        <Animated.View style={ui.modalSheet}>
          <View style={ui.modalDragHandle} />

          <View style={ui.modalIconRow}>
            <View style={ui.modalIconBg}>
              <Ionicons name="key-outline" size={22} color={C.brand} />
            </View>
          </View>
          <Text style={ui.modalTitle}>OpenAI API Key</Text>
          <Text style={ui.modalSub}>Required for AI ingredient detection</Text>

          <TextInput
            style={ui.input}
            placeholder="sk-…"
            placeholderTextColor={C.ink300}
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
              <View style={[ui.btnPrimary, !value && { opacity: 0.45 }]}>
                <Text style={ui.btnPrimaryText}>Save Key</Text>
              </View>
            </Press>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ScanScreen ───────────────────────────────────────────────────────────────

function ScanScreen({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [lastDate, setLastDate] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | analyzing | found | searching
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [visibleCount, setVisibleCount] = useState(0);

  const progressVal = useSharedValue(0);
  const progressAnim = useAnimatedStyle(() => ({
    width: `${interpolate(progressVal.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  const isLoading   = phase !== 'idle';
  const hasResults  = recipes.length > 0 && !isLoading;

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  // Stagger ingredient reveal during "found" phase
  useEffect(() => {
    if (phase === 'found' && ingredients.length > 0) {
      setVisibleCount(0);
      const t = setInterval(() => {
        setVisibleCount(c => {
          if (c >= ingredients.length) { clearInterval(t); return c; }
          return c + 1;
        });
      }, 110);
      return () => clearInterval(t);
    }
  }, [phase, ingredients.length]);

  const animProgress = useCallback((to, duration) => {
    return new Promise(res => {
      progressVal.value = withTiming(to, { duration }, () => runOnJS(res)());
    });
  }, []);

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
    if (!perm.granted) { Alert.alert('Permission Required', 'Please allow access to continue.'); return; }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });

    if (!result.canceled && result.assets[0].base64) {
      analyzeImage(result.assets[0].base64, result.assets[0].uri);
    }
  }

  async function analyzeImage(base64, uri) {
    setPhase('analyzing');
    progressVal.setValue(0);
    animateProgressBackground(0.55, 12000);

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
      progressVal.value = withTiming(0.62, { duration: 300 });

      if (newIng.length > 0) await searchRecipes(newIng);
      else { setPhase('idle'); progressVal.value = withTiming(0, { duration: 200 }); }
    } catch (e) {
      Alert.alert('Analysis Failed', e.message || 'Could not analyze image.');
      setPhase('idle');
      progressVal.value = withTiming(0, { duration: 200 });
    }
  }

  // Non-awaited progress background animation
  function animateProgressBackground(target, duration) {
    progressVal.value = withTiming(target, { duration });
  }

  async function searchRecipes(ing) {
    setPhase('searching');
    animateProgressBackground(0.92, 15000);

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

      progressVal.value = withTiming(1, { duration: 400 });

      setTimeout(() => {
        setPhase('idle');
        progressVal.value = withTiming(0, { duration: 200 });
        if (newRec.length > 0) navigation.navigate('Results', { recipes: newRec, ingredients: ing });
      }, 500);
    } catch (e) {
      Alert.alert('Search Failed', e.message || 'Could not find recipes.');
      setPhase('idle');
      progressVal.value = withTiming(0, { duration: 200 });
    }
  }

  async function clearResults() {
    haptic.light();
    setRecipes([]); setIngredients([]); setLastDate(null);
    await AsyncStorage.multiRemove([KEYS.ingredients, KEYS.recipes]);
  }

  const loadingLabel = phase === 'analyzing' ? 'Scanning your fridge…'
    : phase === 'found' ? `Found ${ingredients.length} ingredients!`
    : phase === 'searching' ? 'Finding best recipes…'
    : '';

  const loadingSubLabel = phase === 'analyzing' ? 'AI is detecting ingredients'
    : phase === 'found' ? 'Matching to 50,000+ recipes'
    : phase === 'searching' ? 'Almost there…'
    : '';

  // ── Loading Screen ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[sc.scanRoot]}>
        <StatusBar style="light" />

        <View style={sc.loadingTop}>
          <View style={sc.loadingSpinner}>
            {[0, 600, 1200].map(d => <PulseRing key={d} delay={d} size={100} />)}
            <View style={sc.loadingIconBg}>
              <Ionicons name="camera-outline" size={30} color={C.darkSage} />
            </View>
          </View>
          <Text style={sc.loadingTitle}>{loadingLabel}</Text>
          <Text style={sc.loadingSubtitle}>{loadingSubLabel}</Text>
        </View>

        {phase !== 'analyzing' && ingredients.length > 0 && (
          <View style={sc.ingredientCloud}>
            {ingredients.slice(0, 10).map((ing, i) => (
              i < visibleCount ? (
                <StaggerItem key={i} index={i}>
                  <View style={sc.ingredientPill}>
                    <Text style={sc.ingredientPillText}>{capitalize(ing.name)}</Text>
                  </View>
                </StaggerItem>
              ) : null
            ))}
          </View>
        )}

        <View style={sc.loadingBottom}>
          <View style={sc.progressTrack}>
            <Animated.View style={[sc.progressFill, progressAnim]} />
          </View>
          <Text style={sc.progressLabel}>This may take a moment</Text>
        </View>
      </View>
    );
  }

  // ── Has Previous Results ────────────────────────────────────────────────────
  if (hasResults) {
    const top3 = recipes.slice(0, 3);
    return (
      <View style={sc.scanRoot}>
        <StatusBar style="light" />
        <View style={sc.safeTop} />

        <View style={sc.header}>
          <Text style={sc.headerTitle}>FoodLens</Text>
          <TouchableOpacity style={sc.settingsBtn} onPress={() => { haptic.light(); setShowKeyModal(true); }}>
            <Ionicons name="settings-outline" size={20} color={C.darkSage} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Last scan card */}
          <View style={sc.lastScanCard}>
            <View style={sc.lastScanHeader}>
              <View style={sc.lastScanDot} />
              <Text style={sc.lastScanLabel}>{formatScanDate(lastDate)}</Text>
              <TouchableOpacity onPress={clearResults} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color={C.darkTextSub} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: S[3] }}>
              {top3.map((rec, i) => (
                <TouchableOpacity
                  key={i}
                  style={sc.miniCard}
                  onPress={() => { haptic.light(); navigation.navigate('RecipeDetail', { recipe: rec, userIngredients: ingredients }); }}
                  activeOpacity={0.88}
                >
                  {rec.image
                    ? <Image source={{ uri: rec.image }} style={sc.miniCardImg} />
                    : <View style={[sc.miniCardImg, { backgroundColor: C.darkRim, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 28 }}>{rec.emoji || '🍽️'}</Text>
                      </View>
                  }
                  <Text style={sc.miniCardName} numberOfLines={2}>{rec.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={sc.lastScanStats}>
              {ingredients.length} ingredients · {recipes.length} recipes found
            </Text>
          </View>

          <Press
            onPress={() => { haptic.medium(); navigation.navigate('Results', { recipes, ingredients }); }}
            style={sc.seeAllBtn}
          >
            <View style={sc.seeAllInner}>
              <Text style={sc.seeAllText}>See all recipes</Text>
              <Ionicons name="arrow-forward" size={16} color={C.darkSage} />
            </View>
          </Press>

          <View style={{ height: S[4] }} />

          {/* Scan Again */}
          <Press onPress={() => startScan(true)} style={{ marginHorizontal: S[6] }} hapticType="medium">
            <LinearGradient
              colors={[C.brandMid, C.brand]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={sc.primaryBtn}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={sc.primaryBtnText}>Scan Again</Text>
            </LinearGradient>
          </Press>

          <View style={sc.secondaryRow}>
            <TouchableOpacity style={sc.secondaryBtn} onPress={() => startScan(false)}>
              <Text style={sc.secondaryBtnText}>Upload photo</Text>
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

  // ── Empty State ─────────────────────────────────────────────────────────────
  return (
    <View style={sc.scanRoot}>
      <StatusBar style="light" />
      <View style={sc.safeTop} />

      <View style={sc.header}>
        <Text style={sc.headerTitle}>FoodLens</Text>
        <TouchableOpacity style={sc.settingsBtn} onPress={() => { haptic.light(); setShowKeyModal(true); }}>
          <Ionicons name="settings-outline" size={20} color={C.darkSage} />
        </TouchableOpacity>
      </View>

      <View style={sc.emptyCenter}>
        {/* Concentric pulse rings */}
        <View style={sc.ringWrap}>
          {[0, 700, 1400].map(d => <PulseRing key={d} delay={d} size={160} />)}
          <View style={sc.scanIconContainer}>
            <Ionicons name="camera-outline" size={38} color={C.darkSage} />
          </View>
        </View>

        <Text style={sc.emptyClaim}>What's in your fridge?</Text>
        <Text style={sc.emptySubclaim}>AI detects ingredients and finds recipes instantly</Text>

        <Press onPress={() => startScan(true)} style={sc.primaryBtnWrap} hapticType="medium">
          <LinearGradient
            colors={[C.brandMid, C.brand]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={sc.primaryBtn}
          >
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={sc.primaryBtnText}>Scan Your Fridge</Text>
          </LinearGradient>
        </Press>

        <View style={sc.secondaryRow}>
          <TouchableOpacity style={sc.secondaryBtn} onPress={() => startScan(false)}>
            <Text style={sc.secondaryBtnText}>Upload photo</Text>
          </TouchableOpacity>
          <Text style={sc.dot}>·</Text>
          <TouchableOpacity style={sc.secondaryBtn} onPress={() => navigation.navigate('KitchenTab')}>
            <Text style={sc.secondaryBtnText}>Add manually</Text>
          </TouchableOpacity>
        </View>
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
  { id: 'shop',   label: 'Shopping' },
];

function ResultsScreen({ route, navigation }) {
  const { recipes = [], ingredients = [] } = route.params || {};
  const [filter, setFilter]     = useState('all');
  const [favorites, setFavorites] = useState([]);
  const [tabWidths, setTabWidths] = useState([]);

  const indicatorX   = useSharedValue(0);
  const indicatorW   = useSharedValue(0);
  const indicatorAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  useEffect(() => {
    AsyncStorage.getItem(KEYS.favorites).then(s => {
      if (s) setFavorites(JSON.parse(s));
    });
  }, []);

  const moveIndicator = useCallback((idx) => {
    if (tabWidths[idx] !== undefined) {
      const x = tabWidths.slice(0, idx).reduce((a, b) => a + b, 0);
      indicatorX.value = withSpring(x, SPRING.snappy);
      indicatorW.value = withSpring(tabWidths[idx], SPRING.snappy);
    }
  }, [tabWidths]);

  useEffect(() => {
    const idx = FILTER_TABS.findIndex(f => f.id === filter);
    moveIndicator(idx);
  }, [filter, tabWidths, moveIndicator]);

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

  const insets = useSafeAreaInsets();

  return (
    <View style={[re.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={re.header}>
        <Press onPress={() => navigation.goBack()} scale={0.92}>
          <View style={re.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.ink700} />
          </View>
        </Press>
        <View style={re.headerCenter}>
          <Text style={re.headerTitle}>Recipes for you</Text>
          <Text style={re.headerSub}>{pluralize(ingredients.length, 'ingredient')} scanned</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter tabs */}
      <View style={re.tabsWrap}>
        <View style={re.tabsRow}>
          {FILTER_TABS.map((tab, idx) => (
            <TouchableOpacity
              key={tab.id}
              style={re.tab}
              onLayout={e => {
                const w = e.nativeEvent.layout.width;
                setTabWidths(prev => {
                  const next = [...prev];
                  next[idx] = w;
                  return next;
                });
              }}
              onPress={() => {
                haptic.light();
                setFilter(tab.id);
              }}
              activeOpacity={0.8}
            >
              <Text style={[re.tabLabel, filter === tab.id && re.tabLabelActive]}>
                {tab.label}
              </Text>
              {counts[tab.id] > 0 && (
                <View style={[re.tabCount, filter === tab.id && re.tabCountActive]}>
                  <Text style={[re.tabCountText, filter === tab.id && re.tabCountTextActive]}>
                    {counts[tab.id]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {/* Sliding indicator */}
        <View style={re.indicatorTrack}>
          <Animated.View style={[re.indicator, indicatorAnim]} />
        </View>
      </View>

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
        renderItem={({ item, index }) => (
          <StaggerItem index={index}>
            <RecipeCard
              recipe={item}
              onPress={() => {
                haptic.light();
                navigation.navigate('RecipeDetail', { recipe: item, userIngredients: ingredients });
              }}
              onFavorite={toggleFav}
              isFavorited={isFaved(item)}
            />
          </StaggerItem>
        )}
      />
    </View>
  );
}

// ─── KitchenScreen ────────────────────────────────────────────────────────────

function KitchenScreen({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipesCount, setRecipesCount] = useState(0);
  const [readyCount, setReadyCount]     = useState(0);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [editIdx, setEditIdx]           = useState(null);
  const [editName, setEditName]         = useState('');
  const [editQty, setEditQty]           = useState('');
  const [newName, setNewName]           = useState('');
  const [newQty, setNewQty]             = useState('');

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
      { text: 'Remove', style: 'destructive', onPress: () => { haptic.medium(); save(ingredients.filter((_, i) => i !== idx)); setEditIdx(null); } },
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

  // Group by category
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
      <View style={ki.safeTop} />

      <View style={ki.header}>
        <Text style={ki.title}>My Kitchen</Text>
        <Press onPress={() => { haptic.light(); setShowAdd(true); }} scale={0.92}>
          <View style={ki.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        </Press>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Summary card */}
        {loading ? (
          <View style={{ marginHorizontal: S[6], marginBottom: S[6] }}>
            <Skeleton width="100%" height={88} radius={R.xl} />
          </View>
        ) : recipesCount > 0 && (
          <Press
            onPress={async () => {
              haptic.light();
              const s = await AsyncStorage.getItem(KEYS.recipes);
              const si = await AsyncStorage.getItem(KEYS.ingredients);
              if (s) {
                const p = JSON.parse(s);
                navigation.navigate('Results', { recipes: p.recipes || [], ingredients: si ? JSON.parse(si) : [] });
              }
            }}
            style={{ marginHorizontal: S[6], marginBottom: S[6] }}
          >
            <LinearGradient
              colors={[C.brandMid, C.brand]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }}
              style={ki.summaryCard}
            >
              <View style={ki.summaryLeft}>
                <Text style={ki.summaryNumber}>{recipesCount}</Text>
                <View>
                  <Text style={ki.summaryLabel}>recipes available</Text>
                  {readyCount > 0 && (
                    <Text style={ki.summarySub}>{readyCount} with all ingredients</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </Press>
        )}

        {/* Ingredients */}
        {loading ? (
          <View style={{ paddingHorizontal: S[6], gap: S[4] }}>
            {['Proteins', 'Vegetables'].map(c => (
              <View key={c}>
                <Skeleton width={80} height={14} radius={4} style={{ marginBottom: S[3] }} />
                <View style={{ flexDirection: 'row', gap: S[2], flexWrap: 'wrap' }}>
                  {[1,2,3].map(i => <Skeleton key={i} width={80 + i * 20} height={36} radius={R.full} />)}
                </View>
              </View>
            ))}
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
            {cats.map((cat, ci) => {
              const meta = getCategoryMeta(cat);
              return (
                <StaggerItem key={cat} index={ci}>
                  <View style={ki.catSection}>
                    <View style={ki.catLabelRow}>
                      <Text style={ki.catEmoji}>{meta.emoji}</Text>
                      <Text style={ki.catLabel}>{cat}</Text>
                    </View>
                    <View style={ki.chipRow}>
                      {grouped[cat].map(({ name, quantity, idx }) => (
                        <Press key={idx} onPress={() => openEdit(idx)} scale={0.94} hapticType="light">
                          <View style={ki.chip}>
                            <Text style={ki.chipText}>{capitalize(name)}</Text>
                            {quantity ? <Text style={ki.chipQty}> · {quantity}</Text> : null}
                          </View>
                        </Press>
                      ))}
                    </View>
                  </View>
                </StaggerItem>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={ki.addRow} onPress={() => { haptic.light(); setShowAdd(true); }}>
          <Ionicons name="add-circle-outline" size={18} color={C.brand} />
          <Text style={ki.addRowText}>Add ingredient</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editIdx !== null} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalOverlay}>
          <View style={ui.modalSheet}>
            <View style={ui.modalDragHandle} />
            <Text style={ui.modalTitle}>Edit ingredient</Text>
            <TextInput style={ui.input} placeholder="Name" value={editName} onChangeText={setEditName} />
            <TextInput style={ui.input} placeholder="Quantity (optional)" value={editQty} onChangeText={setEditQty} />
            <View style={ui.modalBtnRow}>
              <Press onPress={() => deleteIng(editIdx)} style={{ flex: 1 }}>
                <View style={ui.btnDanger}><Text style={ui.btnDangerText}>Remove</Text></View>
              </Press>
              <Press onPress={() => setEditIdx(null)} style={{ flex: 1 }}>
                <View style={ui.btnSecondary}><Text style={ui.btnSecondaryText}>Cancel</Text></View>
              </Press>
              <Press onPress={saveEdit} style={{ flex: 1 }} hapticType="medium">
                <View style={ui.btnPrimary}><Text style={ui.btnPrimaryText}>Save</Text></View>
              </Press>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalOverlay}>
          <View style={ui.modalSheet}>
            <View style={ui.modalDragHandle} />
            <Text style={ui.modalTitle}>Add ingredient</Text>
            <TextInput style={ui.input} placeholder="Name" value={newName} onChangeText={setNewName} autoFocus />
            <TextInput style={ui.input} placeholder="Quantity (optional)" value={newQty} onChangeText={setNewQty} />
            <View style={ui.modalBtnRow}>
              <Press onPress={() => setShowAdd(false)} style={{ flex: 1 }}>
                <View style={ui.btnSecondary}><Text style={ui.btnSecondaryText}>Cancel</Text></View>
              </Press>
              <Press onPress={addIng} style={{ flex: 2 }} hapticType="medium">
                <View style={[ui.btnPrimary, !newName.trim() && { opacity: 0.45 }]}>
                  <Text style={ui.btnPrimaryText}>Add</Text>
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

function SavedScreen({ navigation }) {
  const [favorites, setFavorites]   = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInput, setShowInput]   = useState(false);
  const [newItem, setNewItem]       = useState('');

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
      if (h) setHistory(JSON.parse(h).slice(0, 5));
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

  const uncheckedCount = shoppingList.filter(i => !i.checked).length;

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
      <View style={sv.safeTop} />

      <View style={sv.header}>
        <Text style={sv.title}>Saved</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Shopping List */}
        <View style={sv.section}>
          <View style={sv.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2] }}>
              <Text style={sv.sectionTitle}>Shopping List</Text>
              {uncheckedCount > 0 && (
                <View style={sv.badge}>
                  <Text style={sv.badgeText}>{uncheckedCount}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: S[3] }}>
              {shoppingList.length > 0 && (
                <TouchableOpacity onPress={shareList}>
                  <Ionicons name="share-outline" size={20} color={C.ink400} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { haptic.light(); setShowInput(v => !v); }}>
                <Ionicons name={showInput ? 'close' : 'add'} size={22} color={C.brand} />
              </TouchableOpacity>
            </View>
          </View>

          {showInput && (
            <View style={sv.addRow}>
              <TextInput
                style={sv.addInput}
                placeholder="Add item…"
                placeholderTextColor={C.ink300}
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
            <View style={{ gap: S[2] }}>
              {[1,2,3].map(i => <Skeleton key={i} width="100%" height={52} radius={R.lg} />)}
            </View>
          ) : shoppingList.length === 0 ? (
            <Text style={sv.emptyNote}>
              Add items here, or save missing ingredients directly from any recipe.
            </Text>
          ) : (
            <View style={{ gap: S[2] }}>
              {shoppingList.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[sv.shoppingItem, item.checked && sv.shoppingItemDone]}
                  onPress={() => toggleItem(idx)}
                  activeOpacity={0.85}
                >
                  <View style={[sv.checkbox, item.checked && sv.checkboxDone]}>
                    {item.checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sv.itemName, item.checked && sv.itemNameDone]}>{item.name}</Text>
                    {item.recipeName && (
                      <Text style={sv.itemRecipe}>{item.recipeName}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => { haptic.light(); saveList(shoppingList.filter((_, i) => i !== idx)); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color={C.ink300} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {shoppingList.filter(i => i.checked).length > 0 && (
                <TouchableOpacity
                  style={sv.clearBtn}
                  onPress={() => { haptic.light(); saveList(shoppingList.filter(i => !i.checked)); }}
                >
                  <Ionicons name="trash-outline" size={14} color={C.rose} />
                  <Text style={sv.clearText}>
                    Clear {shoppingList.filter(i => i.checked).length} checked
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Saved Recipes */}
        <View style={sv.section}>
          <View style={sv.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2] }}>
              <Text style={sv.sectionTitle}>Saved Recipes</Text>
              {favorites.length > 0 && (
                <View style={[sv.badge, { backgroundColor: C.roseBg }]}>
                  <Text style={[sv.badgeText, { color: C.rose }]}>{favorites.length}</Text>
                </View>
              )}
            </View>
          </View>

          {loading ? (
            <View style={sv.grid}>
              {[1,2,3,4].map(i => <Skeleton key={i} width={(W - S[6]*2 - S[3]) / 2} height={160} radius={R.xl} />)}
            </View>
          ) : favorites.length === 0 ? (
            <Text style={sv.emptyNote}>
              Tap the heart on any recipe to save it to your collection.
            </Text>
          ) : (
            <View style={sv.grid}>
              {favorites.map((rec, i) => (
                <StaggerItem key={`${rec.id}-${i}`} index={i}>
                  <GridCard
                    recipe={rec}
                    onPress={() => { haptic.light(); navigation.navigate('RecipeDetail', { recipe: rec }); }}
                  />
                </StaggerItem>
              ))}
            </View>
          )}
        </View>

        {/* Scan History */}
        {history.length > 0 && (
          <View style={sv.section}>
            <View style={sv.sectionHeader}>
              <Text style={sv.sectionTitle}>Scan History</Text>
            </View>
            {history.map(entry => (
              <View key={entry.id} style={sv.historyItem}>
                <View style={sv.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={sv.historyDate}>{formatScanDate(entry.date)}</Text>
                  <Text style={sv.historySub}>{pluralize(entry.ingredients?.length || 0, 'ingredient')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.ink300} />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── RecipeDetailScreen ───────────────────────────────────────────────────────

function RecipeDetailScreen({ route, navigation }) {
  const { recipe, userIngredients = [] } = route.params;
  const [isFaved, setIsFaved] = useState(false);
  const insets = useSafeAreaInsets();
  const HERO = H * 0.44;

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
    const newItems = missing
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
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ height: HERO, position: 'relative' }}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          ) : (
            <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgSubtle }]}>
              <Text style={{ fontSize: 90 }}>{recipe.emoji || '🍽️'}</Text>
            </View>
          )}
          {/* Cinematic gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.38)', 'transparent', 'rgba(0,0,0,0.52)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Nav */}
          <View style={[de.nav, { paddingTop: insets.top + S[2] }]}>
            <Press onPress={() => navigation.goBack()} scale={0.9}>
              <View style={de.navBtn}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
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
                  <Ionicons name={isFaved ? 'heart' : 'heart-outline'} size={20} color={isFaved ? '#FF3B30' : '#fff'} />
                </View>
              </Press>
            </View>
          </View>
        </View>

        {/* Content card */}
        <View style={de.card}>
          {/* Tags */}
          <View style={de.tagRow}>
            {recipe.area && <View style={de.tag}><Text style={de.tagText}>{recipe.area}</Text></View>}
            {recipe.category && <View style={de.tag}><Text style={de.tagText}>{recipe.category}</Text></View>}
          </View>

          {/* Title — Playfair Display */}
          <Text style={de.title}>{recipe.name}</Text>

          {/* Match row */}
          {recipe.match_percent !== undefined && (
            <View style={de.matchRow}>
              <MatchDots matchPercent={recipe.match_percent} size={10} />
              <Text style={de.matchText}>
                {isReady
                  ? 'You have all ingredients'
                  : `${recipe.matched_count || 0} of ${total} ingredients`}
              </Text>
              {isReady && (
                <View style={de.readyPill}>
                  <Text style={de.readyPillText}>Ready</Text>
                </View>
              )}
            </View>
          )}

          {/* Missing ingredients inline */}
          {recipe.missing_ingredients?.length > 0 && (
            <View style={de.missingCard}>
              <View style={de.missingHeader}>
                <Ionicons name="cart-outline" size={15} color={C.amber} />
                <Text style={de.missingTitle}>You're missing</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S[2], marginBottom: S[3] }}>
                {recipe.missing_ingredients.map((m, i) => (
                  <View key={i} style={de.missingPill}>
                    <Text style={de.missingPillText}>{m}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={de.addToListBtn} onPress={addMissing}>
                <Ionicons name="add-circle-outline" size={15} color={C.brand} />
                <Text style={de.addToListText}>Add to shopping list</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ingredients list */}
          {recipe.ingredients?.length > 0 && (
            <View style={de.section}>
              <Text style={de.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ing, i) => {
                const have = recipe.matched_ingredients?.some(m =>
                  m.toLowerCase().includes(ing.name.toLowerCase()) ||
                  ing.name.toLowerCase().includes(m.toLowerCase())
                );
                return (
                  <View key={i} style={[de.ingRow, i < recipe.ingredients.length - 1 && de.ingRowBorder]}>
                    <View style={[de.ingStatus, { backgroundColor: have ? C.emeraldBg : C.bgSubtle }]}>
                      <Ionicons
                        name={have ? 'checkmark' : 'close'}
                        size={12}
                        color={have ? C.emerald : C.ink300}
                      />
                    </View>
                    <Text style={de.ingMeasure}>{ing.measure}</Text>
                    <Text style={[de.ingName, !have && { color: C.ink400 }]}>{ing.name}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Instructions */}
          {recipe.steps?.length > 0 && (
            <View style={de.section}>
              <Text style={de.sectionTitle}>Instructions</Text>
              {recipe.steps.map((step, i) => (
                <View key={i} style={de.stepRow}>
                  <View style={de.stepNum}>
                    <Text style={de.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={de.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* CTAs */}
          <View style={de.actions}>
            {hasCook && (
              <Press
                onPress={() => { haptic.medium(); navigation.navigate('CookMode', { recipe }); }}
                hapticType="medium"
              >
                <LinearGradient
                  colors={[C.brandMid, C.brand]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={de.cookBtn}
                >
                  <Ionicons name="flame-outline" size={20} color="#fff" />
                  <Text style={de.cookBtnText}>Start Cooking</Text>
                  <Ionicons name="arrow-forward" size={17} color="rgba(255,255,255,0.6)" />
                </LinearGradient>
              </Press>
            )}

            <View style={de.secActions}>
              <Press onPress={toggleFav} style={{ flex: 1 }}>
                <View style={de.secBtn}>
                  <Ionicons name={isFaved ? 'heart' : 'heart-outline'} size={17} color={isFaved ? C.rose : C.brand} />
                  <Text style={de.secBtnText}>{isFaved ? 'Saved' : 'Save'}</Text>
                </View>
              </Press>
              {(recipe.source || recipe.youtube) && (
                <Press onPress={() => Linking.openURL(recipe.source || recipe.youtube)} style={{ flex: 1 }}>
                  <View style={de.secBtn}>
                    <Ionicons name="open-outline" size={17} color={C.brand} />
                    <Text style={de.secBtnText}>Source</Text>
                  </View>
                </Press>
              )}
            </View>
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
  const insets = useSafeAreaInsets();

  const progress  = useSharedValue(0);
  const textOp    = useSharedValue(1);
  const textTy    = useSharedValue(0);
  const doneScale = useSharedValue(0);

  useEffect(() => {
    const pct = steps.length > 1 ? step / (steps.length - 1) : 1;
    progress.value = withSpring(pct, SPRING.gentle);
    if (step === steps.length - 1 && steps.length > 1) {
      doneScale.value = withSpring(1, SPRING.bouncy);
    }
  }, [step]);

  const progressAnim = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  const textAnim = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ translateY: textTy.value }],
  }));

  function animStep(direction, cb) {
    textOp.value  = withTiming(0, { duration: TIMING.instant });
    textTy.value  = withTiming(direction * -14, { duration: TIMING.instant }, () => {
      runOnJS(cb)();
      textTy.value  = direction * 14;
      textOp.value  = withTiming(1, { duration: TIMING.fast });
      textTy.value  = withSpring(0, SPRING.gentle);
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
        <StatusBar style="light" />
        <EmptyState icon="reader-outline" title="No instructions" subtitle="This recipe has no steps." dark />
        <TouchableOpacity style={cm.exitBtn} onPress={() => navigation.goBack()}>
          <Text style={cm.exitBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[cm.root, { paddingTop: insets.top }]} {...panResponder.panHandlers}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={cm.topBar}>
        <Text style={cm.stepLabel}>STEP {step + 1} OF {steps.length}</Text>
        <TouchableOpacity
          style={cm.closeBtn}
          onPress={() => { haptic.light(); navigation.goBack(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={C.darkText} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={cm.progressTrack}>
        <Animated.View style={[cm.progressFill, progressAnim]} />
      </View>

      <Text style={cm.recipeName} numberOfLines={1}>{recipe.name}</Text>

      {/* Step dots */}
      <View style={cm.dotsRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              cm.dot,
              i === step && cm.dotActive,
              i < step && cm.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Step text */}
      <Animated.View style={[cm.stepContent, textAnim]}>
        <Text style={cm.stepText}>{steps[step]}</Text>
      </Animated.View>

      {/* Navigation */}
      <View style={[cm.navRow, { paddingBottom: insets.bottom + S[4] }]}>
        <Press
          onPress={goPrev}
          scale={0.95}
          style={[cm.navBtnWrap, step === 0 && { opacity: 0.28 }]}
          disabled={step === 0}
        >
          <View style={cm.navBtnSecondary}>
            <Ionicons name="arrow-back" size={18} color={C.darkSage} />
            <Text style={cm.navBtnSecondaryText}>Prev</Text>
          </View>
        </Press>

        <Press onPress={isLast ? () => navigation.goBack() : goNext} scale={0.97} style={{ flex: 2 }} hapticType="medium">
          <LinearGradient
            colors={[C.brandMid, C.brand]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={cm.navBtnPrimary}
          >
            <Text style={cm.navBtnPrimaryText}>{isLast ? 'Done!' : 'Next Step'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
          </LinearGradient>
        </Press>
      </View>
    </View>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const isDark = route.name === 'ScanTab';
        return {
          headerShown: false,
          tabBarStyle: [
            isDark ? tb.dark : tb.light,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
          ],
          tabBarActiveTintColor:   isDark ? C.darkSage : C.brand,
          tabBarInactiveTintColor: isDark ? 'rgba(124,184,152,0.4)' : C.ink300,
          tabBarLabelStyle: tb.label,
          tabBarHideOnKeyboard: true,
        };
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
  const [fontsLoaded] = useFonts({
    'Inter-Regular':   Inter_400Regular,
    'Inter-Medium':    Inter_500Medium,
    'Inter-SemiBold':  Inter_600SemiBold,
    'Inter-Bold':      Inter_700Bold,
    'Playfair-Bold':   PlayfairDisplay_700Bold,
    'Playfair-SemiBold': PlayfairDisplay_600SemiBold,
  });

  if (!fontsLoaded) return null;

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
// Organized by screen prefix to avoid naming collisions.

// ── Global UI ────────────────────────────────────────────────────────────────
const ui = StyleSheet.create({
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: S[10],
    paddingHorizontal: S[8],
  },
  emptyIcon: {
    width: 72, height: 72,
    borderRadius: R['2xl'],
    backgroundColor: C.brandTint,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[5],
  },
  emptyTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md,
    color: C.ink700,
    marginBottom: S[2],
    textAlign: 'center',
    letterSpacing: FONT.snug,
  },
  emptySub: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.ink400,
    textAlign: 'center',
    lineHeight: FONT.sm * FONT.normal2,
  },
  emptyBtn: { marginTop: S[5] },
  emptyBtnInner: {
    backgroundColor: C.brand,
    paddingHorizontal: S[6],
    paddingVertical: S[3] + 2,
    borderRadius: R.full,
    ...SHADOW.md,
  },
  emptyBtnText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: '#fff',
  },

  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S[3],
  },
  sectionLabel: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.xs,
    color: C.ink400,
    textTransform: 'uppercase',
    letterSpacing: FONT.wider,
  },

  // Recipe card (full-width)
  card: {
    backgroundColor: C.bgSurface,
    borderRadius: R['2xl'],
    overflow: 'hidden',
    ...SHADOW.md,
  },
  cardImageWrap: {
    height: 210,
    position: 'relative',
    backgroundColor: C.bgSubtle,
  },
  cardImage: {
    width: '100%', height: '100%', resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.bgSubtle,
  },
  cardGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
  },
  cardReadyBadge: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.emerald,
    paddingHorizontal: S[3], paddingVertical: 5,
    borderRadius: R.full,
  },
  cardReadyText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.xs, color: '#fff',
  },
  cardCuisineTag: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: S[3], paddingVertical: 4,
    borderRadius: R.full,
  },
  cardCuisineText: {
    fontFamily: FONT.sansMed, fontSize: 11, color: '#fff',
  },
  cardContent: {
    padding: S[4], paddingRight: S[4] + 28,
  },
  cardTitle: {
    fontFamily: FONT.serif,
    fontSize: FONT.lg,
    color: C.ink900,
    lineHeight: FONT.lg * FONT.snug2,
    letterSpacing: FONT.tight,
    marginBottom: S[2],
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[3],
  },
  cardMetaText: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm, color: C.ink400,
  },
  cardMissing: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.xs,
    color: C.amber,
    marginTop: S[1] + 2,
  },
  cardHeart: {
    position: 'absolute', bottom: S[4], right: S[4],
  },

  // Grid card
  gridCard: {
    width: (W - S[6] * 2 - S[3]) / 2,
    backgroundColor: C.bgSurface,
    borderRadius: R.xl,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  gridCardImg: {
    width: '100%', height: 110, resizeMode: 'cover',
  },
  gridCardPlaceholder: {
    width: '100%', height: 110,
    backgroundColor: C.bgSubtle,
    justifyContent: 'center', alignItems: 'center',
  },
  gridCardBody: { padding: S[3] },
  gridCardTitle: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: C.ink700,
    lineHeight: FONT.sm * FONT.normal2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  modalSheet: {
    backgroundColor: C.bgSurface,
    borderTopLeftRadius: R['3xl'],
    borderTopRightRadius: R['3xl'],
    padding: S[6],
    paddingBottom: S[10],
    ...SHADOW.lg,
  },
  modalDragHandle: {
    width: 36, height: 4,
    backgroundColor: C.rim,
    borderRadius: R.full,
    alignSelf: 'center',
    marginBottom: S[5],
  },
  modalIconRow: { alignItems: 'center', marginBottom: S[4] },
  modalIconBg: {
    width: 52, height: 52, borderRadius: R.xl,
    backgroundColor: C.brandTint,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.lg,
    color: C.ink900,
    textAlign: 'center',
    marginBottom: S[1],
    letterSpacing: FONT.snug,
  },
  modalSub: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm, color: C.ink400,
    textAlign: 'center',
    marginBottom: S[5],
  },
  input: {
    height: 52,
    backgroundColor: C.bgSubtle,
    borderRadius: R.lg,
    paddingHorizontal: S[4],
    fontFamily: FONT.sans,
    fontSize: FONT.base,
    color: C.ink700,
    marginBottom: S[3],
    borderWidth: 1.5,
    borderColor: C.rim,
  },
  modalBtnRow: {
    flexDirection: 'row', gap: S[2], marginTop: S[2],
  },
  btnPrimary: {
    height: 52, borderRadius: R.lg,
    backgroundColor: C.brand,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  btnPrimaryText: {
    fontFamily: FONT.sansBold, fontSize: FONT.base, color: '#fff',
  },
  btnSecondary: {
    height: 52, borderRadius: R.lg,
    backgroundColor: C.bgSubtle,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.rim,
  },
  btnSecondaryText: {
    fontFamily: FONT.sansSemiBold, fontSize: FONT.base, color: C.ink500,
  },
  btnDanger: {
    height: 52, borderRadius: R.lg,
    backgroundColor: C.roseBg,
    justifyContent: 'center', alignItems: 'center',
  },
  btnDangerText: {
    fontFamily: FONT.sansSemiBold, fontSize: FONT.base, color: C.rose,
  },
});

// ── ScanScreen Styles ────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  scanRoot: {
    flex: 1, backgroundColor: C.dark,
  },
  safeTop: { height: 52 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[6],
    paddingBottom: S[4],
  },
  headerTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.xl,
    color: C.darkText,
    letterSpacing: FONT.tight,
  },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(124,184,152,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S[6],
    paddingBottom: S[12],
  },
  ringWrap: {
    width: 160, height: 160,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[8],
  },
  scanIconContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.darkRim,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: C.darkBorder,
    ...SHADOW.md,
  },
  emptyClaim: {
    fontFamily: FONT.sansBold,
    fontSize: FONT['2xl'],
    color: C.darkText,
    textAlign: 'center',
    letterSpacing: FONT.tight,
    lineHeight: FONT['2xl'] * FONT.tight2,
    marginBottom: S[3],
  },
  emptySubclaim: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.darkTextSub,
    textAlign: 'center',
    lineHeight: FONT.sm * FONT.normal2,
    marginBottom: S[8],
  },
  primaryBtnWrap: { width: '100%', maxWidth: 340 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4] + 2,
    paddingHorizontal: S[6],
    borderRadius: R.full,
    ...SHADOW.md,
  },
  primaryBtnText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md,
    color: '#fff',
    letterSpacing: FONT.snug,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[3],
    marginTop: S[4],
  },
  secondaryBtn: {
    paddingVertical: S[2], paddingHorizontal: S[3],
  },
  secondaryBtnText: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm,
    color: C.darkSage,
  },
  dot: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.darkSage,
    opacity: 0.4,
  },

  // Has results
  lastScanCard: {
    marginHorizontal: S[6],
    backgroundColor: C.darkSurface,
    borderRadius: R['2xl'],
    padding: S[4],
    marginBottom: S[4],
    borderWidth: 1,
    borderColor: C.darkBorder,
  },
  lastScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[2],
  },
  lastScanDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.darkSage,
  },
  lastScanLabel: {
    flex: 1,
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm,
    color: C.darkSage,
  },
  miniCard: {
    width: 104, marginRight: S[3],
  },
  miniCardImg: {
    width: 104, height: 72,
    borderRadius: R.lg,
    resizeMode: 'cover',
    marginBottom: S[2],
    backgroundColor: C.darkRim,
  },
  miniCardName: {
    fontFamily: FONT.sansMed,
    fontSize: 11,
    color: C.darkTextSub,
    lineHeight: 15,
  },
  lastScanStats: {
    fontFamily: FONT.sans,
    fontSize: FONT.xs,
    color: C.darkTextSub,
    marginTop: S[3],
  },
  seeAllBtn: {
    marginHorizontal: S[6],
    marginBottom: S[2],
  },
  seeAllInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[3],
  },
  seeAllText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: C.darkSage,
  },

  // Loading
  loadingTop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: S[12],
  },
  loadingSpinner: {
    width: 100, height: 100,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: S[7],
  },
  loadingIconBg: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.darkRim,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.darkBorder,
  },
  loadingTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.xl,
    color: C.darkText,
    textAlign: 'center',
    letterSpacing: FONT.snug,
    marginBottom: S[2],
  },
  loadingSubtitle: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.darkTextSub,
    textAlign: 'center',
  },
  ingredientCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: S[2],
    paddingHorizontal: S[6],
    paddingVertical: S[6],
  },
  ingredientPill: {
    backgroundColor: 'rgba(124,184,152,0.12)',
    borderRadius: R.full,
    paddingHorizontal: S[4],
    paddingVertical: S[2],
    borderWidth: 1,
    borderColor: 'rgba(124,184,152,0.2)',
  },
  ingredientPillText: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm,
    color: C.darkSage,
  },
  loadingBottom: {
    paddingHorizontal: S[8],
    paddingBottom: S[10],
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%', height: 2,
    backgroundColor: 'rgba(124,184,152,0.15)',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: S[3],
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.darkSage,
    borderRadius: 1,
  },
  progressLabel: {
    fontFamily: FONT.sans,
    fontSize: 11,
    color: C.darkTextSub,
  },
});

// ── Results Styles ────────────────────────────────────────────────────────────
const re = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: C.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S[6],
    paddingTop: S[3],
    paddingBottom: S[4],
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.xs,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md,
    color: C.ink900,
    letterSpacing: FONT.snug,
  },
  headerSub: {
    fontFamily: FONT.sans,
    fontSize: FONT.xs,
    color: C.ink400,
    marginTop: 2,
  },
  tabsWrap: {
    backgroundColor: C.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: C.rim,
    paddingHorizontal: S[6],
    paddingTop: S[2],
  },
  tabsRow: {
    flexDirection: 'row',
    paddingBottom: S[3],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: S[2],
  },
  tabLabel: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: C.ink400,
  },
  tabLabelActive: { color: C.brand },
  tabCount: {
    backgroundColor: C.rim,
    borderRadius: R.full,
    minWidth: 18, height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center', alignItems: 'center',
  },
  tabCountActive: { backgroundColor: C.brandTint },
  tabCountText: {
    fontFamily: FONT.sansBold, fontSize: 10, color: C.ink400,
  },
  tabCountTextActive: { color: C.brand },
  indicatorTrack: {
    height: 2.5,
    position: 'relative',
    marginTop: -1,
  },
  indicator: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    backgroundColor: C.brand,
    borderRadius: R.full,
  },
  listContent: {
    paddingHorizontal: S[6],
    paddingTop: S[5],
    paddingBottom: 120,
    gap: S[4],
  },
});

// ── Kitchen Styles ────────────────────────────────────────────────────────────
const ki = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgBase },
  safeTop: { height: 52 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[6],
    paddingBottom: S[4],
  },
  title: {
    fontFamily: FONT.sansBold,
    fontSize: FONT['2xl'],
    color: C.ink900,
    letterSpacing: FONT.tight,
  },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.brand,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: R['2xl'],
    padding: S[5],
    ...SHADOW.md,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[4],
  },
  summaryNumber: {
    fontFamily: FONT.sansBold,
    fontSize: FONT['4xl'],
    color: '#fff',
    letterSpacing: FONT.tight,
  },
  summaryLabel: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.base,
    color: 'rgba(255,255,255,0.9)',
  },
  summarySub: {
    fontFamily: FONT.sans,
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  categories: {
    paddingHorizontal: S[6],
    gap: S[6],
  },
  catSection: {},
  catLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[2],
    marginBottom: S[3],
  },
  catEmoji: { fontSize: 14 },
  catLabel: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.xs,
    color: C.ink400,
    textTransform: 'uppercase',
    letterSpacing: FONT.wider,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSurface,
    borderRadius: R.full,
    paddingHorizontal: S[4],
    paddingVertical: S[2] + 2,
    borderWidth: 1,
    borderColor: C.rim,
    ...SHADOW.xs,
  },
  chipText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: C.ink700,
  },
  chipQty: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.ink400,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    marginHorizontal: S[6],
    marginTop: S[6],
    paddingVertical: S[4],
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: C.rim,
    borderStyle: 'dashed',
  },
  addRowText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm,
    color: C.brand,
  },
});

// ── Saved Styles ──────────────────────────────────────────────────────────────
const sv = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgBase },
  safeTop: { height: 52 },
  header: {
    paddingHorizontal: S[6],
    paddingBottom: S[4],
  },
  title: {
    fontFamily: FONT.sansBold,
    fontSize: FONT['2xl'],
    color: C.ink900,
    letterSpacing: FONT.tight,
  },
  section: {
    paddingHorizontal: S[6],
    marginBottom: S[7],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S[4],
  },
  sectionTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md,
    color: C.ink900,
    letterSpacing: FONT.snug,
  },
  badge: {
    backgroundColor: C.brandTint,
    borderRadius: R.full,
    minWidth: 20, height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: {
    fontFamily: FONT.sansBold,
    fontSize: 11,
    color: C.brand,
  },
  emptyNote: {
    fontFamily: FONT.sans,
    fontSize: FONT.sm,
    color: C.ink400,
    lineHeight: FONT.sm * FONT.normal2,
  },
  addRow: {
    flexDirection: 'row',
    gap: S[2],
    marginBottom: S[3],
  },
  addInput: {
    flex: 1, height: 48,
    backgroundColor: C.bgSurface,
    borderRadius: R.lg,
    paddingHorizontal: S[4],
    fontFamily: FONT.sans,
    fontSize: FONT.base,
    color: C.ink700,
    borderWidth: 1.5,
    borderColor: C.rim,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: S[4],
    backgroundColor: C.brand,
    borderRadius: R.lg,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  addBtnText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.sm,
    color: '#fff',
  },
  shoppingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSurface,
    borderRadius: R.lg,
    paddingHorizontal: S[4],
    paddingVertical: S[3] + 2,
    borderWidth: 1,
    borderColor: C.rim,
    gap: S[3],
  },
  shoppingItemDone: {
    opacity: 0.55,
    borderColor: C.emeraldBg,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.rim,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: C.brand, borderColor: C.brand,
  },
  itemName: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.base,
    color: C.ink700,
  },
  itemNameDone: {
    textDecorationLine: 'line-through',
    color: C.ink300,
  },
  itemRecipe: {
    fontFamily: FONT.sans,
    fontSize: FONT.xs,
    color: C.ink400,
    marginTop: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[3],
    marginTop: S[2],
  },
  clearText: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm,
    color: C.rose,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S[3],
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSurface,
    borderRadius: R.lg,
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    marginBottom: S[2],
    borderWidth: 1,
    borderColor: C.rim,
    gap: S[3],
  },
  historyDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.brand,
  },
  historyDate: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm, color: C.ink700,
  },
  historySub: {
    fontFamily: FONT.sans,
    fontSize: FONT.xs, color: C.ink400, marginTop: 2,
  },
});

// ── Detail Styles ─────────────────────────────────────────────────────────────
const de = StyleSheet.create({
  nav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: S[5],
    zIndex: 10,
  },
  navBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: C.bgBase,
    paddingHorizontal: S[6],
    paddingTop: S[5],
  },
  tagRow: {
    flexDirection: 'row',
    gap: S[2],
    marginBottom: S[3],
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: C.bgSubtle,
    borderRadius: R.full,
    paddingHorizontal: S[3],
    paddingVertical: S[1] + 2,
  },
  tagText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.xs, color: C.ink500,
  },
  title: {
    fontFamily: FONT.serif,
    fontSize: FONT['3xl'],
    color: C.ink900,
    lineHeight: FONT['3xl'] * FONT.tight2,
    letterSpacing: FONT.tight,
    marginBottom: S[4],
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S[3],
    backgroundColor: C.bgSurface,
    borderRadius: R.lg,
    padding: S[4],
    marginBottom: S[5],
    borderWidth: 1,
    borderColor: C.rim,
  },
  matchText: {
    flex: 1,
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm, color: C.ink500,
  },
  readyPill: {
    backgroundColor: C.emeraldBg,
    borderRadius: R.full,
    paddingHorizontal: S[3],
    paddingVertical: 4,
  },
  readyPillText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.xs, color: C.emeraldText,
  },
  missingCard: {
    backgroundColor: C.amberBg,
    borderRadius: R.xl,
    padding: S[4],
    marginBottom: S[5],
    borderWidth: 1,
    borderColor: `${C.amber}30`,
  },
  missingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: S[2], marginBottom: S[3],
  },
  missingTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.sm, color: C.amberText,
  },
  missingPill: {
    backgroundColor: C.bgSurface,
    borderRadius: R.full,
    paddingHorizontal: S[3],
    paddingVertical: S[1] + 2,
    borderWidth: 1,
    borderColor: `${C.amber}40`,
  },
  missingPillText: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.sm, color: C.ink700,
  },
  addToListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S[2],
  },
  addToListText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm, color: C.brand,
  },
  section: { marginBottom: S[6] },
  sectionTitle: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md,
    color: C.ink900,
    letterSpacing: FONT.snug,
    marginBottom: S[3],
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S[3],
    gap: S[3],
  },
  ingRowBorder: {
    borderBottomWidth: 1, borderBottomColor: C.rimSubtle,
  },
  ingStatus: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  ingMeasure: {
    width: 88,
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.sm, color: C.ink400,
  },
  ingName: {
    flex: 1,
    fontFamily: FONT.sans,
    fontSize: FONT.base, color: C.ink700,
  },
  stepRow: {
    flexDirection: 'row',
    gap: S[3],
    marginBottom: S[4],
  },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.brand,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  stepNumText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.xs, color: '#fff',
  },
  stepText: {
    flex: 1,
    fontFamily: FONT.sans,
    fontSize: FONT.base, color: C.ink700,
    lineHeight: FONT.base * FONT.loose,
  },
  actions: {
    gap: S[3], marginBottom: S[6],
  },
  cookBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4] + 2,
    borderRadius: R.full,
    ...SHADOW.md,
  },
  cookBtnText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md, color: '#fff',
    letterSpacing: FONT.snug,
  },
  secActions: {
    flexDirection: 'row', gap: S[2],
  },
  secBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4],
    borderRadius: R.lg,
    backgroundColor: C.bgSurface,
    borderWidth: 1.5, borderColor: C.rim,
  },
  secBtnText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.base, color: C.brand,
  },
});

// ── Cook Mode Styles ──────────────────────────────────────────────────────────
const cm = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: C.dark,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S[6],
    paddingVertical: S[4],
  },
  stepLabel: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.xs, color: C.darkSage,
    letterSpacing: FONT.wider,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(124,184,152,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  progressTrack: {
    marginHorizontal: S[6],
    height: 2,
    backgroundColor: 'rgba(124,184,152,0.15)',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: S[3],
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.darkSage,
    borderRadius: 1,
  },
  recipeName: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.xs,
    color: C.darkTextSub,
    paddingHorizontal: S[6],
    marginBottom: S[4],
    textTransform: 'uppercase',
    letterSpacing: FONT.wider,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: S[6],
    marginBottom: S[6],
    flexWrap: 'wrap',
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(124,184,152,0.2)',
  },
  dotActive: {
    backgroundColor: C.darkSage,
    width: 18,
  },
  dotDone: {
    backgroundColor: `${C.darkSage}50`,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: S[6],
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: FONT.sansMed,
    fontSize: FONT.xl + 2,
    color: C.darkText,
    lineHeight: (FONT.xl + 2) * FONT.loose,
    letterSpacing: FONT.snug,
  },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: S[6],
    paddingTop: S[5],
    gap: S[3],
  },
  navBtnWrap: { flex: 1 },
  navBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4],
    borderRadius: R.full,
    backgroundColor: 'rgba(124,184,152,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,184,152,0.15)',
  },
  navBtnSecondaryText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.base, color: C.darkSage,
  },
  navBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: S[2],
    paddingVertical: S[4],
    borderRadius: R.full,
    ...SHADOW.md,
  },
  navBtnPrimaryText: {
    fontFamily: FONT.sansBold,
    fontSize: FONT.md, color: '#fff',
  },
  exitBtn: {
    marginHorizontal: S[6],
    paddingVertical: S[4],
    borderRadius: R.full,
    backgroundColor: 'rgba(124,184,152,0.1)',
    alignItems: 'center',
  },
  exitBtnText: {
    fontFamily: FONT.sansSemiBold,
    fontSize: FONT.base, color: C.darkSage,
  },
});

// ── Tab Bar Styles ────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  dark: {
    position: 'absolute',
    backgroundColor: 'rgba(8,13,10,0.96)',
    borderTopWidth: 0,
    height: 84,
    paddingTop: S[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
    borderTopColor: 'rgba(124,184,152,0.08)',
  },
  light: {
    position: 'absolute',
    backgroundColor: 'rgba(245,241,234,0.96)',
    borderTopWidth: 1,
    borderTopColor: C.rimSubtle,
    height: 84,
    paddingTop: S[2],
    shadowColor: '#1A0F00',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 12,
    borderTopLeftRadius: R['2xl'],
    borderTopRightRadius: R['2xl'],
  },
  label: {
    fontFamily: FONT.sansSemiBold,
    fontSize: 10,
    marginTop: 2,
  },
});
