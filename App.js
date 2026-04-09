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
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const API_KEY_STORAGE = "@openai_api_key";
const FAVORITES_STORAGE = "@favorite_recipes";
const HISTORY_STORAGE = "@scan_history";
const INGREDIENTS_STORAGE = "@current_ingredients";
const RECIPES_STORAGE = "@current_recipes";
const SHOPPING_LIST_STORAGE = "@shopping_list";
const SERVER_URL = "https://undecompounded-multicrystalline-natasha.ngrok-free.dev";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: "#4CAF50",
  primaryLight: "#81C784",
  primaryDark: "#388E3C",
  secondary: "#FFF8E7",
  background: "#FAFAF5",
  card: "#FFFFFF",
  accent: "#FF9800",
  accentLight: "#FFB74D",
  text: "#2D3436",
  textSecondary: "#636E72",
  textLight: "#B2BEC3",
  border: "#E8E8E0",
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#EF5350",
  gradient: ["#4CAF50", "#81C784"],
};

const CATEGORY_CONFIG = {
  Breakfast: { color: "#FF9800", icon: "sunny-outline", emoji: "🌅" },
  Lunch: { color: "#4CAF50", icon: "restaurant-outline", emoji: "🥗" },
  Dinner: { color: "#7E57C2", icon: "moon-outline", emoji: "🍽️" },
  Snack: { color: "#FFB74D", icon: "cafe-outline", emoji: "🍿" },
  Dessert: { color: "#E91E63", icon: "ice-cream-outline", emoji: "🍰" },
  Salad: { color: "#66BB6A", icon: "leaf-outline", emoji: "🥬" },
  Soup: { color: "#FF7043", icon: "water-outline", emoji: "🍲" },
  Drink: { color: "#42A5F5", icon: "wine-outline", emoji: "🥤" },
  All: { color: "#78909C", icon: "grid-outline", emoji: "📋" },
};

const SkeletonLoader = ({ width, height, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: "#E0E0E0",
          borderRadius: 12,
          opacity,
        },
        style,
      ]}
    />
  );
};

