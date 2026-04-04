import { useState, useEffect } from 'react';
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
  FlatList
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE = '@openai_api_key';
const SERVER_URL = 'http://localhost:5001';

const Stack = createNativeStackNavigator();

const CATEGORY_COLORS = {
  'Breakfast': { bg: '#FFF3E0', text: '#E65100', icon: '🍳' },
  'Lunch': { bg: '#E3F2FD', text: '#1565C0', icon: '🥪' },
  'Dinner': { bg: '#FCE4EC', text: '#C2185B', icon: '🍽️' },
  'Snack': { bg: '#F3E5F5', text: '#7B1FA2', icon: '🥨' },
  'Dessert': { bg: '#FFF8E1', text: '#FF8F00', icon: '🍰' },
  'Salad': { bg: '#E8F5E9', text: '#2E7D32', icon: '🥗' },
  'Soup': { bg: '#FFEBEE', text: '#C62828', icon: '🍲' },
  'Drink': { bg: '#E0F7FA', text: '#00838F', icon: '🥤' },
  'All': { bg: '#ECEFF1', text: '#455A64', icon: '📋' },
};

function HomeScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
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
      console.error('Failed to load API key:', e);
    }
  };

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, tempApiKey);
      setApiKey(tempApiKey);
      setShowApiKeyModal(false);
      Alert.alert('Success', 'API key saved successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow camera access to take photos.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const analyzeImage = async () => {
    if (!apiKey) {
      setTempApiKey('');
      setShowApiKeyModal(true);
      return;
    }

    if (!image) {
      Alert.alert('No Image', 'Please select or take a photo first.');
      return;
    }

    setAnalyzing(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          image_base64: base64,
        }),
      });

      const data = await response.json();

      if (data.error) {
        Alert.alert('Error', data.error);
      } else {
        navigation.navigate('Result', { 
          result: data.result,
          raw: data.raw,
          imageUri: image 
        });
      }
    } catch (e) {
      Alert.alert(
        'Connection Error', 
        'Could not connect to the server. Make sure the Python backend is running.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
  };

  const openApiKeySettings = () => {
    setTempApiKey(apiKey);
    setShowApiKeyModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>🍽️ Food Scanner</Text>
        <TouchableOpacity onPress={openApiKeySettings} style={styles.settingsButton}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.subtitle}>
        {apiKey ? 'API key configured ✓' : 'Tap ⚙️ to add API key'}
      </Text>

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
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderText}>Take a photo of your fridge</Text>
              <Text style={styles.placeholderSubtext}>or upload an image</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>📁 Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>📷 Camera</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <TouchableOpacity 
            style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]} 
            onPress={analyzeImage}
            disabled={analyzing}
          >
            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.analyzingText}>Scanning ingredients...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeButtonText}>🔍 Find Recipes</Text>
            )}
          </TouchableOpacity>
        )}

        {image && !analyzing && (
          <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
            <Text style={styles.clearButtonText}>Clear Image</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={showApiKeyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApiKeyModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>OpenAI API Key</Text>
            <Text style={styles.modalSubtitle}>
              Enter your OpenAI API key to analyze images. Your key is stored locally on your device.
            </Text>
            
            <TextInput
              style={styles.apiKeyInput}
              placeholder="sk-..."
              value={tempApiKey}
              onChangeText={setTempApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowApiKeyModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSaveButton, !tempApiKey && styles.modalSaveButtonDisabled]}
                onPress={saveApiKey}
                disabled={!tempApiKey}
              >
                <Text style={styles.modalSaveText}>Save</Text>
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedRecipe, setExpandedRecipe] = useState(null);

  const hasStructuredData = result && result.products && result.recipes;
  
  const products = hasStructuredData ? result.products : [];
  const recipes = hasStructuredData ? result.recipes : [];
  
  const categories = ['All', ...new Set(recipes.map(r => r.category))];
  
  const filteredRecipes = selectedCategory === 'All' 
    ? recipes 
    : recipes.filter(r => r.category === selectedCategory);

  const renderProduct = ({ item, index }) => (
    <View style={styles.productItem}>
      <View style={styles.productDot} />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.quantity && (
          <Text style={styles.productQuantity}>{item.quantity}</Text>
        )}
      </View>
    </View>
  );

  const renderRecipeCard = (recipe, index) => {
    const isExpanded = expandedRecipe === index;
    const categoryStyle = CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS['All'];
    
    return (
      <TouchableOpacity 
        key={index}
        style={styles.recipeCard}
        onPress={() => setExpandedRecipe(isExpanded ? null : index)}
        activeOpacity={0.8}
      >
        <View style={styles.recipeHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryStyle.bg }]}>
            <Text style={styles.categoryIcon}>{categoryStyle.icon}</Text>
            <Text style={[styles.categoryText, { color: categoryStyle.text }]}>
              {recipe.category}
            </Text>
          </View>
          <View style={styles.recipeMetaRow}>
            {recipe.difficulty && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{recipe.difficulty}</Text>
              </View>
            )}
            {recipe.time && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>⏱️ {recipe.time}</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text style={styles.recipeDescription}>{recipe.description}</Text>
        
        {isExpanded && (
          <View style={styles.recipeDetails}>
            <View style={styles.ingredientsSection}>
              <Text style={styles.sectionTitle}>📦 From your fridge:</Text>
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
                <Text style={styles.sectionTitle}>🛒 You might need:</Text>
                <View style={styles.ingredientTags}>
                  {recipe.additional_ingredients.map((ing, i) => (
                    <View key={i} style={[styles.ingredientTag, styles.additionalTag]}>
                      <Text style={styles.additionalTagText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            <View style={styles.stepsSection}>
              <Text style={styles.sectionTitle}>👨‍🍳 Steps:</Text>
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
        
        <Text style={styles.expandHint}>
          {isExpanded ? 'Tap to collapse' : 'Tap for details'}
        </Text>
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.resultHeaderTitle}>Results</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.resultScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Preview */}
        <View style={styles.miniImageContainer}>
          <Image source={{ uri: imageUri }} style={styles.miniImage} />
        </View>

        {hasStructuredData ? (
          <>
            {/* Products Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🥬</Text>
                <Text style={styles.sectionHeaderTitle}>Detected Products</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{products.length}</Text>
                </View>
              </View>
              
              <View style={styles.productsList}>
                {products.map((item, index) => (
                  <View key={index} style={styles.productItem}>
                    <View style={styles.productDot} />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{item.name}</Text>
                      {item.quantity && (
                        <Text style={styles.productQuantity}>{item.quantity}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Filter by category:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS['All'];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filterChip,
                        isSelected && { backgroundColor: catStyle.bg, borderColor: catStyle.text }
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={styles.filterChipIcon}>{catStyle.icon}</Text>
                      <Text style={[
                        styles.filterChipText,
                        isSelected && { color: catStyle.text, fontWeight: '600' }
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Recipes Section */}
            <View style={styles.recipesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>👨‍🍳</Text>
                <Text style={styles.sectionHeaderTitle}>Recipe Ideas</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{filteredRecipes.length}</Text>
                </View>
              </View>
              
              {filteredRecipes.map((recipe, index) => renderRecipeCard(recipe, index))}
            </View>
          </>
        ) : (
          <View style={styles.rawResultBox}>
            <Text style={styles.rawResultTitle}>Analysis Result:</Text>
            <Text style={styles.rawResultText}>{raw || 'No results'}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.newPhotoButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.newPhotoButtonText}>📷 Scan Another Photo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right'
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    position: 'relative',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    top: 60,
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 18,
    color: '#555',
    fontWeight: '500',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#2ec4b6',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9dd9d2',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  analyzingText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#e63946',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  apiKeyInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#4361ee',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#a8b8f8',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#4361ee',
    fontWeight: '600',
  },
  backButtonPlaceholder: {
    width: 70,
  },
  resultHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  resultScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  miniImageContainer: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  miniImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2ec4b6',
  },
  productsList: {
    gap: 8,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  productDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ec4b6',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  productQuantity: {
    fontSize: 13,
    color: '#888',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  filterChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  recipesSection: {
    marginBottom: 20,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  categoryIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recipeMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  expandHint: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 12,
  },
  recipeDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ingredientsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  ingredientTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ingredientTagText: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '500',
  },
  additionalTag: {
    backgroundColor: '#fff3e0',
  },
  additionalTagText: {
    fontSize: 13,
    color: '#e65100',
    fontWeight: '500',
  },
  stepsSection: {
    marginTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  rawResultBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  rawResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  rawResultText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
  },
  newPhotoButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  newPhotoButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
