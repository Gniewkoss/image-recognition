import { useState, useEffect } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const API_KEY_STORAGE = "@openai_api_key";
const SERVER_URL = "https://undecompounded-multicrystalline-natasha.ngrok-free.dev";

const Stack = createNativeStackNavigator();

const CATEGORY_CONFIG = {
  Breakfast: { color: "#FF6B35", icon: "sunny-outline", iconSet: "Ionicons" },
  Lunch: { color: "#4ECDC4", icon: "restaurant-outline", iconSet: "Ionicons" },
  Dinner: { color: "#6C5CE7", icon: "moon-outline", iconSet: "Ionicons" },
  Snack: { color: "#FDCB6E", icon: "cafe-outline", iconSet: "Ionicons" },
  Dessert: { color: "#E84393", icon: "ice-cream-outline", iconSet: "Ionicons" },
  Salad: { color: "#00B894", icon: "leaf-outline", iconSet: "Ionicons" },
  Soup: { color: "#E17055", icon: "water-outline", iconSet: "Ionicons" },
  Drink: { color: "#0984E3", icon: "wine-outline", iconSet: "Ionicons" },
  All: { color: "#636E72", icon: "grid-outline", iconSet: "Ionicons" },
};

function HomeScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const savedKey = await AsyncStorage.getItem(API_KEY_STORAGE);
      if (savedKey) {
        setApiKey(savedKey);
      }
    } catch (e) {
      console.error("Failed to load API key:", e);
    }
  };

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, tempApiKey);
      setApiKey(tempApiKey);
      setShowApiKeyModal(false);
      Alert.alert("Success", "API key saved successfully");
    } catch (e) {
      Alert.alert("Error", "Failed to save API key");
    }
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload images.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take photos.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const analyzeImage = async () => {
    if (!apiKey) {
      setTempApiKey("");
      setShowApiKeyModal(true);
      return;
    }

    if (!image) {
      Alert.alert("No Image", "Please select or take a photo first.");
      return;
    }

    setAnalyzing(true);

    try {
      if (!imageBase64) {
        Alert.alert("Error", "Image data not available. Please retake the photo.");
        setAnalyzing(false);
        return;
      }

      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          api_key: apiKey,
          image_base64: imageBase64,
        }),
      });

      const data = await response.json();

      if (data.error) {
        Alert.alert("Error", data.error);
      } else {
        navigation.navigate("Result", {
          result: data.result,
          raw: data.raw,
          imageUri: image,
        });
      }
    } catch (e) {
      console.error("Connection error:", e);
      Alert.alert(
        "Connection Error",
        `Error: ${e.message || "Unknown error"}. Make sure the Python backend is running.`,
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setImageBase64(null);
  };

  const openApiKeySettings = () => {
    setTempApiKey(apiKey);
    setShowApiKeyModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="scan" size={24} color="#fff" />
          </View>
          <Text style={styles.title}>FoodLens</Text>
        </View>
        <TouchableOpacity
          onPress={openApiKeySettings}
          style={styles.settingsButton}
        >
          <Feather name="settings" size={22} color="#1a1a2e" />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            apiKey ? styles.statusActive : styles.statusInactive,
          ]}
        />
        <Text style={styles.statusText}>
          {apiKey ? "API Connected" : "API Key Required"}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIconContainer}>
                <Ionicons name="image-outline" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.placeholderText}>
                Scan your fridge or pantry
              </Text>
              <Text style={styles.placeholderSubtext}>
                Get instant recipe suggestions
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Feather name="folder" size={20} color="#fff" />
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Feather name="camera" size={20} color="#fff" />
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <TouchableOpacity
            style={[
              styles.analyzeButton,
              analyzing && styles.analyzeButtonDisabled,
            ]}
            onPress={analyzeImage}
            disabled={analyzing}
          >
            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.analyzingText}>
                  Analyzing ingredients...
                </Text>
              </View>
            ) : (
              <View style={styles.analyzeContent}>
                <Ionicons name="sparkles" size={22} color="#fff" />
                <Text style={styles.analyzeButtonText}>Discover Recipes</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {image && !analyzing && (
          <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
            <Feather name="x" size={18} color="#ef4444" />
            <Text style={styles.clearButtonText}>Remove Image</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={showApiKeyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApiKeyModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Feather name="key" size={24} color="#6366f1" />
              </View>
              <Text style={styles.modalTitle}>API Configuration</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter your OpenAI API key to enable image analysis. Your key is
              stored securely on your device.
            </Text>

            <View style={styles.inputContainer}>
              <Feather
                name="lock"
                size={18}
                color="#94a3b8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.apiKeyInput}
                placeholder="sk-..."
                placeholderTextColor="#94a3b8"
                value={tempApiKey}
                onChangeText={setTempApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowApiKeyModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  !tempApiKey && styles.modalSaveButtonDisabled,
                ]}
                onPress={saveApiKey}
                disabled={!tempApiKey}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.modalSaveText}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ResultScreen({ route, navigation }) {
  const { result, raw, imageUri } = route.params;
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  
  const hasStructuredData = result && result.products && result.recipes;
  
  const [products, setProducts] = useState(hasStructuredData ? result.products : []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState("");
  
  const recipes = hasStructuredData ? result.recipes : [];
  
  const addProduct = () => {
    if (!newProductName.trim()) return;
    setProducts([...products, { 
      name: newProductName.trim(), 
      quantity: newProductQuantity.trim() || null 
    }]);
    setNewProductName("");
    setNewProductQuantity("");
    setShowAddModal(false);
  };
  
  const deleteProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };
  
  const startEditProduct = (index) => {
    setEditingProduct(index);
    setNewProductName(products[index].name);
    setNewProductQuantity(products[index].quantity || "");
    setShowEditModal(true);
  };
  
  const saveEditProduct = () => {
    if (editingProduct === null || !newProductName.trim()) return;
    const updated = [...products];
    updated[editingProduct] = {
      ...updated[editingProduct],
      name: newProductName.trim(),
      quantity: newProductQuantity.trim() || null
    };
    setProducts(updated);
    setEditingProduct(null);
    setNewProductName("");
    setNewProductQuantity("");
    setShowEditModal(false);
  };

  const categories = ["All", ...new Set(recipes.map((r) => r.category))];

  const filteredRecipes =
    selectedCategory === "All"
      ? recipes
      : recipes.filter((r) => r.category === selectedCategory);

  const renderRecipeCard = (recipe, index) => {
    const isExpanded = expandedRecipe === index;
    const categoryConfig =
      CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG["All"];

    return (
      <TouchableOpacity
        key={index}
        style={[styles.recipeCard, isExpanded && styles.recipeCardExpanded]}
        onPress={() => setExpandedRecipe(isExpanded ? null : index)}
        activeOpacity={0.7}
      >
        <View style={styles.recipeHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: `${categoryConfig.color}15` },
            ]}
          >
            <Ionicons
              name={categoryConfig.icon}
              size={14}
              color={categoryConfig.color}
            />
            <Text
              style={[styles.categoryText, { color: categoryConfig.color }]}
            >
              {recipe.category}
            </Text>
          </View>
          <View style={styles.recipeMetaRow}>
            {recipe.difficulty && (
              <View style={styles.metaBadge}>
                <Ionicons
                  name="speedometer-outline"
                  size={12}
                  color="#64748b"
                />
                <Text style={styles.metaText}>{recipe.difficulty}</Text>
              </View>
            )}
            {recipe.time && (
              <View style={styles.metaBadge}>
                <Ionicons name="time-outline" size={12} color="#64748b" />
                <Text style={styles.metaText}>{recipe.time}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text
          style={styles.recipeDescription}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {recipe.description}
        </Text>

        {isExpanded && (
          <View style={styles.recipeDetails}>
            <View style={styles.ingredientsSection}>
              <View style={styles.detailHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.detailTitle}>Available Ingredients</Text>
              </View>
              <View style={styles.ingredientTags}>
                {recipe.ingredients_from_image?.map((ing, i) => (
                  <View key={i} style={styles.ingredientTag}>
                    <Text style={styles.ingredientTagText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>

            {recipe.additional_ingredients?.length > 0 && (
              <View style={styles.ingredientsSection}>
                <View style={styles.detailHeader}>
                  <Ionicons name="cart-outline" size={18} color="#f59e0b" />
                  <Text style={styles.detailTitle}>Shopping List</Text>
                </View>
                <View style={styles.ingredientTags}>
                  {recipe.additional_ingredients.map((ing, i) => (
                    <View
                      key={i}
                      style={[styles.ingredientTag, styles.additionalTag]}
                    >
                      <Text style={styles.additionalTagText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.stepsSection}>
              <View style={styles.detailHeader}>
                <Ionicons name="list" size={18} color="#6366f1" />
                <Text style={styles.detailTitle}>Instructions</Text>
              </View>
              {recipe.steps?.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.expandRow}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#94a3b8"
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.resultHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.resultHeaderTitle}>Analysis Results</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.resultScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.miniImageContainer}>
          <Image source={{ uri: imageUri }} style={styles.miniImage} />
          <View style={styles.imageOverlay}>
            <View style={styles.imageOverlayContent}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.imageOverlayText}>Scanned</Text>
            </View>
          </View>
        </View>

        {hasStructuredData ? (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <MaterialCommunityIcons
                    name="fridge-outline"
                    size={20}
                    color="#10b981"
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>Detected Items</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{products.length}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.addProductButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.productsList}>
                {products.map((item, index) => (
                  <View key={index} style={styles.productItem}>
                    <View style={styles.productIcon}>
                      <Ionicons
                        name="nutrition-outline"
                        size={16}
                        color="#64748b"
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.productInfo}
                      onPress={() => startEditProduct(index)}
                    >
                      <Text style={styles.productName}>{item.name}</Text>
                      {item.quantity && (
                        <Text style={styles.productQuantity}>
                          {item.quantity}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.productActions}>
                      <TouchableOpacity 
                        style={styles.productEditButton}
                        onPress={() => startEditProduct(index)}
                      >
                        <Feather name="edit-2" size={14} color="#6366f1" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.productDeleteButton}
                        onPress={() => deleteProduct(index)}
                      >
                        <Feather name="trash-2" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Categories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const catConfig =
                    CATEGORY_CONFIG[cat] || CATEGORY_CONFIG["All"];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filterChip,
                        isSelected && {
                          backgroundColor: catConfig.color,
                          borderColor: catConfig.color,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Ionicons
                        name={catConfig.icon}
                        size={16}
                        color={isSelected ? "#fff" : catConfig.color}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          isSelected && { color: "#fff" },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.recipesSection}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#fef3c7" },
                  ]}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={20}
                    color="#f59e0b"
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>
                  Recipe Suggestions
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{filteredRecipes.length}</Text>
                </View>
              </View>

              {filteredRecipes.map((recipe, index) =>
                renderRecipeCard(recipe, index),
              )}
            </View>
          </>
        ) : (
          <View style={styles.rawResultBox}>
            <View style={styles.rawResultHeader}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#64748b"
              />
              <Text style={styles.rawResultTitle}>Analysis Output</Text>
            </View>
            <Text style={styles.rawResultText}>
              {raw || "No results available"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.newPhotoButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.newPhotoButtonText}>New Scan</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Product Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: "#d1fae5" }]}>
                <Ionicons name="add-circle-outline" size={24} color="#10b981" />
              </View>
              <Text style={styles.modalTitle}>Add Product</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Feather name="tag" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.apiKeyInput}
                placeholder="Product name"
                placeholderTextColor="#94a3b8"
                value={newProductName}
                onChangeText={setNewProductName}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Feather name="hash" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.apiKeyInput}
                placeholder="Quantity (optional)"
                placeholderTextColor="#94a3b8"
                value={newProductQuantity}
                onChangeText={setNewProductQuantity}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewProductName("");
                  setNewProductQuantity("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, !newProductName.trim() && styles.modalSaveButtonDisabled]}
                onPress={addProduct}
                disabled={!newProductName.trim()}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: "#e0e7ff" }]}>
                <Feather name="edit-2" size={24} color="#6366f1" />
              </View>
              <Text style={styles.modalTitle}>Edit Product</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Feather name="tag" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.apiKeyInput}
                placeholder="Product name"
                placeholderTextColor="#94a3b8"
                value={newProductName}
                onChangeText={setNewProductName}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Feather name="hash" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.apiKeyInput}
                placeholder="Quantity (optional)"
                placeholderTextColor="#94a3b8"
                value={newProductQuantity}
                onChangeText={setNewProductQuantity}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setNewProductName("");
                  setNewProductQuantity("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, !newProductName.trim() && styles.modalSaveButtonDisabled]}
                onPress={saveEditProduct}
                disabled={!newProductName.trim()}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: "#10b981",
  },
  statusInactive: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  placeholderIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 18,
    color: "#334155",
    fontWeight: "600",
  },
  placeholderSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 12,
  },
  analyzeButtonDisabled: {
    backgroundColor: "#a5b4fc",
  },
  analyzeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  analyzingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  analyzingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  clearButtonText: {
    color: "#ef4444",
    fontSize: 15,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 21,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  apiKeyInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#0f172a",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  modalSaveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#6366f1",
  },
  modalSaveButtonDisabled: {
    backgroundColor: "#c7d2fe",
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonPlaceholder: {
    width: 44,
  },
  resultHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  resultScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  miniImageContainer: {
    width: "100%",
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
  },
  miniImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
  },
  imageOverlayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageOverlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#d1fae5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  countBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  productsList: {
    gap: 8,
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  productIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
  },
  productQuantity: {
    fontSize: 13,
    color: "#94a3b8",
  },
  productActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  productEditButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  productDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
  },
  addProductButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 15,
    color: "#64748b",
    marginBottom: 12,
    fontWeight: "600",
  },
  filterScroll: {
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  recipesSection: {
    marginBottom: 20,
  },
  recipeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  recipeCardExpanded: {
    shadowOpacity: 0.08,
  },
  recipeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  recipeMetaRow: {
    flexDirection: "row",
    gap: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  recipeName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  recipeDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 21,
  },
  expandRow: {
    alignItems: "center",
    marginTop: 12,
  },
  recipeDetails: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  ingredientsSection: {
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  ingredientTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientTag: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ingredientTagText: {
    fontSize: 13,
    color: "#047857",
    fontWeight: "500",
  },
  additionalTag: {
    backgroundColor: "#fef3c7",
  },
  additionalTagText: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "500",
  },
  stepsSection: {
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },
  rawResultBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  rawResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  rawResultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
  },
  rawResultText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 22,
  },
  newPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  newPhotoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
