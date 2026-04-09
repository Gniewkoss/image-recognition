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

const SkeletonLoader = ({ width, height, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
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
      style={[{ width, height, backgroundColor: "#E0E0E0", borderRadius: 12, opacity }, style]}
    />
  );
};

const EmptyState = ({ icon, title, subtitle, actionText, onAction }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Ionicons name={icon} size={42} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
      {actionText && onAction && (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            style={styles.emptyStateButton} 
            onPress={onAction}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            <Text style={styles.emptyStateButtonText}>{actionText}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const MatchBadge = ({ percent }) => {
  const getColor = () => {
    if (percent >= 60) return COLORS.success;
    if (percent >= 40) return COLORS.warning;
    return COLORS.textSecondary;
  };

  return (
    <View style={[styles.matchBadge, { backgroundColor: getColor() }]}>
      <Text style={styles.matchBadgeText}>{percent}% match</Text>
    </View>
  );
};

const getCategoryColor = (category) => {
  const colors = {
    'Breakfast': '#FF9800',
    'Lunch': '#4CAF50',
    'Dinner': '#7E57C2',
    'Snack': '#FFB74D',
    'Dessert': '#E91E63',
    'Salad': '#66BB6A',
    'Drink': '#42A5F5',
    'Side': '#78909C',
  };
  return colors[category] || '#9E9E9E';
};

const getIngredientIcon = (name) => {
  const lowered = name.toLowerCase();
  
  // Proteins
  if (/chicken|poultry|turkey|duck/.test(lowered)) return { icon: 'drumstick-bite', type: 'mci', color: '#D4A574' };
  if (/beef|steak|meat|pork|lamb|bacon|ham|sausage/.test(lowered)) return { icon: 'food-steak', type: 'mci', color: '#C0392B' };
  if (/fish|salmon|tuna|cod|shrimp|prawn|seafood|crab|lobster/.test(lowered)) return { icon: 'fish', type: 'ion', color: '#3498DB' };
  if (/egg/.test(lowered)) return { icon: 'egg-outline', type: 'ion', color: '#F5D6BA' };
  
  // Dairy
  if (/milk|cream/.test(lowered)) return { icon: 'cup', type: 'mci', color: '#ECF0F1' };
  if (/cheese|cheddar|mozzarella|parmesan/.test(lowered)) return { icon: 'cheese', type: 'mci', color: '#F4D03F' };
  if (/butter/.test(lowered)) return { icon: 'cube-outline', type: 'ion', color: '#F9E79F' };
  if (/yogurt|yoghurt/.test(lowered)) return { icon: 'cup-outline', type: 'mci', color: '#FDEBD0' };
  
  // Vegetables
  if (/tomato/.test(lowered)) return { icon: 'food-apple', type: 'mci', color: '#E74C3C' };
  if (/carrot/.test(lowered)) return { icon: 'carrot', type: 'mci', color: '#E67E22' };
  if (/onion|garlic|shallot/.test(lowered)) return { icon: 'food-variant', type: 'mci', color: '#D5DBDB' };
  if (/potato|potatoes/.test(lowered)) return { icon: 'food-variant', type: 'mci', color: '#D4A574' };
  if (/lettuce|salad|spinach|kale|greens/.test(lowered)) return { icon: 'leaf', type: 'ion', color: '#27AE60' };
  if (/pepper|capsicum|chili|jalapeno/.test(lowered)) return { icon: 'chili-mild', type: 'mci', color: '#E74C3C' };
  if (/broccoli|cauliflower/.test(lowered)) return { icon: 'flower-outline', type: 'mci', color: '#2ECC71' };
  if (/mushroom/.test(lowered)) return { icon: 'mushroom-outline', type: 'mci', color: '#8D6E63' };
  if (/corn/.test(lowered)) return { icon: 'corn', type: 'mci', color: '#F1C40F' };
  if (/celery|cucumber|zucchini/.test(lowered)) return { icon: 'leaf', type: 'ion', color: '#82E0AA' };
  if (/avocado/.test(lowered)) return { icon: 'fruit-pineapple', type: 'mci', color: '#229954' };
  if (/pea|bean|lentil/.test(lowered)) return { icon: 'seed-outline', type: 'mci', color: '#58D68D' };
  
  // Fruits
  if (/apple/.test(lowered)) return { icon: 'food-apple-outline', type: 'mci', color: '#E74C3C' };
  if (/banana/.test(lowered)) return { icon: 'fruit-grapes', type: 'mci', color: '#F4D03F' };
  if (/orange|citrus|lemon|lime/.test(lowered)) return { icon: 'fruit-citrus', type: 'mci', color: '#F39C12' };
  if (/berry|strawberry|blueberry|raspberry/.test(lowered)) return { icon: 'fruit-cherries', type: 'mci', color: '#9B59B6' };
  if (/grape/.test(lowered)) return { icon: 'fruit-grapes', type: 'mci', color: '#8E44AD' };
  if (/pineapple|mango|papaya/.test(lowered)) return { icon: 'fruit-pineapple', type: 'mci', color: '#F1C40F' };
  if (/watermelon|melon/.test(lowered)) return { icon: 'fruit-watermelon', type: 'mci', color: '#E91E63' };
  
  // Grains & Carbs
  if (/bread|toast|baguette|roll/.test(lowered)) return { icon: 'bread-slice-outline', type: 'mci', color: '#D4A574' };
  if (/rice/.test(lowered)) return { icon: 'grain', type: 'mci', color: '#FDEBD0' };
  if (/pasta|noodle|spaghetti|penne|macaroni/.test(lowered)) return { icon: 'noodles', type: 'mci', color: '#F5CBA7' };
  if (/flour|wheat/.test(lowered)) return { icon: 'barley', type: 'mci', color: '#F5DEB3' };
  if (/oat|cereal|granola/.test(lowered)) return { icon: 'barley', type: 'mci', color: '#D4A574' };
  
  // Condiments & Sauces
  if (/sauce|ketchup|mayo|mustard|dressing/.test(lowered)) return { icon: 'bottle-soda-classic-outline', type: 'mci', color: '#E74C3C' };
  if (/oil|olive/.test(lowered)) return { icon: 'water-outline', type: 'ion', color: '#F4D03F' };
  if (/vinegar/.test(lowered)) return { icon: 'bottle-wine-outline', type: 'mci', color: '#C0392B' };
  if (/honey/.test(lowered)) return { icon: 'beehive-outline', type: 'mci', color: '#F5B041' };
  if (/sugar/.test(lowered)) return { icon: 'cube-outline', type: 'ion', color: '#FDFEFE' };
  if (/salt|pepper|spice|seasoning|herb/.test(lowered)) return { icon: 'shaker-outline', type: 'mci', color: '#95A5A6' };
  
  // Beverages
  if (/coffee/.test(lowered)) return { icon: 'coffee-outline', type: 'ion', color: '#6F4E37' };
  if (/tea/.test(lowered)) return { icon: 'leaf', type: 'ion', color: '#2ECC71' };
  if (/juice/.test(lowered)) return { icon: 'cup', type: 'mci', color: '#F39C12' };
  if (/water/.test(lowered)) return { icon: 'water-outline', type: 'ion', color: '#3498DB' };
  if (/wine|beer|alcohol/.test(lowered)) return { icon: 'beer-outline', type: 'ion', color: '#F39C12' };
  
  // Nuts & Seeds
  if (/nut|almond|walnut|peanut|cashew|pistachio/.test(lowered)) return { icon: 'peanut-outline', type: 'mci', color: '#A67C52' };
  if (/seed|sesame|sunflower/.test(lowered)) return { icon: 'seed-outline', type: 'mci', color: '#D4A574' };
  
  // Baking
  if (/chocolate|cocoa/.test(lowered)) return { icon: 'candycane', type: 'mci', color: '#6B4226' };
  if (/vanilla/.test(lowered)) return { icon: 'flower', type: 'ion', color: '#F5DEB3' };
  if (/baking|yeast/.test(lowered)) return { icon: 'cube-outline', type: 'ion', color: '#FDEBD0' };
  
  // Default - universal food icon
  return { icon: 'food-variant', type: 'mci', color: COLORS.primary };
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const RecipeCard = ({ recipe, onPress, onFavorite, isFavorited, compact, gridMode }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, gridMode && { flex: 1 }]}>
      <TouchableOpacity
        style={[styles.recipeCard, compact && styles.recipeCardCompact, gridMode && styles.recipeCardGrid]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.recipeImageContainer, compact && styles.recipeImageContainerCompact]}>
          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
          ) : (
            <View style={[styles.recipeImagePlaceholder, { backgroundColor: getCategoryColor(recipe.category) }]}>
              <Text style={styles.recipeEmojiPlaceholder}>{recipe.emoji || '🍽️'}</Text>
            </View>
          )}
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
          {recipe.match_percent !== undefined && (
            <MatchBadge percent={recipe.match_percent} />
          )}
        </View>
        <View style={styles.recipeCardContent}>
          <Text style={styles.recipeCardTitle} numberOfLines={2}>{recipe.name}</Text>
          <View style={styles.recipeCardMeta}>
            {recipe.id?.startsWith('simple_') && (
              <View style={[styles.metaItem, styles.quickBadge]}>
                <Ionicons name="flash" size={12} color={COLORS.warning} />
                <Text style={[styles.metaText, { color: COLORS.warning, fontWeight: '600' }]}>Quick</Text>
              </View>
            )}
            {recipe.category && !recipe.id?.startsWith('simple_') && (
              <View style={styles.metaItem}>
                <Ionicons name="pricetag-outline" size={12} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{recipe.category}</Text>
              </View>
            )}
            {recipe.missing_count === 0 ? (
              <View style={[styles.metaItem, styles.readyBadge]}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                <Text style={[styles.metaText, { color: COLORS.success }]}>Ready!</Text>
              </View>
            ) : recipe.missing_count > 0 && (
              <View style={[styles.metaItem, styles.missingBadge]}>
                <Ionicons name="cart-outline" size={12} color={COLORS.warning} />
                <Text style={[styles.metaText, { color: COLORS.warning }]}>
                  Need {recipe.missing_count}
                </Text>
              </View>
            )}
          </View>
          {recipe.area && (
            <Text style={styles.recipeArea}>{recipe.area} cuisine</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const IngredientChip = ({ ingredient, onRemove, editable }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { icon, type, color } = getIngredientIcon(ingredient.name);
  
  const handlePressIn = () => {
    if (editable) {
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    }
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const IconComponent = type === 'mci' ? MaterialCommunityIcons : Ionicons;
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.ingredientChip}>
        <View style={[styles.ingredientChipIcon, { backgroundColor: color + '25' }]}>
          <IconComponent name={icon} size={18} color={color} />
        </View>
        <View style={styles.ingredientChipContent}>
          <Text style={styles.ingredientChipName} numberOfLines={1}>{ingredient.name}</Text>
          {ingredient.quantity && (
            <Text style={styles.ingredientChipQuantity}>{ingredient.quantity}</Text>
          )}
        </View>
        {editable && onRemove && (
          <TouchableOpacity 
            style={styles.ingredientChipRemove} 
            onPress={onRemove}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <View style={styles.chipRemoveIcon}>
              <Ionicons name="close" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const RECIPE_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'Breakfast', label: 'Breakfast', icon: 'sunny-outline', emoji: '🌅' },
  { id: 'Lunch', label: 'Lunch', icon: 'restaurant-outline', emoji: '🥗' },
  { id: 'Dinner', label: 'Dinner', icon: 'moon-outline', emoji: '🍽️' },
  { id: 'Snack', label: 'Snack', icon: 'cafe-outline', emoji: '🍿' },
  { id: 'Salad', label: 'Salad', icon: 'leaf-outline', emoji: '🥬' },
  { id: 'Dessert', label: 'Dessert', icon: 'ice-cream-outline', emoji: '🍰' },
  { id: 'Drink', label: 'Drink', icon: 'wine-outline', emoji: '🥤' },
];

function HomeTab({ navigation }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [categorizedRecipes, setCategorizedRecipes] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [searchingRecipes, setSearchingRecipes] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(['all']);

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
      if (savedRecipes) {
        const parsed = JSON.parse(savedRecipes);
        setRecipes(parsed.recipes || []);
        setCategorizedRecipes(parsed.categorized || {});
      }
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

    try {
      console.log("Extracting ingredients...");
      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ image_base64: base64, api_key: apiKey }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Analysis failed");
      }

      const data = await response.json();
      const newIngredients = data.ingredients || [];
      
      console.log("Found ingredients:", newIngredients.length);
      setIngredients(newIngredients);
      await AsyncStorage.setItem(INGREDIENTS_STORAGE, JSON.stringify(newIngredients));

      // Save to history
      const historyEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        imageUri,
        ingredients: newIngredients,
      };
      const savedHistory = await AsyncStorage.getItem(HISTORY_STORAGE);
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      await AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify([historyEntry, ...history].slice(0, 30)));

      // Now search for recipes
      if (newIngredients.length > 0) {
        await searchRecipes(newIngredients);
      }

    } catch (e) {
      console.error("Analysis error:", e);
      Alert.alert("Analysis Failed", e.message || "Could not analyze image.");
    } finally {
      setScanning(false);
    }
  };

  const searchRecipes = async (ingredientsList) => {
    setSearchingRecipes(true);
    
    try {
      console.log("Searching recipes...");
      const response = await fetch(`${SERVER_URL}/search-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ ingredients: ingredientsList }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Recipe search failed");
      }

      const data = await response.json();
      console.log("Found recipes:", data.total);
      
      setRecipes(data.recipes || []);
      setCategorizedRecipes(data.categorized || {});
      
      await AsyncStorage.setItem(RECIPES_STORAGE, JSON.stringify({
        recipes: data.recipes || [],
        categorized: data.categorized || {},
      }));

    } catch (e) {
      console.error("Recipe search error:", e);
      Alert.alert("Search Failed", "Could not find recipes. Please try again.");
    } finally {
      setSearchingRecipes(false);
    }
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

  const toggleCategory = (categoryId) => {
    setSelectedCategories([categoryId]);
  };

  const isAllSelected = selectedCategories.includes('all');
  
  const filterRecipesByCategory = (recipesList) => {
    if (isAllSelected) return recipesList;
    return recipesList.filter(recipe => 
      selectedCategories.includes(recipe.category)
    );
  };

  const getFilteredCategorizedRecipes = () => {
    if (isAllSelected) return categorizedRecipes;
    
    const filtered = {};
    Object.entries(categorizedRecipes).forEach(([key, recipesList]) => {
      const filteredList = filterRecipesByCategory(recipesList);
      if (filteredList.length > 0) {
        filtered[key] = filteredList;
      }
    });
    return filtered;
  };

  const filteredCategorizedRecipes = getFilteredCategorizedRecipes();
  const totalFilteredRecipes = Object.values(filteredCategorizedRecipes).flat().length;

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
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting()}!</Text>
          <Text style={styles.headerQuestion}>What's cooking today?</Text>
        </View>
        <TouchableOpacity 
          style={[styles.headerIconBtn, apiKey && styles.headerIconBtnActive]} 
          onPress={() => setShowApiModal(true)}
        >
          <Ionicons 
            name={apiKey ? "checkmark-circle" : "key-outline"} 
            size={22} 
            color={apiKey ? COLORS.success : COLORS.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.mainScanButton}
            onPress={() => startScan(true)}
            disabled={scanning || searchingRecipes}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={scanning || searchingRecipes ? ["#9E9E9E", "#BDBDBD"] : COLORS.gradient}
              style={styles.mainScanGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {scanning ? (
                <View style={styles.scanningContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.mainScanText}>Detecting...</Text>
                </View>
              ) : searchingRecipes ? (
                <View style={styles.scanningContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.mainScanText}>Finding recipes...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.scanIconCircle}>
                    <Ionicons name="camera-outline" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mainScanText}>Scan Fridge</Text>
                  <Text style={styles.mainScanSubtext}>Take a photo</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => startScan(false)}
              disabled={scanning || searchingRecipes}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryActionIcon}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.secondaryActionText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => navigation.navigate("IngredientsTab")}
              activeOpacity={0.8}
            >
              <View style={[styles.secondaryActionIcon, { backgroundColor: COLORS.accent + '15' }]}>
                <Ionicons name="add-outline" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.secondaryActionText}>Add Manual</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        {(ingredients.length > 0 || recipes.length > 0) && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="nutrition" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.statNumber}>{ingredients.length}</Text>
                <Text style={styles.statLabel}>Ingredients</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.accent + '15' }]}>
                <Ionicons name="restaurant" size={18} color={COLORS.accent} />
              </View>
              <View>
                <Text style={styles.statNumber}>{recipes.length}</Text>
                <Text style={styles.statLabel}>Recipes</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.error + '15' }]}>
                <Ionicons name="heart" size={18} color={COLORS.error} />
              </View>
              <View>
                <Text style={styles.statNumber}>{favorites.length}</Text>
                <Text style={styles.statLabel}>Favorites</Text>
              </View>
            </View>
          </View>
        )}

        {ingredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Ingredients</Text>
              <TouchableOpacity onPress={() => navigation.navigate("IngredientsTab")}>
                <Text style={styles.seeAllText}>Edit</Text>
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
            {recipes.length > 0 && (
              <TouchableOpacity 
                style={styles.refreshRecipesBtn}
                onPress={() => searchRecipes(ingredients)}
                disabled={searchingRecipes}
              >
                <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                <Text style={styles.refreshRecipesText}>Refresh recipes</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {(scanning || searchingRecipes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Finding recipes...</Text>
            <View style={styles.skeletonRow}>
              <SkeletonLoader width={SCREEN_WIDTH * 0.42} height={200} style={{ marginRight: 12 }} />
              <SkeletonLoader width={SCREEN_WIDTH * 0.42} height={200} />
            </View>
          </View>
        )}

        {!scanning && !searchingRecipes && recipes.length === 0 && ingredients.length === 0 && (
          <EmptyState
            icon="restaurant-outline"
            title="No ingredients yet"
            subtitle="Scan your fridge to discover real recipes from around the world!"
            actionText="Scan Now"
            onAction={() => startScan(true)}
          />
        )}

        {!scanning && !searchingRecipes && recipes.length > 0 && (
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Ionicons name="filter-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.filterTitle}>Filter by Category</Text>
              {!isAllSelected && (
                <Text style={styles.filterCount}>({totalFilteredRecipes} recipes)</Text>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {RECIPE_CATEGORIES.map((cat) => {
                const isSelected = cat.id === 'all' ? isAllSelected : selectedCategories.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() => toggleCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={cat.icon} 
                      size={16} 
                      color={isSelected ? '#fff' : COLORS.textSecondary} 
                    />
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!scanning && !searchingRecipes && Object.entries(filteredCategorizedRecipes).map(([category, categoryRecipes]) => {
          if (!categoryRecipes || categoryRecipes.length === 0) return null;

          const getCategoryIcon = (cat) => {
            switch(cat) {
              case 'Quick & Easy': return { icon: 'flash', color: COLORS.warning };
              case 'Best Matches': return { icon: 'star', color: COLORS.success };
              case 'Good Options': return { icon: 'thumbs-up', color: COLORS.primary };
              default: return { icon: 'bulb-outline', color: COLORS.textSecondary };
            }
          };
          const { icon, color } = getCategoryIcon(category);

          return (
            <View key={category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name={icon} size={18} color={color} />
                  <Text style={styles.sectionTitle}>{category}</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{categoryRecipes.length}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categoryRecipes.map((recipe, index) => (
                  <RecipeCard
                    key={`${recipe.id}-${index}`}
                    recipe={recipe}
                    onPress={() => navigation.navigate("RecipeDetail", { recipe, userIngredients: ingredients })}
                    onFavorite={toggleFavorite}
                    isFavorited={isFavorited(recipe)}
                    compact
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}

        {!scanning && !searchingRecipes && recipes.length > 0 && totalFilteredRecipes === 0 && !isAllSelected && (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.noResultsTitle}>No recipes found</Text>
            <Text style={styles.noResultsSubtitle}>
              No recipes match the selected categories.{'\n'}Try selecting different filters.
            </Text>
            <TouchableOpacity 
              style={styles.clearFiltersLargeBtn}
              onPress={() => setSelectedCategories(['all'])}
            >
              <Text style={styles.clearFiltersLargeText}>Show All Recipes</Text>
            </TouchableOpacity>
          </View>
        )}

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
              <Text style={styles.modalSubtitle}>Required for AI ingredient detection</Text>
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
            onAction={() => navigation.navigate("HomeTab")}
          />
        ) : (
          <View style={styles.ingredientsGrid}>
            {ingredients.map((item, index) => {
              const { icon, type, color } = getIngredientIcon(item.name);
              const IconComponent = type === 'mci' ? MaterialCommunityIcons : Ionicons;
              return (
                <Animated.View key={index} style={styles.ingredientCard}>
                  <View style={[styles.ingredientCardIcon, { backgroundColor: color + '20' }]}>
                    <IconComponent name={icon} size={26} color={color} />
                  </View>
                  <Text style={styles.ingredientCardName} numberOfLines={2}>{item.name}</Text>
                  {item.quantity && (
                    <View style={styles.ingredientQuantityBadge}>
                      <Text style={styles.ingredientCardQuantity}>{item.quantity}</Text>
                    </View>
                  )}
                  <View style={styles.ingredientCardActions}>
                    <TouchableOpacity style={styles.ingredientActionBtn} onPress={() => startEdit(index)}>
                      <Feather name="edit-2" size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.ingredientActionBtn, styles.deleteActionBtn]} onPress={() => deleteIngredient(index)}>
                      <Feather name="trash-2" size={15} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.rescanButton} onPress={() => navigation.navigate("HomeTab")}>
          <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
          <Text style={styles.rescanButtonText}>Scan Fridge Again</Text>
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
    const updated = favorites.filter((f) => f.id !== recipe.id);
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(updated));
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
        <Text style={styles.screenTitle}>Favorites</Text>
        <View style={styles.countBadgeLarge}>
          <Ionicons name="heart" size={16} color={COLORS.error} />
          <Text style={styles.countTextLarge}>{favorites.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {favorites.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            subtitle="Save recipes you love for quick access"
          />
        ) : (
          <View style={styles.favoritesGrid}>
            {favorites.map((recipe, index) => (
              <View key={`${recipe.id}-${index}`} style={styles.favoritesGridItem}>
                <RecipeCard
                  recipe={recipe}
                  onPress={() => navigation.navigate("RecipeDetail", { recipe })}
                  onFavorite={removeFavorite}
                  isFavorited={true}
                  gridMode
                />
              </View>
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
            subtitle="Add items or add missing ingredients from recipes"
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
                <Text style={styles.clearCheckedText}>Clear {checkedCount} checked</Text>
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
  const { recipe, userIngredients = [] } = route.params;
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    checkFavorite();
  }, []);

  const checkFavorite = async () => {
    try {
      const saved = await AsyncStorage.getItem(FAVORITES_STORAGE);
      if (saved) {
        const favorites = JSON.parse(saved);
        setIsFavorited(favorites.some((f) => f.id === recipe.id));
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
        favorites = favorites.filter((f) => f.id !== recipe.id);
      } else {
        favorites = [{ ...recipe, savedAt: new Date().toISOString() }, ...favorites];
      }
      await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(favorites));
      setIsFavorited(!isFavorited);
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  const addMissingToShoppingList = async () => {
    const missing = recipe.missing_ingredients || [];
    if (missing.length === 0) {
      Alert.alert("All Set!", "You have all the ingredients needed.");
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

  const openSource = () => {
    const url = recipe.source || recipe.youtube;
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert("No Source", "No external source available for this recipe.");
    }
  };

  const openYoutube = () => {
    if (recipe.youtube) {
      Linking.openURL(recipe.youtube);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.recipeDetailHeader}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={styles.recipeHeroImage} />
        ) : (
          <View style={[styles.recipeHeroPlaceholder, { backgroundColor: getCategoryColor(recipe.category) }]}>
            <Text style={styles.recipeHeroEmoji}>{recipe.emoji || '🍽️'}</Text>
          </View>
        )}
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.heroGradient}
        />
        
        <View style={styles.recipeDetailNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.navRight}>
            {recipe.youtube && (
              <TouchableOpacity style={[styles.navBtn, { marginRight: 10 }]} onPress={openYoutube}>
                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.navBtn} onPress={toggleFavorite}>
              <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={24} color={isFavorited ? COLORS.error : "#fff"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.recipeDetailTitleContainer}>
          <View style={styles.recipeBadges}>
            {recipe.category && (
              <View style={[styles.categoryPillLarge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.categoryPillTextLarge}>{recipe.category}</Text>
              </View>
            )}
            {recipe.area && (
              <View style={[styles.categoryPillLarge, { backgroundColor: COLORS.accent }]}>
                <Ionicons name="globe-outline" size={14} color="#fff" />
                <Text style={styles.categoryPillTextLarge}>{recipe.area}</Text>
              </View>
            )}
          </View>
          <Text style={styles.recipeDetailTitle}>{recipe.name}</Text>
          {recipe.match_percent !== undefined && (
            <View style={styles.matchInfo}>
              <View style={[styles.matchBadgeLarge, { backgroundColor: recipe.match_percent >= 60 ? COLORS.success : recipe.match_percent >= 40 ? COLORS.warning : COLORS.textSecondary }]}>
                <Text style={styles.matchBadgeLargeText}>{recipe.match_percent}% ingredient match</Text>
              </View>
              {recipe.missing_count > 0 && (
                <Text style={styles.missingText}>Missing {recipe.missing_count} ingredients</Text>
              )}
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.recipeDetailScroll}>
        {recipe.matched_ingredients && recipe.matched_ingredients.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.recipeSectionTitle}>You Have ({recipe.matched_count})</Text>
            </View>
            <View style={styles.ingredientTags}>
              {recipe.matched_ingredients.map((ing, i) => (
                <View key={i} style={[styles.ingredientTag, { backgroundColor: COLORS.success + '20', borderColor: COLORS.success }]}>
                  <Text style={[styles.ingredientTagText, { color: COLORS.success }]}>{ing}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="cart-outline" size={22} color={COLORS.warning} />
              <Text style={styles.recipeSectionTitle}>You Need ({recipe.missing_count})</Text>
            </View>
            <View style={styles.ingredientTags}>
              {recipe.missing_ingredients.map((ing, i) => (
                <View key={i} style={[styles.ingredientTag, { backgroundColor: COLORS.warning + '20', borderColor: COLORS.warning }]}>
                  <Text style={[styles.ingredientTagText, { color: COLORS.warning }]}>{ing}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.addToListBtn} onPress={addMissingToShoppingList}>
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addToListBtnText}>Add Missing to Shopping List</Text>
            </TouchableOpacity>
          </View>
        )}

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="list" size={22} color={COLORS.primary} />
              <Text style={styles.recipeSectionTitle}>All Ingredients</Text>
            </View>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={styles.fullIngredientRow}>
                <Text style={styles.ingredientMeasure}>{ing.measure}</Text>
                <Text style={styles.ingredientName}>{ing.name}</Text>
              </View>
            ))}
          </View>
        )}

        {recipe.steps && recipe.steps.length > 0 && (
          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Ionicons name="reader-outline" size={22} color={COLORS.primary} />
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

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.saveRecipeBtn} onPress={toggleFavorite}>
            <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={22} color="#fff" />
            <Text style={styles.saveRecipeBtnText}>
              {isFavorited ? "Saved" : "Save Recipe"}
            </Text>
          </TouchableOpacity>
          
          {(recipe.source || recipe.youtube) && (
            <TouchableOpacity style={styles.sourceBtn} onPress={openSource}>
              <Ionicons name="open-outline" size={22} color={COLORS.primary} />
              <Text style={styles.sourceBtnText}>View Source</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const TabIcon = ({ focused, iconName, color, label }) => (
  <View style={{ alignItems: 'center', paddingTop: 4 }}>
    <View style={[
      styles.tabIconContainer,
      focused && styles.tabIconContainerActive
    ]}>
      <Ionicons name={iconName} size={22} color={color} />
    </View>
  </View>
);

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === "HomeTab") iconName = focused ? "home" : "home-outline";
          else if (route.name === "IngredientsTab") iconName = focused ? "nutrition" : "nutrition-outline";
          else if (route.name === "FavoritesTab") iconName = focused ? "heart" : "heart-outline";
          else if (route.name === "ShoppingTab") iconName = focused ? "cart" : "cart-outline";
          return <TabIcon focused={focused} iconName={iconName} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeTab} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="IngredientsTab" component={IngredientsTab} options={{ tabBarLabel: "Pantry" }} />
      <Tab.Screen name="FavoritesTab" component={FavoritesTab} options={{ tabBarLabel: "Saved" }} />
      <Tab.Screen name="ShoppingTab" component={ShoppingListTab} options={{ tabBarLabel: "List" }} />
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  headerQuestion: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerIconBtnActive: {
    borderColor: COLORS.success + '40',
    backgroundColor: COLORS.success + '10',
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  mainScanButton: {
    flex: 1.3,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  mainScanGradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  scanIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  mainScanText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
  },
  mainScanSubtext: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  secondaryActions: {
    flex: 1,
    gap: 12,
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
  scanningContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },

  // Sections
  section: {
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.3,
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ingredientChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  ingredientChipContent: {
    maxWidth: 90,
  },
  ingredientChipName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  ingredientChipQuantity: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  ingredientChipRemove: {
    marginLeft: 6,
    padding: 2,
  },
  chipRemoveIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
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
  refreshRecipesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  refreshRecipesText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },

  // Category Filters
  filterSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  filterCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  filterScroll: {
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: "#fff",
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  clearFiltersLargeBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  clearFiltersLargeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // Recipe Cards
  recipeCard: {
    width: SCREEN_WIDTH * 0.44,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recipeCardCompact: {
    width: SCREEN_WIDTH * 0.44,
  },
  recipeCardGrid: {
    width: "100%",
    marginRight: 0,
  },
  recipeImageContainer: {
    height: 135,
    position: "relative",
  },
  recipeImageContainerCompact: {
    height: 120,
  },
  recipeImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  recipeImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.border,
  },
  recipeEmojiPlaceholder: {
    fontSize: 48,
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
  matchBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
    flexWrap: "wrap",
    gap: 8,
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
  missingBadge: {
    backgroundColor: COLORS.warning + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickBadge: {
    backgroundColor: COLORS.warning + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readyBadge: {
    backgroundColor: COLORS.success + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recipeArea: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '10',
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
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: "700",
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
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
    justifyContent: "space-between",
  },
  ingredientCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ingredientCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  ingredientCardName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    textTransform: "capitalize",
    marginBottom: 4,
  },
  ingredientQuantityBadge: {
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  ingredientCardQuantity: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    textAlign: "center",
  },
  ingredientCardActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 14,
  },
  ingredientActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '10',
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionBtn: {
    backgroundColor: COLORS.error + '10',
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
  favoritesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  favoritesGridItem: {
    width: (SCREEN_WIDTH - 40 - 14) / 2,
    marginBottom: 14,
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shoppingItemChecked: {
    backgroundColor: COLORS.success + "08",
    borderColor: COLORS.success + "30",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
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
    borderRadius: 28,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "12",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
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
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSaveBtnDisabled: {
    backgroundColor: COLORS.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Recipe Detail
  recipeDetailHeader: {
    position: "relative",
    height: 300,
  },
  recipeHeroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  recipeHeroPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeHeroEmoji: {
    fontSize: 80,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
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
  navRight: {
    flexDirection: "row",
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
    padding: 20,
  },
  recipeBadges: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  categoryPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryPillTextLarge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  recipeDetailTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  matchInfo: {
    marginTop: 10,
  },
  matchBadgeLarge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
  },
  matchBadgeLargeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  missingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  recipeDetailScroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  recipeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  recipeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  recipeSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  ingredientTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  ingredientTagText: {
    fontSize: 14,
    fontWeight: "500",
  },
  fullIngredientRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ingredientMeasure: {
    width: 100,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  ingredientName: {
    flex: 1,
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
    marginTop: 2,
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
    lineHeight: 24,
  },
  actionButtons: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 8,
  },
  saveRecipeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveRecipeBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  sourceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sourceBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Tab Bar
  tabBar: {
    position: "absolute",
    backgroundColor: COLORS.card,
    borderTopWidth: 0,
    height: 85,
    paddingBottom: 24,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  tabIconContainer: {
    width: 42,
    height: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconContainerActive: {
    backgroundColor: COLORS.primary + '15',
  },
});