const EmptyState = ({ icon, title, subtitle, actionText, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIcon}>
      <Ionicons name={icon} size={48} color={COLORS.textLight} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
    {actionText && onAction && (
      <TouchableOpacity style={styles.emptyStateButton} onPress={onAction}>
        <Text style={styles.emptyStateButtonText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const RecipeCard = ({ recipe, onPress, onFavorite, isFavorited, compact }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const categoryConfig = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG.All;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.recipeCard, compact && styles.recipeCardCompact]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.recipeImageContainer, compact && styles.recipeImageContainerCompact]}>
          <View style={[styles.recipeImagePlaceholder, { backgroundColor: `${categoryConfig.color}20` }]}>
            <Text style={styles.recipeEmoji}>{categoryConfig.emoji}</Text>
          </View>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              onFavorite(recipe);
            }}
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={20}
              color={isFavorited ? COLORS.error : "#fff"}
            />
          </TouchableOpacity>
          <View style={[styles.categoryPill, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryPillText}>{recipe.category}</Text>
          </View>
        </View>
        <View style={styles.recipeCardContent}>
          <Text style={styles.recipeCardTitle} numberOfLines={2}>{recipe.name}</Text>
          <View style={styles.recipeCardMeta}>
            {recipe.time && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{recipe.time}</Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={styles.metaItem}>
                <Ionicons name="speedometer-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const IngredientChip = ({ ingredient, onRemove, editable }) => (
  <View style={styles.ingredientChip}>
    <View style={styles.ingredientChipIcon}>
      <Ionicons name="nutrition-outline" size={16} color={COLORS.primary} />
    </View>
    <View style={styles.ingredientChipContent}>
      <Text style={styles.ingredientChipName} numberOfLines={1}>{ingredient.name}</Text>
      {ingredient.quantity && (
        <Text style={styles.ingredientChipQuantity}>{ingredient.quantity}</Text>
      )}
    </View>
    {editable && onRemove && (
      <TouchableOpacity style={styles.ingredientChipRemove} onPress={onRemove}>
        <Ionicons name="close" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
    )}
  </View>
);

function HomeTab({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [savedKey, savedIngredients, savedRecipes, savedFavorites] = await Promise.all([
        AsyncStorage.getItem(API_KEY_STORAGE),
        AsyncStorage.getItem(INGREDIENTS_STORAGE),
        AsyncStorage.getItem(RECIPES_STORAGE),
        AsyncStorage.getItem(FAVORITES_STORAGE),
      ]);
      if (savedKey) setApiKey(savedKey);
      if (savedIngredients) setIngredients(JSON.parse(savedIngredients));
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    } catch (e) {
      console.error("Failed to load data:", e);
    }
  };

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, tempApiKey);
      setApiKey(tempApiKey);
      setShowApiModal(false);
      Alert.alert("Success", "API key saved!");
    } catch (e) {
      Alert.alert("Error", "Failed to save API key");
    }
  };

  const startScan = async (useCamera) => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to continue.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: true,
        });

    if (!result.canceled && result.assets[0].base64) {
      analyzeImage(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const analyzeImage = async (base64, imageUri) => {
    setScanning(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    try {
      console.log("Starting analysis...");
      console.log("API Key present:", !!apiKey);
      console.log("Image base64 length:", base64?.length);
      
      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ image_base64: base64, api_key: apiKey }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error(errorText || "Analysis failed");
      }

      const data = await response.json();
      console.log("Analysis result:", JSON.stringify(data).substring(0, 500));
      
      const result = data.result || data;
      const newIngredients = result.products || [];
      const newRecipes = result.recipes || [];

      setIngredients(newIngredients);
      setRecipes(newRecipes);

      await Promise.all([
        AsyncStorage.setItem(INGREDIENTS_STORAGE, JSON.stringify(newIngredients)),
        AsyncStorage.setItem(RECIPES_STORAGE, JSON.stringify(newRecipes)),
      ]);

      const historyEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        imageUri,
        products: newIngredients,
        recipes: newRecipes,
      };
      const savedHistory = await AsyncStorage.getItem(HISTORY_STORAGE);
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      await AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify([historyEntry, ...history].slice(0, 30)));

    } catch (e) {
      console.error("Analysis error:", e);
      const errorMessage = e.message || "Unknown error";
      Alert.alert("Analysis Failed", errorMessage.includes("API") ? errorMessage : "Could not connect to the server. Please check your connection and try again.");
    } finally {
      setScanning(false);
      scanAnim.stopAnimation();
    }
  };

  const toggleFavorite = async (recipe) => {
    const isFav = favorites.some((f) => f.name === recipe.name);
    const updated = isFav
      ? favorites.filter((f) => f.name !== recipe.name)
      : [{ ...recipe, savedAt: new Date().toISOString() }, ...favorites];
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(updated));
  };

  const isFavorited = (recipe) => favorites.some((f) => f.name === recipe.name);

  const recipesByCategory = recipes.reduce((acc, recipe) => {
    const cat = recipe.category || "All";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(recipe);
    return acc;
  }, {});

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.greeting}>{greeting()}! 👋</Text>
          <Text style={styles.headerQuestion}>What's in your fridge today?</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowApiModal(true)}>
          <Ionicons name="settings-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => {
            Alert.alert("Scan Fridge", "Choose an option", [
              { text: "Take Photo", onPress: () => startScan(true) },
              { text: "Choose from Library", onPress: () => startScan(false) },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
          disabled={scanning}
        >
          <LinearGradient
            colors={scanning ? ["#9E9E9E", "#BDBDBD"] : COLORS.gradient}
            style={styles.scanButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {scanning ? (
              <View style={styles.scanningContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.scanButtonText}>Scanning your fridge...</Text>
              </View>
            ) : (
              <>
                <View style={styles.scanIconContainer}>
                  <Ionicons name="scan-outline" size={32} color="#fff" />
                </View>
                <Text style={styles.scanButtonText}>Scan Your Fridge</Text>
                <Text style={styles.scanButtonSubtext}>Take a photo to detect ingredients</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {ingredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Detected Ingredients</Text>
              <TouchableOpacity onPress={() => navigation.navigate("IngredientsTab")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ingredientsScroll}>
              {ingredients.slice(0, 8).map((ing, i) => (
                <IngredientChip key={i} ingredient={ing} />
              ))}
              {ingredients.length > 8 && (
                <View style={styles.moreChip}>
                  <Text style={styles.moreChipText}>+{ingredients.length - 8}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {scanning && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generating recipes...</Text>
            <View style={styles.skeletonRow}>
              <SkeletonLoader width={160} height={200} style={{ marginRight: 12 }} />
              <SkeletonLoader width={160} height={200} style={{ marginRight: 12 }} />
              <SkeletonLoader width={160} height={200} />
            </View>
          </View>
        )}

        {!scanning && recipes.length === 0 && ingredients.length === 0 && (
          <EmptyState
            icon="restaurant-outline"
            title="No ingredients yet"
            subtitle="Scan your fridge to discover what you can cook!"
            actionText="Scan Now"
            onAction={() => startScan(true)}
          />
        )}

        {!scanning && Object.keys(recipesByCategory).map((category) => (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.categoryEmoji}>
                  {CATEGORY_CONFIG[category]?.emoji || "📋"}
                </Text>
                <Text style={styles.sectionTitle}>{category}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{recipesByCategory[category].length}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recipesByCategory[category].map((recipe, i) => (
                <RecipeCard
                  key={i}
                  recipe={recipe}
                  onPress={() => navigation.navigate("RecipeDetail", { recipe })}
                  onFavorite={toggleFavorite}
                  isFavorited={isFavorited(recipe)}
                  compact
                />
              ))}
            </ScrollView>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showApiModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>OpenAI API Key</Text>
              <Text style={styles.modalSubtitle}>Required for AI-powered food recognition</Text>
            </View>
            <TextInput
              style={styles.apiInput}
              placeholder="sk-..."
              placeholderTextColor={COLORS.textLight}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowApiModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !tempApiKey && styles.modalSaveBtnDisabled]}
                onPress={saveApiKey}
                disabled={!tempApiKey}
              >
                <Text style={styles.modalSaveText}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function IngredientsTab({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  useEffect(() => {
    loadIngredients();
    const unsubscribe = navigation.addListener("focus", loadIngredients);
    return unsubscribe;
  }, [navigation]);

  const loadIngredients = async () => {
    try {
      const saved = await AsyncStorage.getItem(INGREDIENTS_STORAGE);
      if (saved) setIngredients(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load ingredients:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveIngredients = async (updated) => {
    setIngredients(updated);
    await AsyncStorage.setItem(INGREDIENTS_STORAGE, JSON.stringify(updated));
  };

  const deleteIngredient = (index) => {
    Alert.alert("Remove Item", "Remove this ingredient?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => saveIngredients(ingredients.filter((_, i) => i !== index)),
      },
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

  const rescanFridge = () => {
    navigation.navigate("HomeTab");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>My Ingredients</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {ingredients.length === 0 ? (
          <EmptyState
            icon="nutrition-outline"
            title="No ingredients yet"
            subtitle="Scan your fridge to get started"
            actionText="Scan Fridge"
            onAction={rescanFridge}
          />
        ) : (
          <View style={styles.ingredientsGrid}>
            {ingredients.map((item, index) => (
              <View key={index} style={styles.ingredientCard}>
                <View style={styles.ingredientCardIcon}>
                  <Ionicons name="nutrition" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.ingredientCardName} numberOfLines={2}>{item.name}</Text>
                {item.quantity && (
                  <Text style={styles.ingredientCardQuantity}>{item.quantity}</Text>
                )}
                <View style={styles.ingredientCardActions}>
                  <TouchableOpacity style={styles.ingredientActionBtn} onPress={() => startEdit(index)}>
                    <Feather name="edit-2" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ingredientActionBtn} onPress={() => deleteIngredient(index)}>
                    <Feather name="trash-2" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.rescanButton} onPress={rescanFridge}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
          <Text style={styles.rescanButtonText}>Rescan Fridge</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={editingIndex !== null} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Ingredient</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Quantity (optional)"
              value={editQuantity}
              onChangeText={setEditQuantity}
            />
            <View style={styles.modalButtons}>
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

      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Ingredient</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Quantity (optional)"
              value={newQuantity}
              onChangeText={setNewQuantity}
            />
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

function FavoritesTab({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    loadFavorites();
    const unsubscribe = navigation.addListener("focus", loadFavorites);
    return unsubscribe;
  }, [navigation]);

  const loadFavorites = async () => {
    try {
      const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load favorites:", e);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (recipe) => {
    const updated = favorites.filter((f) => f.name !== recipe.name);
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(updated));
  };

  const categories = ["All", ...new Set(favorites.map((r) => r.category).filter(Boolean))];
  const filteredFavorites = selectedCategory === "All"
    ? favorites
    : favorites.filter((r) => r.category === selectedCategory);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Favorites</Text>
        <View style={styles.countBadgeLarge}>
          <Ionicons name="heart" size={16} color={COLORS.error} />
          <Text style={styles.countTextLarge}>{favorites.length}</Text>
        </View>
      </View>

      {favorites.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {favorites.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            subtitle="Save recipes you love for quick access"
          />
        ) : (
          <View style={styles.favoritesGrid}>
            {filteredFavorites.map((recipe, i) => (
              <RecipeCard
                key={i}
                recipe={recipe}
                onPress={() => navigation.navigate("RecipeDetail", { recipe })}
                onFavorite={removeFavorite}
                isFavorited={true}
              />
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ShoppingListTab({ navigation }) {
  const [shoppingList, setShoppingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    loadShoppingList();
    const unsubscribe = navigation.addListener("focus", loadShoppingList);
    return unsubscribe;
  }, [navigation]);

  const loadShoppingList = async () => {
    try {
      const saved = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE);
      if (saved) setShoppingList(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load shopping list:", e);
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
    updated[index].checked = !updated[index].checked;
    saveList(updated);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    saveList([...shoppingList, { name: newItem.trim(), checked: false }]);
    setNewItem("");
  };

  const removeItem = (index) => {
    saveList(shoppingList.filter((_, i) => i !== index));
  };

  const clearChecked = () => {
    saveList(shoppingList.filter((item) => !item.checked));
  };

  const shareList = async () => {
    const unchecked = shoppingList.filter((item) => !item.checked);
    if (unchecked.length === 0) {
      Alert.alert("Empty List", "No items to share.");
      return;
    }
    const text = `🛒 Shopping List\n\n${unchecked.map((item) => `☐ ${item.name}`).join("\n")}`;
    try {
      await Share.share({ message: text });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  const copyList = async () => {
    const unchecked = shoppingList.filter((item) => !item.checked);
    if (unchecked.length === 0) {
      Alert.alert("Empty List", "No items to copy.");
      return;
    }
    const text = unchecked.map((item) => `• ${item.name}`).join("\n");
    Alert.alert("Copied!", "Shopping list copied to clipboard.");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const checkedCount = shoppingList.filter((item) => item.checked).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Shopping List</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={shareList}>
            <Ionicons name="share-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={copyList}>
            <Ionicons name="copy-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.addItemRow}>
        <TextInput
          style={styles.addItemInput}
          placeholder="Add item..."
          placeholderTextColor={COLORS.textLight}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {shoppingList.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title="Your list is empty"
            subtitle="Add items or generate from recipes"
          />
        ) : (
          <>
            {shoppingList.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.shoppingItem, item.checked && styles.shoppingItemChecked]}
                onPress={() => toggleItem(index)}
              >
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                  {item.checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={[styles.shoppingItemText, item.checked && styles.shoppingItemTextChecked]}>
                  {item.name}
                </Text>
                <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeItemBtn}>
                  <Ionicons name="close" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {checkedCount > 0 && (
              <TouchableOpacity style={styles.clearCheckedBtn} onPress={clearChecked}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={styles.clearCheckedText}>Clear {checkedCount} checked items</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RecipeDetailScreen({ route, navigation }) {
  const { recipe } = route.params;
  const [isFavorited, setIsFavorited] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const categoryConfig = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG.All;

  useEffect(() => {
    checkFavorite();
  }, []);

  const checkFavorite = async () => {
    try {
      const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
      if (saved) {
        const favorites = JSON.parse(saved);
        setIsFavorited(favorites.some((f) => f.name === recipe.name));
      }
    } catch (e) {
      console.error("Failed to check favorite:", e);
    }
  };

  const toggleFavorite = async () => {
    try {
      const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
      let favorites = saved ? JSON.parse(saved) : [];
      if (isFavorited) {
        favorites = favorites.filter((f) => f.name !== recipe.name);
      } else {
        favorites = [{ ...recipe, savedAt: new Date().toISOString() }, ...favorites];
      }
      await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(favorites));
      setIsFavorited(!isFavorited);
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  const toggleIngredient = (ing) => {
    setCheckedIngredients((prev) => ({ ...prev, [ing]: !prev[ing] }));
  };

  const addMissingToShoppingList = async () => {
    const missing = recipe.additional_ingredients || [];
    if (missing.length === 0) {
      Alert.alert("All Set!", "You have all the ingredients.");
      return;
    }

    try {
      const saved = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE);
      let list = saved ? JSON.parse(saved) : [];
      const existingNames = list.map((item) => item.name.toLowerCase());
      const newItems = missing
        .filter((item) => !existingNames.includes(item.toLowerCase()))
        .map((name) => ({ name, checked: false }));
      
      if (newItems.length === 0) {
        Alert.alert("Already Added", "All missing ingredients are in your shopping list.");
        return;
      }

      await AsyncStorage.setItem(SHOPPING_LIST_STORAGE, JSON.stringify([...list, ...newItems]));
      Alert.alert("Added!", `${newItems.length} items added to shopping list.`);
    } catch (e) {
      console.error("Failed to add to shopping list:", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.recipeDetailHeader}>
        <View style={[styles.recipeHeroPlaceholder, { backgroundColor: `${categoryConfig.color}30` }]}>
          <Text style={styles.recipeHeroEmoji}>{categoryConfig.emoji}</Text>
        </View>
        
        <View style={styles.recipeDetailNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={toggleFavorite}>
            <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={24} color={isFavorited ? COLORS.error : "#fff"} />
          </TouchableOpacity>
        </View>

        <View style={styles.recipeDetailTitleContainer}>
          <View style={[styles.categoryPillLarge, { backgroundColor: categoryConfig.color }]}>
            <Ionicons name={categoryConfig.icon} size={16} color="#fff" />
            <Text style={styles.categoryPillTextLarge}>{recipe.category}</Text>
          </View>
          <Text style={styles.recipeDetailTitle}>{recipe.name}</Text>
          <View style={styles.recipeDetailMeta}>
            {recipe.time && (
              <View style={styles.metaItemLarge}>
                <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.metaTextLarge}>{recipe.time}</Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={styles.metaItemLarge}>
                <Ionicons name="speedometer-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.metaTextLarge}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.recipeDetailScroll}>
        {recipe.description && (
          <View style={styles.recipeSection}>
            <Text style={styles.recipeDescription}>{recipe.description}</Text>
          </View>
        )}

        <View style={styles.recipeSection}>
          <View style={styles.recipeSectionHeader}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <Text style={styles.recipeSectionTitle}>Available Ingredients</Text>
          </View>
          {recipe.ingredients_from_image?.map((ing, i) => (
            <TouchableOpacity
              key={i}
              style={styles.ingredientRow}
              onPress={() => toggleIngredient(ing)}
            >
              <View style={[styles.ingredientCheckbox, checkedIngredients[ing] && styles.ingredientCheckboxChecked]}>
                {checkedIngredients[ing] && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.ingredientRowText, checkedIngredients[ing] && styles.ingredientRowTextChecked]}>
                {ing}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {recipe.additional_ingredients?.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="cart-outline" size={22} color={COLORS.warning} />
              <Text style={styles.recipeSectionTitle}>Missing Ingredients</Text>
            </View>
            {recipe.additional_ingredients.map((ing, i) => (
              <View key={i} style={styles.missingIngredientRow}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.warning} />
                <Text style={styles.missingIngredientText}>{ing}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.addToListBtn} onPress={addMissingToShoppingList}>
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addToListBtnText}>Add to Shopping List</Text>
            </TouchableOpacity>
          </View>
        )}

        {recipe.steps?.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="list" size={22} color={COLORS.primary} />
              <Text style={styles.recipeSectionTitle}>Instructions</Text>
            </View>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.saveRecipeBtn} onPress={toggleFavorite}>
          <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={22} color="#fff" />
          <Text style={styles.saveRecipeBtnText}>
            {isFavorited ? "Remove from Favorites" : "Save to Favorites"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "HomeTab") iconName = focused ? "home" : "home-outline";
          else if (route.name === "IngredientsTab") iconName = focused ? "nutrition" : "nutrition-outline";
          else if (route.name === "FavoritesTab") iconName = focused ? "heart" : "heart-outline";
          else if (route.name === "ShoppingTab") iconName = focused ? "cart" : "cart-outline";
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeTab} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="IngredientsTab" component={IngredientsTab} options={{ tabBarLabel: "Ingredients" }} />
      <Tab.Screen name="FavoritesTab" component={FavoritesTab} options={{ tabBarLabel: "Favorites" }} />
      <Tab.Screen name="ShoppingTab" component={ShoppingListTab} options={{ tabBarLabel: "Shopping" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Home Header
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  headerQuestion: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Scan Button
  scanButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  scanButtonGradient: {
    padding: 28,
    alignItems: "center",
  },
  scanIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scanButtonSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  scanningContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  countBadge: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Ingredients Scroll
  ingredientsScroll: {
    flexDirection: "row",
  },
  ingredientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  ingredientChipContent: {
    maxWidth: 100,
  },
  ingredientChipName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  ingredientChipQuantity: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  ingredientChipRemove: {
    marginLeft: 8,
    padding: 4,
  },
  moreChip: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  moreChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Recipe Cards
  recipeCard: {
    width: SCREEN_WIDTH * 0.42,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  recipeCardCompact: {
    width: SCREEN_WIDTH * 0.42,
  },
  recipeImageContainer: {
    height: 120,
    position: "relative",
  },
  recipeImageContainerCompact: {
    height: 100,
  },
  recipeImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeEmoji: {
    fontSize: 40,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryPill: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  recipeCardContent: {
    padding: 14,
  },
  recipeCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  recipeCardMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyStateButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  // Skeleton
  skeletonRow: {
    flexDirection: "row",
    marginTop: 12,
  },

  // Screen Header
  screenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Ingredients Grid
  ingredientsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ingredientCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  ingredientCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 4,
  },
  ingredientCardQuantity: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  ingredientCardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  ingredientActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  rescanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Favorites
  countBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.error + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countTextLarge: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.error,
  },
  filterScroll: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  favoritesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  // Shopping List
  addItemRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  addItemInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.text,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  addItemBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  shoppingItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  shoppingItemChecked: {
    backgroundColor: COLORS.primary + "10",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  shoppingItemText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  shoppingItemTextChecked: {
    textDecorationLine: "line-through",
    color: COLORS.textSecondary,
  },
  removeItemBtn: {
    padding: 4,
  },
  clearCheckedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  clearCheckedText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.error,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  apiInput: {
    height: 52,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  modalInput: {
    height: 52,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSaveBtnDisabled: {
    backgroundColor: COLORS.textLight,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  // Recipe Detail
  recipeDetailHeader: {
    position: "relative",
  },
  recipeHeroPlaceholder: {
    height: 260,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeHeroEmoji: {
    fontSize: 80,
  },
  recipeDetailNav: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeDetailTitleContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 20,
  },
  categoryPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryPillTextLarge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  recipeDetailTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 30,
  },
  recipeDetailMeta: {
    flexDirection: "row",
    gap: 20,
  },
  metaItemLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaTextLarge: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  recipeDetailScroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  recipeSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  recipeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  recipeSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  recipeDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ingredientCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  ingredientCheckboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  ingredientRowText: {
    fontSize: 15,
    color: COLORS.text,
  },
  ingredientRowTextChecked: {
    textDecorationLine: "line-through",
    color: COLORS.textSecondary,
  },
  missingIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  missingIngredientText: {
    fontSize: 15,
    color: COLORS.text,
  },
  addToListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.warning,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  addToListBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  saveRecipeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  saveRecipeBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  // Tab Bar
  tabBar: {
    position: "absolute",
    backgroundColor: COLORS.card,
    borderTopWidth: 0,
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
