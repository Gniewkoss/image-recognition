import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
  Dimensions,
  Linking,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
  SafeAreaView as SafeAreaViewEdges,
} from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

const SHADOWS = {
  sm: {
    shadowColor: "#16120C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  md: {
    shadowColor: "#16120C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: "#16120C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
};

const API_KEY_STORAGE = "@openai_api_key";
const FAVORITES_STORAGE = "@favorite_recipes";
const HISTORY_STORAGE = "@scan_history";
const INGREDIENTS_STORAGE = "@current_ingredients";
const RECIPES_STORAGE = "@current_recipes";
const SHOPPING_LIST_STORAGE = "@shopping_list";

const API_PORT = process.env.EXPO_PUBLIC_SERVER_PORT?.trim() || "5001";

function getExpoDevHostname() {
  const uri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (!uri || typeof uri !== "string") return null;
  return uri.split(":")[0] || null;
}

function inferBackendBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = getExpoDevHostname();
  if (host && host !== "localhost") return `http://${host}:${API_PORT}`;
  if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}`;
  return `http://127.0.0.1:${API_PORT}`;
}

const SERVER_URL = inferBackendBaseUrl();

function humanizeApiError(body, httpStatus) {
  if (!body || typeof body !== "string") {
    return httpStatus ? `Request failed (HTTP ${httpStatus}).` : "Request failed.";
  }
  const t = body.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) {
    if (/ERR_NGROK_3200|endpoint .+ is offline/i.test(t)) {
      return `Backend URL is offline or expired. Start Flask on port ${API_PORT} and keep Expo on LAN, or set EXPO_PUBLIC_SERVER_URL.`;
    }
    return `Server sent HTML instead of JSON (HTTP ${httpStatus ?? "?"}). Check that the backend is running.`;
  }
  try {
    const j = JSON.parse(t);
    if (j.error) return String(j.error);
    if (j.message) return String(j.message);
  } catch (_) {}
  return t.length > 400 ? `${t.slice(0, 400)}…` : t;
}

// ─── Design System ────────────────────────────────────────────────────────────

const COLORS = {
  // Dark theme (Scan + Cook)
  darkBg: "#0D1B12",
  darkSurface: "#162218",
  darkAccent: "#A8C5B0",
  darkText: "#E8F0EB",
  darkTextSub: "rgba(168,197,176,0.7)",

  // Light theme (content screens)
  background: "#F2EDE4",
  card: "#FFFFFF",
  text: "#16120C",
  textSecondary: "#6B6258",
  textLight: "#B8AFA8",
  border: "#E8E2DA",

  // Primary action
  primary: "#1F4A32",
  primaryLight: "#3E7A56",

  // Match indicators
  matchReady: "#3E7A56",
  matchMissing: "#D4C9BE",

  // Semantic
  accent: "#D97A3A",
  accentLight: "#FBE8D4",
  success: "#2E6B44",
  warning: "#C07D1A",
  error: "#C13333",

  glass: "rgba(242,237,228,0.97)",
  darkGlass: "rgba(13,27,18,0.97)",
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatScanDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scanDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const time = `${h}:${m}`;
  if (scanDay.getTime() === today.getTime()) return `Today ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (scanDay.getTime() === yesterday.getTime()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
};

const getIngredientCategory = (name) => {
  const l = name.toLowerCase();
  if (/chicken|beef|pork|fish|egg|salmon|tuna|lamb|duck|turkey|sausage|bacon|ham|prawn|shrimp|seafood|crab|lobster|meat/.test(l))
    return "Proteins";
  if (/milk|cream|cheese|butter|yogurt|cheddar|mozzarella|parmesan|ricotta|brie/.test(l))
    return "Dairy";
  if (/tomato|carrot|onion|garlic|potato|lettuce|spinach|pepper|broccoli|mushroom|cucumber|zucchini|celery|corn|avocado|pea|bean|lentil|kale|cabbage|leek/.test(l))
    return "Vegetables";
  if (/apple|banana|orange|lemon|lime|berry|strawberry|blueberry|raspberry|grape|pineapple|mango|watermelon|melon/.test(l))
    return "Fruits";
  if (/bread|rice|pasta|noodle|spaghetti|flour|oat|cereal|wheat|penne|macaroni|tortilla/.test(l))
    return "Grains";
  if (/sauce|ketchup|mayo|mustard|dressing|oil|vinegar|honey|sugar|salt|spice|seasoning|herb|soy|chili/.test(l))
    return "Condiments";
  return "Other";
};

const getIngredientIcon = (name) => {
  const lowered = name.toLowerCase();
  if (/chicken|poultry|turkey|duck/.test(lowered)) return { icon: "drumstick-bite", type: "mci", color: "#D4A574" };
  if (/beef|steak|meat|pork|lamb|bacon|ham|sausage/.test(lowered)) return { icon: "food-steak", type: "mci", color: "#C0392B" };
  if (/fish|salmon|tuna|cod|shrimp|prawn|seafood|crab|lobster/.test(lowered)) return { icon: "fish", type: "ion", color: "#3498DB" };
  if (/egg/.test(lowered)) return { icon: "egg-outline", type: "ion", color: "#F5D6BA" };
  if (/milk|cream/.test(lowered)) return { icon: "cup", type: "mci", color: "#ECF0F1" };
  if (/cheese|cheddar|mozzarella|parmesan/.test(lowered)) return { icon: "cheese", type: "mci", color: "#F4D03F" };
  if (/butter/.test(lowered)) return { icon: "cube-outline", type: "ion", color: "#F9E79F" };
  if (/tomato/.test(lowered)) return { icon: "food-apple", type: "mci", color: "#E74C3C" };
  if (/carrot/.test(lowered)) return { icon: "carrot", type: "mci", color: "#E67E22" };
  if (/onion|garlic|shallot/.test(lowered)) return { icon: "food-variant", type: "mci", color: "#D5DBDB" };
  if (/potato/.test(lowered)) return { icon: "food-variant", type: "mci", color: "#D4A574" };
  if (/lettuce|salad|spinach|kale|greens/.test(lowered)) return { icon: "leaf", type: "ion", color: "#27AE60" };
  if (/pepper|capsicum|chili/.test(lowered)) return { icon: "chili-mild", type: "mci", color: "#E74C3C" };
  if (/mushroom/.test(lowered)) return { icon: "mushroom-outline", type: "mci", color: "#8D6E63" };
  if (/bread|toast/.test(lowered)) return { icon: "bread-slice-outline", type: "mci", color: "#D4A574" };
  if (/rice/.test(lowered)) return { icon: "grain", type: "mci", color: "#FDEBD0" };
  if (/pasta|noodle|spaghetti|penne/.test(lowered)) return { icon: "noodles", type: "mci", color: "#F5CBA7" };
  if (/sauce|ketchup|mustard/.test(lowered)) return { icon: "bottle-soda-classic-outline", type: "mci", color: "#E74C3C" };
  if (/oil|olive/.test(lowered)) return { icon: "water-outline", type: "ion", color: "#F4D03F" };
  if (/honey/.test(lowered)) return { icon: "beehive-outline", type: "mci", color: "#F5B041" };
  if (/chocolate|cocoa/.test(lowered)) return { icon: "candycane", type: "mci", color: "#6B4226" };
  return { icon: "food-variant", type: "mci", color: COLORS.primary };
};

// ─── Small Components ─────────────────────────────────────────────────────────

const MatchDots = ({ matchPercent }) => {
  const filled = Math.min(5, Math.max(0, Math.round((matchPercent || 0) / 20)));
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: i < filled ? COLORS.matchReady : COLORS.matchMissing,
          }}
        />
      ))}
    </View>
  );
};

const EmptyState = ({ icon, title, subtitle, actionText, onAction, dark }) => {
  const textColor = dark ? COLORS.darkText : COLORS.text;
  const subColor = dark ? COLORS.darkTextSub : COLORS.textSecondary;
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyStateIcon, dark && { backgroundColor: "rgba(168,197,176,0.15)" }]}>
        <Ionicons name={icon} size={36} color={dark ? COLORS.darkAccent : COLORS.accent} />
      </View>
      <Text style={[styles.emptyStateTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.emptyStateSubtitle, { color: subColor }]}>{subtitle}</Text>
      {actionText && onAction && (
        <TouchableOpacity
          style={[styles.emptyStateButton, dark && { backgroundColor: COLORS.darkAccent }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={[styles.emptyStateButtonText, dark && { color: COLORS.darkBg }]}>
            {actionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Full-width recipe card for vertical feed
const FullRecipeCard = ({ recipe, onPress, onFavorite, isFavorited }) => {
  const isReady = recipe.missing_count === 0;
  const totalCount = (recipe.matched_count || 0) + (recipe.missing_count || 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.fullRecipeCard, isReady && styles.fullRecipeCardReady]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={styles.fullRecipeImageWrap}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={styles.fullRecipeImage} />
          ) : (
            <View style={[styles.fullRecipeImagePlaceholder]}>
              <Text style={{ fontSize: 64 }}>{recipe.emoji || "🍽️"}</Text>
            </View>
          )}
          {isReady && (
            <View style={styles.readyBadgeOverlay}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.readyBadgeText}>All ingredients</Text>
            </View>
          )}
        </View>

        <View style={styles.fullRecipeContent}>
          <Text style={styles.fullRecipeTitle} numberOfLines={2}>
            {recipe.name}
          </Text>

          <View style={styles.fullRecipeMetaRow}>
            <MatchDots matchPercent={recipe.match_percent} />
            {totalCount > 0 && (
              <Text style={styles.fullRecipeMetaText}>
                {recipe.matched_count}/{totalCount}
              </Text>
            )}
            {recipe.area ? (
              <View style={styles.fullRecipeTag}>
                <Text style={styles.fullRecipeTagText}>{recipe.area}</Text>
              </View>
            ) : recipe.category ? (
              <View style={styles.fullRecipeTag}>
                <Text style={styles.fullRecipeTagText}>{recipe.category}</Text>
              </View>
            ) : null}
          </View>

          {recipe.missing_count > 0 && (
            <Text style={styles.fullRecipeMissing}>
              Need {recipe.missing_count} more ingredient{recipe.missing_count !== 1 ? "s" : ""}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.fullRecipeHeart}
          onPress={(e) => { e.stopPropagation(); onFavorite(recipe); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorited ? "heart" : "heart-outline"}
            size={22}
            color={isFavorited ? COLORS.error : COLORS.textLight}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Small grid card for Saved tab
const GridRecipeCard = ({ recipe, onPress }) => (
  <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
    {recipe.image ? (
      <Image source={{ uri: recipe.image }} style={styles.gridCardImage} />
    ) : (
      <View style={[styles.gridCardImagePlaceholder]}>
        <Text style={{ fontSize: 32 }}>{recipe.emoji || "🍽️"}</Text>
      </View>
    )}
    <Text style={styles.gridCardName} numberOfLines={2}>{recipe.name}</Text>
  </TouchableOpacity>
);

// ─── ScanTab ──────────────────────────────────────────────────────────────────

function ScanTab({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [lastScanDate, setLastScanDate] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [searchingRecipes, setSearchingRecipes] = useState(false);
  const [scanPhase, setScanPhase] = useState("idle"); // idle | analyzing | found | searching
  const [apiKey, setApiKey] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener("focus", loadData);
    return unsub;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [savedKey, savedIngredients, savedRecipes, savedHistory] = await Promise.all([
        AsyncStorage.getItem(API_KEY_STORAGE),
        AsyncStorage.getItem(INGREDIENTS_STORAGE),
        AsyncStorage.getItem(RECIPES_STORAGE),
        AsyncStorage.getItem(HISTORY_STORAGE),
      ]);
      if (savedKey) setApiKey(savedKey.trim());
      if (savedIngredients) setIngredients(JSON.parse(savedIngredients));
      if (savedRecipes) {
        const parsed = JSON.parse(savedRecipes);
        setRecipes(parsed.recipes || []);
      }
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        if (history.length > 0) setLastScanDate(history[0].date);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    }
  };

  const saveApiKey = async () => {
    const key = tempApiKey.trim();
    if (!key) { Alert.alert("Error", "Enter a valid API key."); return; }
    await AsyncStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key);
    setShowApiModal(false);
  };

  const startScan = async (useCamera) => {
    if (!apiKey) { setShowApiModal(true); return; }

    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to continue.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });

    if (!result.canceled && result.assets[0].base64) {
      analyzeImage(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const animateProgress = (toValue, duration) => {
    return new Promise((resolve) => {
      Animated.timing(progressAnim, { toValue, duration, useNativeDriver: false }).start(resolve);
    });
  };

  const analyzeImage = async (base64, imageUri) => {
    setScanning(true);
    setScanPhase("analyzing");
    progressAnim.setValue(0);
    animateProgress(0.55, 12000);

    try {
      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ image_base64: base64, api_key: apiKey.trim() }),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(humanizeApiError(responseText, response.status));

      let data;
      try { data = JSON.parse(responseText); } catch { throw new Error(humanizeApiError(responseText, response.status)); }

      const newIngredients = data.ingredients || [];
      setIngredients(newIngredients);
      await AsyncStorage.setItem(INGREDIENTS_STORAGE, JSON.stringify(newIngredients));

      const historyEntry = { id: Date.now().toString(), date: new Date().toISOString(), imageUri, ingredients: newIngredients };
      const savedHistory = await AsyncStorage.getItem(HISTORY_STORAGE);
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      await AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify([historyEntry, ...history].slice(0, 30)));
      setLastScanDate(historyEntry.date);

      setScanPhase("found");
      await animateProgress(0.65, 300);

      if (newIngredients.length > 0) {
        await searchRecipes(newIngredients);
      } else {
        setScanning(false);
        setScanPhase("idle");
      }
    } catch (e) {
      console.error("Analysis error:", e);
      Alert.alert("Analysis Failed", e.message || "Could not analyze image.");
      setScanning(false);
      setScanPhase("idle");
      progressAnim.setValue(0);
    }
  };

  const searchRecipes = async (ingredientsList) => {
    setSearchingRecipes(true);
    setScanPhase("searching");
    animateProgress(0.92, 15000);

    try {
      const response = await fetch(`${SERVER_URL}/search-recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ ingredients: ingredientsList }),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(humanizeApiError(responseText, response.status));

      let data;
      try { data = JSON.parse(responseText); } catch { throw new Error(humanizeApiError(responseText, response.status)); }

      const newRecipes = data.recipes || [];
      setRecipes(newRecipes);
      await AsyncStorage.setItem(RECIPES_STORAGE, JSON.stringify({
        recipes: newRecipes,
        categorized: data.categorized || {},
      }));

      await animateProgress(1, 400);
      setScanning(false);
      setSearchingRecipes(false);
      setScanPhase("idle");
      progressAnim.setValue(0);

      if (newRecipes.length > 0) {
        navigation.navigate("Results", { recipes: newRecipes, ingredients: ingredientsList });
      }
    } catch (e) {
      console.error("Recipe search error:", e);
      Alert.alert("Search Failed", e.message || "Could not find recipes.");
      setScanning(false);
      setSearchingRecipes(false);
      setScanPhase("idle");
      progressAnim.setValue(0);
    }
  };

  const clearResults = async () => {
    setRecipes([]);
    setIngredients([]);
    setLastScanDate(null);
    await AsyncStorage.multiRemove([INGREDIENTS_STORAGE, RECIPES_STORAGE]);
  };

  const isLoading = scanning || searchingRecipes;
  const hasResults = recipes.length > 0 && !isLoading;

  const getLoadingText = () => {
    if (scanPhase === "analyzing") return "Scanning your fridge...";
    if (scanPhase === "found") return `Found ${ingredients.length} ingredient${ingredients.length !== 1 ? "s" : ""}!`;
    if (scanPhase === "searching") return "Finding best matches...";
    return "Working...";
  };

  const getLoadingSubtext = () => {
    if (scanPhase === "analyzing") return "AI is detecting ingredients";
    if (scanPhase === "found") return "Searching for recipes now";
    if (scanPhase === "searching") return "Matching to your pantry";
    return "";
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  if (isLoading) {
    return (
      <View style={styles.scanLoadingScreen}>
        <StatusBar style="light" />

        <View style={styles.scanLoadingTop}>
          <View style={styles.scanLoadingIconRing}>
            <ActivityIndicator color={COLORS.darkAccent} size="large" />
          </View>
          <Text style={styles.scanLoadingTitle}>{getLoadingText()}</Text>
          <Text style={styles.scanLoadingSubtitle}>{getLoadingSubtext()}</Text>
        </View>

        {scanPhase !== "analyzing" && ingredients.length > 0 && (
          <View style={styles.scanFoundChips}>
            {ingredients.slice(0, 8).map((ing, i) => (
              <View key={i} style={styles.scanFoundChip}>
                <Text style={styles.scanFoundChipText}>{ing.name}</Text>
              </View>
            ))}
            {ingredients.length > 8 && (
              <View style={styles.scanFoundChip}>
                <Text style={styles.scanFoundChipText}>+{ingredients.length - 8}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.scanProgressWrap}>
          <View style={styles.scanProgressTrack}>
            <Animated.View style={[styles.scanProgressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.scanProgressLabel}>
            {scanPhase === "found"
              ? `${ingredients.length} ingredients detected`
              : "This may take a moment"}
          </Text>
        </View>
      </View>
    );
  }

  if (hasResults) {
    const topRecipes = recipes.slice(0, 3);
    return (
      <SafeAreaView style={styles.scanScreenDark}>
        <StatusBar style="light" />

        <View style={styles.scanHasResultsHeader}>
          <Text style={styles.scanHasResultsTitle}>Scan Again</Text>
          <TouchableOpacity onPress={() => setShowApiModal(true)} style={styles.scanSettingsBtn}>
            <Ionicons name="settings-outline" size={22} color={COLORS.darkAccent} />
          </TouchableOpacity>
        </View>

        <View style={styles.scanLastScanCard}>
          <View style={styles.scanLastScanMeta}>
            <Text style={styles.scanLastScanLabel}>Last scan: {formatScanDate(lastScanDate)}</Text>
            <TouchableOpacity onPress={clearResults} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={COLORS.darkAccent} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scanMiniCards}>
            {topRecipes.map((recipe, i) => (
              <TouchableOpacity
                key={i}
                style={styles.scanMiniCard}
                onPress={() => navigation.navigate("RecipeDetail", { recipe, userIngredients: ingredients })}
              >
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={styles.scanMiniCardImage} />
                ) : (
                  <View style={styles.scanMiniCardPlaceholder}>
                    <Text style={{ fontSize: 28 }}>{recipe.emoji || "🍽️"}</Text>
                  </View>
                )}
                <Text style={styles.scanMiniCardName} numberOfLines={2}>{recipe.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.scanLastScanStats}>
            {ingredients.length} ingredients · {recipes.length} recipes
          </Text>
        </View>

        <TouchableOpacity
          style={styles.scanPrimaryBtn}
          onPress={() => startScan(true)}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[COLORS.primary, "#2D6644"]}
            style={styles.scanPrimaryBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={styles.scanPrimaryBtnText}>Scan Again</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanSeeAllBtn}
          onPress={() => navigation.navigate("Results", { recipes, ingredients })}
        >
          <Text style={styles.scanSeeAllText}>See all results</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.darkAccent} />
        </TouchableOpacity>

        <View style={styles.scanSecondaryRow}>
          <TouchableOpacity style={styles.scanSecondaryBtn} onPress={() => startScan(false)}>
            <Text style={styles.scanSecondaryBtnText}>Upload photo</Text>
          </TouchableOpacity>
        </View>

        <ApiKeyModal
          visible={showApiModal}
          onClose={() => setShowApiModal(false)}
          tempKey={tempApiKey}
          setTempKey={setTempApiKey}
          onSave={saveApiKey}
        />
      </SafeAreaView>
    );
  }

  // Empty state
  return (
    <SafeAreaView style={styles.scanScreenDark}>
      <StatusBar style="light" />

      <View style={styles.scanHeader}>
        <TouchableOpacity onPress={() => setShowApiModal(true)} style={styles.scanSettingsBtn}>
          <Ionicons name="settings-outline" size={22} color={COLORS.darkAccent} />
        </TouchableOpacity>
      </View>

      <View style={styles.scanEmptyContent}>
        <View style={styles.scanIllustration}>
          <LinearGradient
            colors={[COLORS.darkSurface, "#1E3328"]}
            style={styles.scanIllustrationGradient}
          >
            <Text style={styles.scanIllustrationEmoji}>🥦</Text>
            <Text style={[styles.scanIllustrationEmoji, { top: 20, left: -30, fontSize: 36 }]}>🥚</Text>
            <Text style={[styles.scanIllustrationEmoji, { top: -10, right: -20, fontSize: 32 }]}>🧅</Text>
            <Text style={[styles.scanIllustrationEmoji, { bottom: 20, left: -10, fontSize: 28 }]}>🥕</Text>
            <Text style={[styles.scanIllustrationEmoji, { bottom: 10, right: -30, fontSize: 34 }]}>🧀</Text>
          </LinearGradient>
        </View>

        <Text style={styles.scanEmptyClaim}>What's in your fridge today?</Text>

        <TouchableOpacity
          style={styles.scanPrimaryBtn}
          onPress={() => startScan(true)}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[COLORS.primary, "#2D6644"]}
            style={styles.scanPrimaryBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={styles.scanPrimaryBtnText}>Scan Your Fridge</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.scanSecondaryRow}>
          <TouchableOpacity style={styles.scanSecondaryBtn} onPress={() => startScan(false)}>
            <Text style={styles.scanSecondaryBtnText}>Upload photo</Text>
          </TouchableOpacity>
          <Text style={styles.scanSecondaryDot}>·</Text>
          <TouchableOpacity
            style={styles.scanSecondaryBtn}
            onPress={() => navigation.navigate("KitchenTab")}
          >
            <Text style={styles.scanSecondaryBtnText}>Add manually</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ApiKeyModal
        visible={showApiModal}
        onClose={() => setShowApiModal(false)}
        tempKey={tempApiKey}
        setTempKey={setTempApiKey}
        onSave={saveApiKey}
      />
    </SafeAreaView>
  );
}

// ─── ResultsScreen ────────────────────────────────────────────────────────────

function ResultsScreen({ route, navigation }) {
  const { recipes = [], ingredients = [] } = route.params || {};
  const [filter, setFilter] = useState("all");
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
    if (saved) setFavorites(JSON.parse(saved));
  };

  const toggleFavorite = async (recipe) => {
    const isFav = favorites.some((f) => f.id === recipe.id);
    const updated = isFav
      ? favorites.filter((f) => f.id !== recipe.id)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...favorites];
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(updated));
  };

  const isFavorited = (recipe) => favorites.some((f) => f.id === recipe.id);

  const FILTERS = [
    { id: "all", label: "All", count: recipes.length },
    { id: "ready", label: "Ready", icon: "checkmark-circle" },
    { id: "almost", label: "Almost" },
    { id: "shop", label: "Shopping" },
  ];

  const filteredRecipes = recipes.filter((r) => {
    if (filter === "all") return true;
    if (filter === "ready") return r.missing_count === 0;
    if (filter === "almost") return r.missing_count > 0 && r.missing_count <= 2;
    if (filter === "shop") return r.missing_count > 2;
    return true;
  });

  return (
    <SafeAreaViewEdges style={styles.resultsScreen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.resultsBackBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.resultsHeaderTitle}>Recipes for you</Text>
          <Text style={styles.resultsHeaderSub}>{ingredients.length} ingredients scanned</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
          {FILTERS.map((f) => {
            const count = f.id === "all"
              ? recipes.length
              : recipes.filter((r) => {
                  if (f.id === "ready") return r.missing_count === 0;
                  if (f.id === "almost") return r.missing_count > 0 && r.missing_count <= 2;
                  if (f.id === "shop") return r.missing_count > 2;
                  return true;
                }).length;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterTab, filter === f.id && styles.filterTabActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, filter === f.id && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterTabBadge, filter === f.id && styles.filterTabBadgeActive]}>
                    <Text style={[styles.filterTabBadgeText, filter === f.id && { color: COLORS.primary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Recipe List */}
      <FlatList
        data={filteredRecipes}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        contentContainerStyle={styles.recipeListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No recipes found"
            subtitle="Try a different filter"
            actionText="Show All"
            onAction={() => setFilter("all")}
          />
        }
        renderItem={({ item }) => (
          <FullRecipeCard
            recipe={item}
            onPress={() => navigation.navigate("RecipeDetail", { recipe: item, userIngredients: ingredients })}
            onFavorite={toggleFavorite}
            isFavorited={isFavorited(item)}
          />
        )}
      />
    </SafeAreaViewEdges>
  );
}

// ─── KitchenTab ───────────────────────────────────────────────────────────────

function KitchenTab({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipesCount, setRecipesCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener("focus", loadData);
    return unsub;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [savedIngredients, savedRecipes] = await Promise.all([
        AsyncStorage.getItem(INGREDIENTS_STORAGE),
        AsyncStorage.getItem(RECIPES_STORAGE),
      ]);
      if (savedIngredients) setIngredients(JSON.parse(savedIngredients));
      if (savedRecipes) {
        const parsed = JSON.parse(savedRecipes);
        const recs = parsed.recipes || [];
        setRecipesCount(recs.length);
        setReadyCount(recs.filter((r) => r.missing_count === 0).length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveIngredients = async (updated) => {
    setIngredients(updated);
    await AsyncStorage.setItem(INGREDIENTS_STORAGE, JSON.stringify(updated));
  };

  const deleteIngredient = (index) => {
    Alert.alert("Remove", "Remove this ingredient?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => saveIngredients(ingredients.filter((_, i) => i !== index)) },
    ]);
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditName(ingredients[index].name);
    setEditQuantity(ingredients[index].quantity || "");
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    const updated = [...ingredients];
    updated[editingIndex] = { name: editName.trim(), quantity: editQuantity.trim() };
    saveIngredients(updated);
    setEditingIndex(null);
  };

  const addIngredient = () => {
    if (!newName.trim()) return;
    saveIngredients([...ingredients, { name: newName.trim(), quantity: newQuantity.trim() }]);
    setNewName("");
    setNewQuantity("");
    setShowAddModal(false);
  };

  // Group ingredients by category
  const grouped = {};
  ingredients.forEach((ing, idx) => {
    const cat = getIngredientCategory(ing.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...ing, idx });
  });

  const categoryOrder = ["Proteins", "Dairy", "Vegetables", "Fruits", "Grains", "Condiments", "Other"];
  const sortedCategories = categoryOrder.filter((c) => grouped[c]);

  if (loading) {
    return (
      <SafeAreaView style={styles.lightContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.lightContainer}>
      <StatusBar style="dark" />

      <View style={styles.kitchenHeader}>
        <Text style={styles.kitchenHeaderTitle}>My Kitchen</Text>
        <TouchableOpacity style={styles.kitchenEditBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.kitchenEditBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Smart Summary */}
        {recipesCount > 0 && (
          <TouchableOpacity
            style={styles.kitchenSummaryCard}
            onPress={async () => {
              const saved = await AsyncStorage.getItem(RECIPES_STORAGE);
              const savedIng = await AsyncStorage.getItem(INGREDIENTS_STORAGE);
              if (saved) {
                const parsed = JSON.parse(saved);
                const ing = savedIng ? JSON.parse(savedIng) : [];
                navigation.navigate("Results", { recipes: parsed.recipes || [], ingredients: ing });
              }
            }}
            activeOpacity={0.88}
          >
            <View style={styles.kitchenSummaryLeft}>
              <Text style={styles.kitchenSummaryNumber}>{recipesCount}</Text>
              <View>
                <Text style={styles.kitchenSummaryTitle}>recipes available</Text>
                {readyCount > 0 && (
                  <Text style={styles.kitchenSummarySubtitle}>
                    {readyCount} with all ingredients
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Ingredients by Category */}
        {ingredients.length === 0 ? (
          <EmptyState
            icon="nutrition-outline"
            title="Your pantry is empty"
            subtitle="Scan your fridge or add items manually"
            actionText="Scan Fridge"
            onAction={() => navigation.navigate("ScanTab")}
          />
        ) : (
          <View style={styles.kitchenCategories}>
            {sortedCategories.map((cat) => (
              <View key={cat} style={styles.kitchenCategorySection}>
                <Text style={styles.kitchenCategoryLabel}>{cat}</Text>
                <View style={styles.kitchenChipRow}>
                  {grouped[cat].map(({ name, quantity, idx }) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.kitchenChip}
                      onPress={() => startEdit(idx)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.kitchenChipText}>{name}</Text>
                      {quantity ? (
                        <Text style={styles.kitchenChipQty}> · {quantity}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.kitchenAddBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.kitchenAddBtnText}>Add ingredient</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editingIndex !== null} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Ingredient</Text>
            <TextInput style={styles.modalInput} placeholder="Name" value={editName} onChangeText={setEditName} />
            <TextInput style={styles.modalInput} placeholder="Quantity (optional)" value={editQuantity} onChangeText={setEditQuantity} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalDestructiveBtn} onPress={() => { deleteIngredient(editingIndex); setEditingIndex(null); }}>
                <Text style={styles.modalDestructiveBtnText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingIndex(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEdit}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Ingredient</Text>
            <TextInput style={styles.modalInput} placeholder="Name" value={newName} onChangeText={setNewName} autoFocus />
            <TextInput style={styles.modalInput} placeholder="Quantity (optional)" value={newQuantity} onChangeText={setNewQuantity} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={addIngredient}>
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── SavedTab ─────────────────────────────────────────────────────────────────

function SavedTab({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showShoppingInput, setShowShoppingInput] = useState(false);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener("focus", loadData);
    return unsub;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [savedFav, savedList, savedHistory] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_STORAGE),
        AsyncStorage.getItem(SHOPPING_LIST_STORAGE),
        AsyncStorage.getItem(HISTORY_STORAGE),
      ]);
      if (savedFav) setFavorites(JSON.parse(savedFav));
      if (savedList) setShoppingList(JSON.parse(savedList));
      if (savedHistory) setHistory(JSON.parse(savedHistory).slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveList = async (list) => {
    setShoppingList(list);
    await AsyncStorage.setItem(SHOPPING_LIST_STORAGE, JSON.stringify(list));
  };

  const toggleItem = (index) => {
    const updated = [...shoppingList];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    saveList(updated);
  };

  const removeItem = (index) => saveList(shoppingList.filter((_, i) => i !== index));

  const clearChecked = () => saveList(shoppingList.filter((item) => !item.checked));

  const addItem = () => {
    if (!newItem.trim()) return;
    saveList([...shoppingList, { name: newItem.trim(), checked: false }]);
    setNewItem("");
    setShowShoppingInput(false);
  };

  const shareList = async () => {
    const unchecked = shoppingList.filter((i) => !i.checked);
    if (unchecked.length === 0) { Alert.alert("Empty", "No items to share."); return; }
    await Share.share({ message: `Shopping List\n\n${unchecked.map((i) => `☐ ${i.name}${i.recipeName ? ` (${i.recipeName})` : ""}`).join("\n")}` });
  };

  const removeFavorite = async (recipe) => {
    const updated = favorites.filter((f) => f.id !== recipe.id);
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(updated));
  };

  const checkedCount = shoppingList.filter((i) => i.checked).length;
  const uncheckedCount = shoppingList.length - checkedCount;

  if (loading) {
    return (
      <SafeAreaView style={styles.lightContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.lightContainer}>
      <StatusBar style="dark" />

      <View style={styles.savedHeader}>
        <Text style={styles.savedHeaderTitle}>Saved</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Shopping List Section */}
        <View style={styles.savedSection}>
          <View style={styles.savedSectionHeader}>
            <View style={styles.savedSectionTitleRow}>
              <Ionicons name="cart-outline" size={18} color={COLORS.primary} />
              <Text style={styles.savedSectionTitle}>Shopping List</Text>
              {uncheckedCount > 0 && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>{uncheckedCount}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {shoppingList.length > 0 && (
                <TouchableOpacity onPress={shareList}>
                  <Ionicons name="share-outline" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowShoppingInput(!showShoppingInput)}>
                <Ionicons name="add" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {showShoppingInput && (
            <View style={styles.shoppingAddRow}>
              <TextInput
                style={styles.shoppingAddInput}
                placeholder="Add item..."
                placeholderTextColor={COLORS.textLight}
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={addItem}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity style={styles.shoppingAddBtn} onPress={addItem}>
                <Text style={styles.shoppingAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {shoppingList.length === 0 ? (
            <Text style={styles.savedEmptyNote}>
              Add items here or save missing ingredients from a recipe.
            </Text>
          ) : (
            <View style={styles.shoppingListWrap}>
              {shoppingList.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.shoppingItem, item.checked && styles.shoppingItemChecked]}
                  onPress={() => toggleItem(index)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.shoppingCheckbox, item.checked && styles.shoppingCheckboxChecked]}>
                    {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shoppingItemName, item.checked && styles.shoppingItemNameChecked]}>
                      {item.name}
                    </Text>
                    {item.recipeName && (
                      <Text style={styles.shoppingItemRecipe}>{item.recipeName}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {checkedCount > 0 && (
                <TouchableOpacity style={styles.clearCheckedBtn} onPress={clearChecked}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  <Text style={styles.clearCheckedText}>Clear {checkedCount} checked</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Saved Recipes Section */}
        <View style={styles.savedSection}>
          <View style={styles.savedSectionHeader}>
            <View style={styles.savedSectionTitleRow}>
              <Ionicons name="heart-outline" size={18} color={COLORS.error} />
              <Text style={styles.savedSectionTitle}>Saved Recipes</Text>
              {favorites.length > 0 && (
                <View style={[styles.savedBadge, { backgroundColor: COLORS.error + "15" }]}>
                  <Text style={[styles.savedBadgeText, { color: COLORS.error }]}>{favorites.length}</Text>
                </View>
              )}
            </View>
          </View>

          {favorites.length === 0 ? (
            <Text style={styles.savedEmptyNote}>
              Tap the heart on any recipe to save it here.
            </Text>
          ) : (
            <View style={styles.favoritesGrid}>
              {favorites.map((recipe, index) => (
                <GridRecipeCard
                  key={`${recipe.id}-${index}`}
                  recipe={recipe}
                  onPress={() => navigation.navigate("RecipeDetail", { recipe })}
                />
              ))}
            </View>
          )}
        </View>

        {/* Scan History Section */}
        {history.length > 0 && (
          <View style={styles.savedSection}>
            <View style={styles.savedSectionHeader}>
              <View style={styles.savedSectionTitleRow}>
                <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.savedSectionTitle}>Scan History</Text>
              </View>
            </View>
            {history.map((entry) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyItemLeft}>
                  <Text style={styles.historyItemDate}>{formatScanDate(entry.date)}</Text>
                  <Text style={styles.historyItemCount}>
                    {entry.ingredients?.length || 0} ingredients
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── RecipeDetailScreen ───────────────────────────────────────────────────────

function RecipeDetailScreen({ route, navigation }) {
  const { recipe, userIngredients = [] } = route.params;
  const [isFavorited, setIsFavorited] = useState(false);
  const insets = useSafeAreaInsets();
  const HERO_HEIGHT = SCREEN_HEIGHT * 0.46;

  useEffect(() => { checkFavorite(); }, []);

  const checkFavorite = async () => {
    const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
    if (saved) setIsFavorited(JSON.parse(saved).some((f) => f.id === recipe.id));
  };

  const toggleFavorite = async () => {
    const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
    let favs = saved ? JSON.parse(saved) : [];
    favs = isFavorited
      ? favs.filter((f) => f.id !== recipe.id)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...favs];
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(favs));
    setIsFavorited(!isFavorited);
  };

  const addMissingToShoppingList = async () => {
    const missing = recipe.missing_ingredients || [];
    if (missing.length === 0) { Alert.alert("All Set!", "You have all the ingredients needed."); return; }
    const saved = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE);
    let list = saved ? JSON.parse(saved) : [];
    const existingNames = list.map((item) => item.name.toLowerCase());
    const newItems = missing
      .filter((item) => !existingNames.includes(item.toLowerCase()))
      .map((name) => ({ name, checked: false, recipeName: recipe.name }));
    if (newItems.length === 0) { Alert.alert("Already Added", "All missing ingredients are in your shopping list."); return; }
    await AsyncStorage.setItem(SHOPPING_LIST_STORAGE, JSON.stringify([...list, ...newItems]));
    Alert.alert("Added!", `${newItems.length} item${newItems.length !== 1 ? "s" : ""} added to shopping list.`);
  };

  const openSource = () => {
    const url = recipe.source || recipe.youtube;
    if (url) Linking.openURL(url);
    else Alert.alert("No Source", "No external source available.");
  };

  const totalCount = (recipe.matched_count || 0) + (recipe.missing_count || 0);
  const isReady = recipe.missing_count === 0;

  return (
    <SafeAreaViewEdges style={{ flex: 1, backgroundColor: COLORS.background }} edges={["left", "right", "bottom"]}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={{ height: HERO_HEIGHT, position: "relative" }}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          ) : (
            <View style={[{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.border }]}>
              <Text style={{ fontSize: 100 }}>{recipe.emoji || "🍽️"}</Text>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.35)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Nav Buttons */}
          <View style={[styles.detailNav, { paddingTop: insets.top + SPACING.sm }]}>
            <TouchableOpacity style={styles.detailNavBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {recipe.youtube && (
                <TouchableOpacity style={styles.detailNavBtn} onPress={() => Linking.openURL(recipe.youtube)}>
                  <Ionicons name="logo-youtube" size={22} color="#FF0000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.detailNavBtn} onPress={toggleFavorite}>
                <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={22} color={isFavorited ? COLORS.error : "#fff"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{recipe.name}</Text>

          {/* Meta row */}
          <View style={styles.detailMetaRow}>
            {recipe.area && <View style={styles.detailTag}><Text style={styles.detailTagText}>{recipe.area}</Text></View>}
            {recipe.category && <View style={styles.detailTag}><Text style={styles.detailTagText}>{recipe.category}</Text></View>}
          </View>

          {/* Match info */}
          {recipe.match_percent !== undefined && (
            <View style={styles.detailMatchRow}>
              <MatchDots matchPercent={recipe.match_percent} />
              <Text style={styles.detailMatchText}>
                {isReady
                  ? "You have all ingredients"
                  : `${recipe.matched_count || 0} of ${totalCount} ingredients`}
              </Text>
            </View>
          )}

          {/* Missing ingredients */}
          {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
            <View style={styles.detailMissingCard}>
              <View style={styles.detailMissingHeader}>
                <Ionicons name="cart-outline" size={16} color={COLORS.warning} />
                <Text style={styles.detailMissingTitle}>Missing ingredients</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {recipe.missing_ingredients.map((ing, i) => (
                  <View key={i} style={styles.missingChip}>
                    <Text style={styles.missingChipText}>{ing}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.addToListInlineBtn} onPress={addMissingToShoppingList}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.addToListInlineText}>Add to shopping list</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* All Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ing, i) => {
                const have = recipe.matched_ingredients?.some(
                  (m) => m.toLowerCase().includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(m.toLowerCase())
                );
                return (
                  <View key={i} style={styles.detailIngredientRow}>
                    <Ionicons
                      name={have ? "checkmark-circle" : "close-circle-outline"}
                      size={16}
                      color={have ? COLORS.matchReady : COLORS.matchMissing}
                    />
                    <Text style={styles.detailIngredientMeasure}>{ing.measure}</Text>
                    <Text style={[styles.detailIngredientName, !have && { color: COLORS.textSecondary }]}>
                      {ing.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Instructions */}
          {recipe.steps && recipe.steps.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Instructions</Text>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.detailStepRow}>
                  <View style={styles.detailStepNum}>
                    <Text style={styles.detailStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.detailStepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.detailActions}>
            {recipe.steps && recipe.steps.length > 0 && (
              <TouchableOpacity
                style={styles.startCookingBtn}
                onPress={() => navigation.navigate("CookMode", { recipe })}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[COLORS.primary, "#2D6644"]}
                  style={styles.startCookingBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="flame-outline" size={20} color="#fff" />
                  <Text style={styles.startCookingBtnText}>Start Cooking</Text>
                  <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={styles.detailSecondaryActions}>
              <TouchableOpacity
                style={[styles.detailSecondaryBtn, { flex: 1 }]}
                onPress={toggleFavorite}
              >
                <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={18} color={isFavorited ? COLORS.error : COLORS.primary} />
                <Text style={styles.detailSecondaryBtnText}>
                  {isFavorited ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>

              {(recipe.source || recipe.youtube) && (
                <TouchableOpacity
                  style={[styles.detailSecondaryBtn, { flex: 1 }]}
                  onPress={openSource}
                >
                  <Ionicons name="open-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.detailSecondaryBtnText}>Source</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaViewEdges>
  );
}

// ─── CookModeScreen ───────────────────────────────────────────────────────────

function CookModeScreen({ route, navigation }) {
  const { recipe } = route.params;
  const steps = recipe.steps || [];
  const [currentStep, setCurrentStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: steps.length > 1 ? currentStep / (steps.length - 1) : 1,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setCurrentStep(currentStep - 1);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  if (steps.length === 0) {
    return (
      <SafeAreaViewEdges style={styles.cookScreen} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="light" />
        <EmptyState icon="reader-outline" title="No instructions" subtitle="This recipe has no step-by-step instructions." dark />
        <TouchableOpacity style={styles.cookExitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cookExitBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaViewEdges>
    );
  }

  const isLast = currentStep === steps.length - 1;

  return (
    <View style={[styles.cookScreen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={styles.cookTopBar}>
        <Text style={styles.cookStepCounter}>
          Step {currentStep + 1} of {steps.length}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cookExitIconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={COLORS.darkText} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.cookProgressTrack}>
        <Animated.View style={[styles.cookProgressBar, { width: progressWidth }]} />
      </View>

      {/* Recipe name */}
      <Text style={styles.cookRecipeName} numberOfLines={1}>{recipe.name}</Text>

      {/* Step content */}
      <Animated.View style={[styles.cookStepContent, { opacity: fadeAnim }]}>
        <Text style={styles.cookStepText}>{steps[currentStep]}</Text>
      </Animated.View>

      {/* Navigation */}
      <View style={[styles.cookNavRow, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <TouchableOpacity
          style={[styles.cookNavBtn, styles.cookNavBtnSecondary, currentStep === 0 && { opacity: 0.3 }]}
          onPress={goPrev}
          disabled={currentStep === 0}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.darkAccent} />
          <Text style={styles.cookNavBtnSecondaryText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cookNavBtn, styles.cookNavBtnPrimary]}
          onPress={isLast ? () => navigation.goBack() : goNext}
        >
          <Text style={styles.cookNavBtnPrimaryText}>{isLast ? "Done!" : "Next Step"}</Text>
          {!isLast && <Ionicons name="arrow-forward" size={20} color="#fff" />}
          {isLast && <Ionicons name="checkmark" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────

function ApiKeyModal({ visible, onClose, tempKey, setTempKey, onSave }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="key-outline" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>OpenAI API Key</Text>
            <Text style={styles.modalSubtitle}>Required for AI ingredient detection</Text>
          </View>
          <TextInput
            style={styles.modalInput}
            placeholder="sk-..."
            placeholderTextColor={COLORS.textLight}
            value={tempKey}
            onChangeText={setTempKey}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, !tempKey && { opacity: 0.5 }]}
              onPress={onSave}
              disabled={!tempKey}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: route.name === "ScanTab"
          ? styles.tabBarDark
          : styles.tabBarLight,
        tabBarActiveTintColor: route.name === "ScanTab" ? COLORS.darkAccent : COLORS.primary,
        tabBarInactiveTintColor: route.name === "ScanTab" ? "rgba(168,197,176,0.45)" : COLORS.textLight,
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen
        name="ScanTab"
        component={ScanTab}
        options={{
          tabBarLabel: "Scan",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "scan-circle" : "scan-circle-outline"} size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="KitchenTab"
        component={KitchenTab}
        options={{
          tabBarLabel: "Kitchen",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "nutrition" : "nutrition-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SavedTab"
        component={SavedTab}
        options={{
          tabBarLabel: "Saved",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "bookmark" : "bookmark-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen
            name="CookMode"
            component={CookModeScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Containers ──
  lightContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.accentLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyStateButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl + 8,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // ── Scan Screen ──
  scanScreenDark: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },
  scanHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  scanSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(168,197,176,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanEmptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingBottom: 60,
  },
  scanIllustration: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
    marginBottom: SPACING.xxl + 8,
    ...SHADOWS.lg,
  },
  scanIllustrationGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  scanIllustrationEmoji: {
    fontSize: 52,
    position: "absolute",
  },
  scanEmptyClaim: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.darkText,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: SPACING.xxl,
    lineHeight: 32,
  },
  scanPrimaryBtn: {
    width: "100%",
    maxWidth: 340,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    marginBottom: SPACING.xl,
    ...SHADOWS.lg,
  },
  scanPrimaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg + 2,
    paddingHorizontal: SPACING.xxl,
  },
  scanPrimaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  scanSecondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  scanSecondaryBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  scanSecondaryBtnText: {
    fontSize: 14,
    color: COLORS.darkAccent,
    fontWeight: "500",
  },
  scanSecondaryDot: {
    color: COLORS.darkAccent,
    opacity: 0.4,
  },

  // Scan - Has Results State
  scanHasResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  scanHasResultsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.darkText,
    letterSpacing: -0.8,
  },
  scanLastScanCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.darkSurface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(168,197,176,0.12)",
  },
  scanLastScanMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  scanLastScanLabel: {
    fontSize: 13,
    color: COLORS.darkAccent,
    fontWeight: "500",
  },
  scanMiniCards: {
    marginBottom: SPACING.md,
  },
  scanMiniCard: {
    width: 100,
    marginRight: SPACING.sm,
  },
  scanMiniCardImage: {
    width: 100,
    height: 70,
    borderRadius: RADIUS.md,
    resizeMode: "cover",
    marginBottom: SPACING.xs,
  },
  scanMiniCardPlaceholder: {
    width: 100,
    height: 70,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.darkBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  scanMiniCardName: {
    fontSize: 11,
    color: COLORS.darkTextSub,
    fontWeight: "500",
    lineHeight: 15,
  },
  scanLastScanStats: {
    fontSize: 13,
    color: COLORS.darkTextSub,
  },
  scanSeeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  scanSeeAllText: {
    fontSize: 14,
    color: COLORS.darkAccent,
    fontWeight: "500",
  },

  // Scan - Loading State
  scanLoadingScreen: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: SPACING.xl,
  },
  scanLoadingTop: {
    alignItems: "center",
  },
  scanLoadingIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: "rgba(168,197,176,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  scanLoadingTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.darkText,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  scanLoadingSubtitle: {
    fontSize: 14,
    color: COLORS.darkTextSub,
    textAlign: "center",
  },
  scanFoundChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  scanFoundChip: {
    backgroundColor: "rgba(168,197,176,0.15)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(168,197,176,0.2)",
  },
  scanFoundChipText: {
    fontSize: 13,
    color: COLORS.darkAccent,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  scanProgressWrap: {
    alignItems: "center",
  },
  scanProgressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(168,197,176,0.15)",
    borderRadius: 2,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  scanProgressBar: {
    height: "100%",
    backgroundColor: COLORS.darkAccent,
    borderRadius: 2,
  },
  scanProgressLabel: {
    fontSize: 12,
    color: COLORS.darkTextSub,
  },

  // ── Results Screen ──
  resultsScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  resultsBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },
  resultsHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  resultsHeaderSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  filterTabsWrap: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 0,
  },
  filterTabsScroll: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: "#fff",
  },
  filterTabBadge: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  filterTabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterTabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  recipeListContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 100,
    gap: SPACING.md,
  },

  // Full Recipe Card
  fullRecipeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  fullRecipeCardReady: {
    borderWidth: 1.5,
    borderColor: COLORS.matchReady + "40",
  },
  fullRecipeImageWrap: {
    height: 200,
    position: "relative",
    backgroundColor: COLORS.border,
  },
  fullRecipeImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  fullRecipeImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.border,
  },
  readyBadgeOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.matchReady,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  readyBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  fullRecipeContent: {
    padding: SPACING.lg,
    paddingRight: 52,
  },
  fullRecipeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  fullRecipeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  fullRecipeMetaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  fullRecipeTag: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  fullRecipeTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  fullRecipeMissing: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: "500",
  },
  fullRecipeHeart: {
    position: "absolute",
    top: SPACING.lg,
    right: SPACING.lg,
    padding: 4,
  },

  // Grid Card (Saved tab)
  favoritesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  gridCard: {
    width: (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.sm * 2) / 3,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
  },
  gridCardImage: {
    width: "100%",
    height: 90,
    resizeMode: "cover",
  },
  gridCardImagePlaceholder: {
    width: "100%",
    height: 90,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  gridCardName: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
    padding: SPACING.sm,
    lineHeight: 15,
  },

  // ── Kitchen Tab ──
  kitchenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  kitchenHeaderTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  kitchenEditBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  kitchenEditBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  kitchenSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  kitchenSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  kitchenSummaryNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
  },
  kitchenSummaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  kitchenSummarySubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  kitchenCategories: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  kitchenCategorySection: {
    gap: SPACING.sm,
  },
  kitchenCategoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kitchenChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  kitchenChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  kitchenChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  kitchenChipQty: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  kitchenAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  kitchenAddBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // ── Saved Tab ──
  savedHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  savedHeaderTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  savedSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  savedSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  savedSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  savedSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  savedBadge: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  savedEmptyNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  shoppingAddRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  shoppingAddInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  shoppingAddBtn: {
    paddingHorizontal: SPACING.lg,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  shoppingAddBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  shoppingListWrap: {
    gap: SPACING.sm,
  },
  shoppingItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  shoppingItemChecked: {
    opacity: 0.6,
    borderColor: COLORS.success + "30",
  },
  shoppingCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  shoppingCheckboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  shoppingItemName: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  shoppingItemNameChecked: {
    textDecorationLine: "line-through",
    color: COLORS.textSecondary,
  },
  shoppingItemRecipe: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  clearCheckedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  clearCheckedText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyItemLeft: {},
  historyItemDate: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  historyItemCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ── Recipe Detail ──
  detailNav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.xl,
  },
  detailNavBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailCard: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.7,
    lineHeight: 33,
    marginBottom: SPACING.md,
  },
  detailMetaRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    flexWrap: "wrap",
  },
  detailTag: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  detailTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  detailMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailMatchText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  detailMissingCard: {
    backgroundColor: COLORS.warning + "10",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.warning + "30",
  },
  detailMissingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailMissingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.warning,
  },
  missingChip: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderWidth: 1,
    borderColor: COLORS.warning + "40",
  },
  missingChipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  addToListInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  addToListInlineText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  detailSection: {
    marginBottom: SPACING.xl,
  },
  detailSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
  detailIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  detailIngredientMeasure: {
    width: 90,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  detailIngredientName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  detailStepRow: {
    flexDirection: "row",
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  detailStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  detailStepNumText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  detailStepText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 24,
  },
  detailActions: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  startCookingBtn: {
    borderRadius: RADIUS.full,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  startCookingBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg + 2,
  },
  startCookingBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  detailSecondaryActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  detailSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  detailSecondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // ── Cook Mode ──
  cookScreen: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },
  cookTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  cookStepCounter: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.darkAccent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cookExitIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(168,197,176,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  cookProgressTrack: {
    marginHorizontal: SPACING.xl,
    height: 3,
    backgroundColor: "rgba(168,197,176,0.15)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: SPACING.lg,
  },
  cookProgressBar: {
    height: "100%",
    backgroundColor: COLORS.darkAccent,
    borderRadius: 2,
  },
  cookRecipeName: {
    fontSize: 13,
    color: COLORS.darkTextSub,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
    fontWeight: "500",
  },
  cookStepContent: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: "center",
  },
  cookStepText: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.darkText,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  cookNavRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
  },
  cookNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  cookNavBtnSecondary: {
    flex: 1,
    backgroundColor: "rgba(168,197,176,0.1)",
  },
  cookNavBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.darkAccent,
  },
  cookNavBtnPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
  },
  cookNavBtnPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  cookExitBtn: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(168,197,176,0.15)",
    alignItems: "center",
  },
  cookExitBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.darkAccent,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary + "12",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  modalInput: {
    height: 52,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalDestructiveBtn: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.error + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  modalDestructiveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.error,
  },
  modalCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Tab Bar ──
  tabBarDark: {
    position: "absolute",
    backgroundColor: COLORS.darkGlass,
    borderTopWidth: 0,
    height: 84,
    paddingBottom: 24,
    paddingTop: SPACING.sm,
    borderTopColor: "rgba(168,197,176,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  tabBarLight: {
    position: "absolute",
    backgroundColor: COLORS.glass,
    borderTopWidth: 0,
    height: 84,
    paddingBottom: 24,
    paddingTop: SPACING.sm,
    shadowColor: "#16120C",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 14,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
});
