from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import json
import re
import requests
from collections import defaultdict

app = Flask(__name__)
CORS(app)

THEMEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"

# Built-in simple recipes - each with unique emoji, no shared images
SIMPLE_RECIPES = [
    {
        "id": "simple_001", "name": "Classic Scrambled Eggs", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🍳", "source": "", "youtube": "",
        "ingredients": [
            {"name": "eggs", "measure": "3"}, {"name": "butter", "measure": "1 tbsp"},
            {"name": "salt", "measure": "pinch"}, {"name": "pepper", "measure": "pinch"}
        ],
        "steps": ["Crack eggs into a bowl and beat with a fork.", "Heat butter in a non-stick pan over medium-low heat.", "Pour in eggs and let sit for 20 seconds.", "Gently push eggs from edges to center, forming soft curds.", "Remove from heat while slightly wet.", "Season and serve immediately."]
    },
    {
        "id": "simple_002", "name": "Grilled Cheese Sandwich", "category": "Lunch",
        "area": "American", "image": None, "emoji": "🧀", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "cheese", "measure": "2 slices"},
            {"name": "butter", "measure": "2 tbsp"}
        ],
        "steps": ["Butter one side of each bread slice.", "Heat pan over medium heat.", "Place one slice butter-side down.", "Add cheese slices on top.", "Top with second bread slice, butter-side up.", "Cook until golden, flip, cook other side."]
    },
    {
        "id": "simple_003", "name": "Ham and Cheese Sandwich", "category": "Lunch",
        "area": "American", "image": None, "emoji": "🥪", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "ham", "measure": "3 slices"},
            {"name": "cheese", "measure": "2 slices"}, {"name": "butter", "measure": "1 tbsp"}
        ],
        "steps": ["Butter one side of each bread slice.", "Layer ham and cheese on unbuttered side.", "Top with second slice.", "Cut diagonally and serve."]
    },
    {
        "id": "simple_004", "name": "Buttered Toast with Jam", "category": "Breakfast",
        "area": "British", "image": None, "emoji": "🍞", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "butter", "measure": "2 tbsp"},
            {"name": "jam", "measure": "2 tbsp"}
        ],
        "steps": ["Toast bread until golden brown.", "Spread butter while still warm.", "Add jam on top.", "Serve immediately."]
    },
    {
        "id": "simple_005", "name": "Simple Omelette", "category": "Breakfast",
        "area": "French", "image": None, "emoji": "🥚", "source": "", "youtube": "",
        "ingredients": [
            {"name": "eggs", "measure": "3"}, {"name": "butter", "measure": "1 tbsp"},
            {"name": "salt", "measure": "pinch"}, {"name": "pepper", "measure": "pinch"}
        ],
        "steps": ["Beat eggs with salt and pepper.", "Heat butter in a non-stick pan.", "Pour in eggs and let set for 30 seconds.", "Lift edges and tilt pan to let uncooked egg flow underneath.", "When almost set, fold in half.", "Slide onto plate and serve."]
    },
    {
        "id": "simple_006", "name": "Cheese Omelette", "category": "Breakfast",
        "area": "French", "image": None, "emoji": "🧈", "source": "", "youtube": "",
        "ingredients": [
            {"name": "eggs", "measure": "3"}, {"name": "cheese", "measure": "50g"},
            {"name": "butter", "measure": "1 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Beat eggs with salt.", "Heat butter in a non-stick pan.", "Pour in eggs and cook until almost set.", "Add grated cheese to one half.", "Fold omelette in half.", "Cook 30 more seconds until cheese melts."]
    },
    {
        "id": "simple_007", "name": "Avocado Toast", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🥑", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "avocado", "measure": "1"},
            {"name": "salt", "measure": "pinch"}, {"name": "lemon juice", "measure": "1 tsp"}
        ],
        "steps": ["Toast bread until golden.", "Cut avocado in half, remove pit, scoop out flesh.", "Mash avocado with fork, add lemon juice and salt.", "Spread on toast.", "Optional: top with red pepper flakes."]
    },
    {
        "id": "simple_008", "name": "Fried Egg Sandwich", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🍔", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "eggs", "measure": "1"},
            {"name": "butter", "measure": "1 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Toast bread lightly.", "Fry egg in butter until whites are set.", "Place egg on one slice of bread.", "Season with salt.", "Top with second slice and serve."]
    },
    {
        "id": "simple_009", "name": "Tomato Sandwich", "category": "Lunch",
        "area": "American", "image": None, "emoji": "🍅", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "tomato", "measure": "1"},
            {"name": "mayonnaise", "measure": "1 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Slice tomato into thick rounds.", "Spread mayonnaise on both bread slices.", "Layer tomato slices on one slice.", "Season generously with salt.", "Top with second slice."]
    },
    {
        "id": "simple_010", "name": "BLT Sandwich", "category": "Lunch",
        "area": "American", "image": None, "emoji": "🥓", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "bacon", "measure": "4 strips"},
            {"name": "lettuce", "measure": "2 leaves"}, {"name": "tomato", "measure": "1"},
            {"name": "mayonnaise", "measure": "1 tbsp"}
        ],
        "steps": ["Cook bacon until crispy, drain on paper towels.", "Toast bread.", "Spread mayonnaise on both slices.", "Layer lettuce, tomato slices, and bacon.", "Top with second slice and cut in half."]
    },
    {
        "id": "simple_011", "name": "Banana Smoothie", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🍌", "source": "", "youtube": "",
        "ingredients": [
            {"name": "banana", "measure": "1"}, {"name": "milk", "measure": "1 cup"},
            {"name": "honey", "measure": "1 tbsp"}
        ],
        "steps": ["Peel and slice banana.", "Add banana, milk, and honey to blender.", "Blend until smooth.", "Pour into glass and serve cold."]
    },
    {
        "id": "simple_012", "name": "Fruit Yogurt Bowl", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🥣", "source": "", "youtube": "",
        "ingredients": [
            {"name": "yogurt", "measure": "1 cup"}, {"name": "banana", "measure": "1"},
            {"name": "honey", "measure": "1 tbsp"}
        ],
        "steps": ["Add yogurt to a bowl.", "Slice banana and arrange on top.", "Drizzle with honey.", "Add any other available fruits."]
    },
    {
        "id": "simple_013", "name": "Peanut Butter Sandwich", "category": "Snack",
        "area": "American", "image": None, "emoji": "🥜", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "peanut butter", "measure": "2 tbsp"}
        ],
        "steps": ["Spread peanut butter on one slice of bread.", "Top with second slice.", "Cut in half if desired."]
    },
    {
        "id": "simple_014", "name": "PB&J Sandwich", "category": "Snack",
        "area": "American", "image": None, "emoji": "🍇", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "peanut butter", "measure": "2 tbsp"},
            {"name": "jam", "measure": "2 tbsp"}
        ],
        "steps": ["Spread peanut butter on one slice.", "Spread jam on the other slice.", "Press together and cut diagonally."]
    },
    {
        "id": "simple_015", "name": "Simple Pasta with Butter", "category": "Dinner",
        "area": "Italian", "image": None, "emoji": "🍝", "source": "", "youtube": "",
        "ingredients": [
            {"name": "pasta", "measure": "200g"}, {"name": "butter", "measure": "3 tbsp"},
            {"name": "parmesan", "measure": "50g"}, {"name": "salt", "measure": "to taste"}
        ],
        "steps": ["Cook pasta according to package directions.", "Drain, reserving 1/2 cup pasta water.", "Toss hot pasta with butter until melted.", "Add parmesan and toss, adding pasta water if needed.", "Season with salt and serve."]
    },
    {
        "id": "simple_016", "name": "Garlic Butter Pasta", "category": "Dinner",
        "area": "Italian", "image": None, "emoji": "🧄", "source": "", "youtube": "",
        "ingredients": [
            {"name": "pasta", "measure": "200g"}, {"name": "butter", "measure": "3 tbsp"},
            {"name": "garlic", "measure": "4 cloves"}, {"name": "parsley", "measure": "2 tbsp"}
        ],
        "steps": ["Cook pasta according to package directions.", "Mince garlic and sauté in butter until fragrant.", "Toss drained pasta with garlic butter.", "Add chopped parsley and salt.", "Serve hot."]
    },
    {
        "id": "simple_017", "name": "Quick Tomato Pasta", "category": "Dinner",
        "area": "Italian", "image": None, "emoji": "🫕", "source": "", "youtube": "",
        "ingredients": [
            {"name": "pasta", "measure": "200g"}, {"name": "tomatoes", "measure": "3"},
            {"name": "garlic", "measure": "2 cloves"}, {"name": "olive oil", "measure": "2 tbsp"},
            {"name": "basil", "measure": "handful"}
        ],
        "steps": ["Cook pasta according to package directions.", "Dice tomatoes, mince garlic.", "Sauté garlic in olive oil for 1 minute.", "Add tomatoes, cook 5 minutes until soft.", "Toss with drained pasta and fresh basil."]
    },
    {
        "id": "simple_018", "name": "Egg Fried Rice", "category": "Dinner",
        "area": "Chinese", "image": None, "emoji": "🍚", "source": "", "youtube": "",
        "ingredients": [
            {"name": "rice", "measure": "2 cups cooked"}, {"name": "eggs", "measure": "2"},
            {"name": "soy sauce", "measure": "2 tbsp"}, {"name": "oil", "measure": "2 tbsp"},
            {"name": "green onion", "measure": "2"}
        ],
        "steps": ["Heat oil in a wok over high heat.", "Beat eggs and scramble in the hot oil.", "Add cold rice and stir-fry for 3-4 minutes.", "Add soy sauce and toss to combine.", "Top with sliced green onions."]
    },
    {
        "id": "simple_019", "name": "Cheese Quesadilla", "category": "Snack",
        "area": "Mexican", "image": None, "emoji": "🌮", "source": "", "youtube": "",
        "ingredients": [
            {"name": "tortilla", "measure": "2"}, {"name": "cheese", "measure": "100g"},
            {"name": "butter", "measure": "1 tbsp"}
        ],
        "steps": ["Heat a pan over medium heat.", "Place one tortilla in the pan.", "Spread shredded cheese evenly.", "Top with second tortilla.", "Cook until bottom is golden, flip.", "Cook other side until cheese melts, cut into wedges."]
    },
    {
        "id": "simple_020", "name": "Tuna Sandwich", "category": "Lunch",
        "area": "American", "image": None, "emoji": "🐟", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "tuna", "measure": "1 can"},
            {"name": "mayonnaise", "measure": "2 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Drain tuna and place in a bowl.", "Mix with mayonnaise and salt.", "Spread on one slice of bread.", "Top with second slice and cut."]
    },
    {
        "id": "simple_021", "name": "Caprese Salad", "category": "Salad",
        "area": "Italian", "image": None, "emoji": "🍃", "source": "", "youtube": "",
        "ingredients": [
            {"name": "tomato", "measure": "2"}, {"name": "mozzarella", "measure": "150g"},
            {"name": "basil", "measure": "handful"}, {"name": "olive oil", "measure": "2 tbsp"}
        ],
        "steps": ["Slice tomatoes and mozzarella.", "Arrange alternating on a plate.", "Tuck basil leaves between slices.", "Drizzle with olive oil and season."]
    },
    {
        "id": "simple_022", "name": "Simple Green Salad", "category": "Salad",
        "area": "American", "image": None, "emoji": "🥗", "source": "", "youtube": "",
        "ingredients": [
            {"name": "lettuce", "measure": "1 head"}, {"name": "olive oil", "measure": "2 tbsp"},
            {"name": "lemon juice", "measure": "1 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Wash and tear lettuce into pieces.", "Whisk olive oil, lemon juice, and salt.", "Toss lettuce with dressing.", "Serve immediately."]
    },
    {
        "id": "simple_023", "name": "Cucumber Salad", "category": "Salad",
        "area": "American", "image": None, "emoji": "🥒", "source": "", "youtube": "",
        "ingredients": [
            {"name": "cucumber", "measure": "2"}, {"name": "yogurt", "measure": "1/2 cup"},
            {"name": "garlic", "measure": "1 clove"}, {"name": "dill", "measure": "1 tbsp"}
        ],
        "steps": ["Slice cucumbers thinly.", "Mix yogurt with minced garlic and dill.", "Toss cucumbers with dressing.", "Chill for 10 minutes before serving."]
    },
    {
        "id": "simple_024", "name": "Boiled Eggs", "category": "Breakfast",
        "area": "Universal", "image": None, "emoji": "🥚", "source": "", "youtube": "",
        "ingredients": [
            {"name": "eggs", "measure": "4"}, {"name": "salt", "measure": "to taste"}
        ],
        "steps": ["Place eggs in a pot, cover with cold water.", "Bring to a boil over high heat.", "For soft boiled: remove after 6 minutes.", "For hard boiled: cook 10-12 minutes.", "Transfer to ice water.", "Peel and season with salt."]
    },
    {
        "id": "simple_025", "name": "French Toast", "category": "Breakfast",
        "area": "French", "image": None, "emoji": "🥞", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "4 slices"}, {"name": "eggs", "measure": "2"},
            {"name": "milk", "measure": "1/4 cup"}, {"name": "butter", "measure": "2 tbsp"},
            {"name": "sugar", "measure": "1 tbsp"}
        ],
        "steps": ["Whisk eggs, milk, and sugar together.", "Heat butter in a pan over medium heat.", "Dip bread slices in egg mixture.", "Cook until golden brown on each side.", "Serve with syrup or powdered sugar."]
    },
    {
        "id": "simple_026", "name": "Microwave Mug Omelette", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "☕", "source": "", "youtube": "",
        "ingredients": [
            {"name": "eggs", "measure": "2"}, {"name": "cheese", "measure": "2 tbsp"},
            {"name": "milk", "measure": "1 tbsp"}, {"name": "salt", "measure": "pinch"}
        ],
        "steps": ["Spray a mug with cooking spray.", "Crack eggs into mug, add milk and salt.", "Beat with a fork.", "Microwave 1 minute, stir.", "Microwave 30-60 more seconds until set.", "Top with cheese and serve."]
    },
    {
        "id": "simple_027", "name": "Banana on Toast", "category": "Breakfast",
        "area": "American", "image": None, "emoji": "🍯", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "banana", "measure": "1"},
            {"name": "honey", "measure": "1 tbsp"}
        ],
        "steps": ["Toast bread until golden.", "Slice banana.", "Arrange banana slices on toast.", "Drizzle with honey."]
    },
    {
        "id": "simple_028", "name": "Simple Rice Bowl", "category": "Dinner",
        "area": "Asian", "image": None, "emoji": "🍜", "source": "", "youtube": "",
        "ingredients": [
            {"name": "rice", "measure": "1 cup"}, {"name": "eggs", "measure": "1"},
            {"name": "soy sauce", "measure": "1 tbsp"}, {"name": "sesame oil", "measure": "1 tsp"}
        ],
        "steps": ["Cook rice according to package directions.", "Fry egg sunny-side up.", "Place rice in bowl, top with egg.", "Drizzle with soy sauce and sesame oil."]
    },
    {
        "id": "simple_029", "name": "Cheese Toast", "category": "Snack",
        "area": "British", "image": None, "emoji": "🫓", "source": "", "youtube": "",
        "ingredients": [
            {"name": "bread", "measure": "2 slices"}, {"name": "cheese", "measure": "50g"}
        ],
        "steps": ["Preheat broiler/grill.", "Place bread on baking sheet.", "Top with sliced or grated cheese.", "Broil until cheese is melted and bubbly."]
    },
    {
        "id": "simple_030", "name": "Honey Lemon Water", "category": "Drink",
        "area": "Universal", "image": None, "emoji": "🍋", "source": "", "youtube": "",
        "ingredients": [
            {"name": "water", "measure": "1 cup"}, {"name": "lemon", "measure": "1/2"},
            {"name": "honey", "measure": "1 tbsp"}
        ],
        "steps": ["Heat water until warm (not boiling).", "Squeeze lemon juice into water.", "Stir in honey until dissolved.", "Serve warm or over ice."]
    },
]

INGREDIENT_EXTRACTION_PROMPT = """Analyze this image of food items or a fridge. 
Extract and normalize all visible food ingredients.

Return ONLY a JSON object with this structure:
{
  "ingredients": [
    {"name": "ingredient name (normalized, lowercase)", "quantity": "amount if visible"}
  ]
}

Rules:
- Only include food items you can actually see
- Normalize names (e.g., "chicken breast" not "raw chicken breast pieces")
- Use common cooking terms (e.g., "tomato" not "roma tomato")
- Keep names simple and searchable
- Return ONLY valid JSON, no markdown or explanation"""

INGREDIENT_SYNONYMS = {
    "egg": ["eggs", "egg"],
    "eggs": ["eggs", "egg"],
    "cheese": ["cheese", "cheddar", "mozzarella", "parmesan", "swiss"],
    "bread": ["bread", "toast", "sliced bread", "white bread", "wheat bread"],
    "milk": ["milk", "whole milk", "skim milk"],
    "butter": ["butter", "unsalted butter", "salted butter"],
    "chicken": ["chicken", "chicken breast", "chicken thigh", "chicken leg"],
    "tomato": ["tomato", "tomatoes", "cherry tomatoes"],
    "lettuce": ["lettuce", "romaine", "iceberg", "salad greens"],
    "onion": ["onion", "onions", "yellow onion", "red onion"],
    "garlic": ["garlic", "garlic cloves"],
    "pasta": ["pasta", "spaghetti", "penne", "macaroni", "noodles"],
    "rice": ["rice", "white rice", "brown rice", "cooked rice"],
    "ham": ["ham", "sliced ham", "deli ham"],
    "bacon": ["bacon", "bacon strips"],
    "banana": ["banana", "bananas"],
    "apple": ["apple", "apples"],
    "yogurt": ["yogurt", "greek yogurt", "plain yogurt"],
    "oil": ["oil", "olive oil", "vegetable oil", "cooking oil"],
}


def normalize_ingredient(name):
    """Normalize ingredient name for better matching."""
    name = name.lower().strip()
    remove_words = ['fresh', 'raw', 'cooked', 'dried', 'frozen', 'canned', 'sliced', 'diced', 'chopped', 'minced', 'whole', 'large', 'small', 'medium', 'organic']
    words = name.split()
    words = [w for w in words if w not in remove_words]
    return ' '.join(words) if words else name


def ingredients_match(recipe_ing, user_ingredients):
    """Check if a recipe ingredient matches any user ingredient."""
    recipe_ing_norm = normalize_ingredient(recipe_ing)
    recipe_words = set(recipe_ing_norm.split())
    
    for user_ing in user_ingredients:
        user_norm = normalize_ingredient(user_ing['name'])
        user_words = set(user_norm.split())
        
        if recipe_ing_norm == user_norm:
            return True
        if recipe_words & user_words:
            return True
        
        for key, synonyms in INGREDIENT_SYNONYMS.items():
            if recipe_ing_norm in synonyms or any(w in synonyms for w in recipe_words):
                if user_norm in synonyms or any(w in synonyms for w in user_words):
                    return True
    
    return False


def calculate_match(recipe_ingredients, user_ingredients):
    """Calculate how well a recipe matches user's ingredients."""
    matched = []
    missing = []
    pantry_items = {'salt', 'pepper', 'water', 'oil', 'olive oil', 'sugar', 'flour'}
    
    for ing in recipe_ingredients:
        ing_name = ing['name'] if isinstance(ing, dict) else ing
        ing_norm = normalize_ingredient(ing_name)
        
        if ingredients_match(ing_name, user_ingredients):
            matched.append(ing_name)
        elif ing_norm in pantry_items:
            matched.append(ing_name)
        else:
            missing.append(ing_name)
    
    total = len(recipe_ingredients)
    match_count = len(matched)
    match_percent = round((match_count / total) * 100) if total > 0 else 0
    
    return {
        'match_percent': match_percent,
        'matched_count': match_count,
        'missing_count': len(missing),
        'matched_ingredients': matched,
        'missing_ingredients': missing
    }


def extract_meal_ingredients(meal):
    """Extract ingredients from a TheMealDB meal object."""
    ingredients = []
    for i in range(1, 21):
        ing = meal.get(f'strIngredient{i}')
        measure = meal.get(f'strMeasure{i}')
        if ing and ing.strip():
            ingredients.append({'name': ing.strip(), 'measure': measure.strip() if measure else ''})
    return ingredients


def extract_meal_steps(meal):
    """Extract cooking steps from instructions."""
    instructions = meal.get('strInstructions', '')
    if not instructions:
        return []
    
    steps = re.split(r'\r\n|\n\n|\. (?=[A-Z])', instructions)
    steps = [s.strip() for s in steps if s.strip() and len(s.strip()) > 10]
    
    result = []
    for step in steps:
        step = re.sub(r'^[\d]+[\.\)]\s*', '', step)
        if step:
            result.append(step)
    
    return result[:12]


def fetch_recipes_by_ingredient(ingredient):
    """Fetch recipes from TheMealDB by ingredient."""
    try:
        url = f"{THEMEALDB_BASE}/filter.php?i={ingredient}"
        response = requests.get(url, timeout=10)
        data = response.json()
        return data.get('meals') or []
    except Exception as e:
        print(f"Error fetching recipes for {ingredient}: {e}")
        return []


def fetch_meal_details(meal_id):
    """Fetch full meal details from TheMealDB."""
    try:
        url = f"{THEMEALDB_BASE}/lookup.php?i={meal_id}"
        response = requests.get(url, timeout=10)
        data = response.json()
        meals = data.get('meals')
        return meals[0] if meals else None
    except Exception as e:
        print(f"Error fetching meal {meal_id}: {e}")
        return None


def get_simple_recipes_matches(user_ingredients):
    """Get matching simple recipes from built-in database."""
    results = []
    
    for recipe in SIMPLE_RECIPES:
        match_info = calculate_match(recipe['ingredients'], user_ingredients)
        
        if match_info['match_percent'] >= 30:
            recipe_copy = recipe.copy()
            recipe_copy.update(match_info)
            results.append(recipe_copy)
    
    return results


@app.route('/analyze', methods=['POST'])
def analyze_image():
    """Analyze image and extract ingredients using AI."""
    data = request.json
    
    api_key = data.get('api_key')
    image_base64 = data.get('image_base64')
    
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    if not image_base64:
        return jsonify({'error': 'Image is required'}), 400
    
    try:
        client = OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": INGREDIENT_EXTRACTION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                ],
            }],
            max_tokens=1000,
        )
        
        result_text = response.choices[0].message.content
        
        usage = response.usage
        if usage:
            print(f"\n=== INGREDIENT EXTRACTION ===")
            print(f"Tokens: {usage.total_tokens}")
            print(f"=============================\n")
        
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result_text = json_match.group()
        
        try:
            parsed_result = json.loads(result_text)
            return jsonify({'ingredients': parsed_result.get('ingredients', [])})
        except json.JSONDecodeError:
            return jsonify({'ingredients': [], 'error': 'Failed to parse', 'raw': result_text})
    
    except Exception as e:
        print(f"Error in analyze: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/search-recipes', methods=['POST'])
def search_recipes():
    """Search for recipes from multiple sources based on ingredients."""
    data = request.json
    ingredients = data.get('ingredients', [])
    
    if not ingredients:
        return jsonify({'error': 'Ingredients are required'}), 400
    
    try:
        all_recipes = []
        seen_ids = set()
        
        # 1. Get simple recipes from built-in database
        simple_matches = get_simple_recipes_matches(ingredients)
        for recipe in simple_matches:
            all_recipes.append(recipe)
            seen_ids.add(recipe['id'])
        
        print(f"Found {len(simple_matches)} simple recipe matches")
        
        # 2. Fetch from TheMealDB
        all_meal_ids = defaultdict(int)
        search_ingredients = [i['name'] for i in ingredients[:10]]
        
        for ing in search_ingredients:
            search_term = normalize_ingredient(ing).split()[0]
            meals = fetch_recipes_by_ingredient(search_term)
            for meal in meals:
                all_meal_ids[meal['idMeal']] += 1
        
        sorted_meal_ids = sorted(all_meal_ids.keys(), key=lambda x: all_meal_ids[x], reverse=True)
        print(f"Found {len(sorted_meal_ids)} TheMealDB recipes")
        
        for meal_id in sorted_meal_ids[:20]:
            if meal_id in seen_ids:
                continue
                
            meal = fetch_meal_details(meal_id)
            if not meal:
                continue
            
            recipe_ingredients = extract_meal_ingredients(meal)
            match_info = calculate_match(recipe_ingredients, ingredients)
            
            if match_info['match_percent'] < 20 or match_info['missing_count'] > 8:
                continue
            
            recipe = {
                'id': meal['idMeal'],
                'name': meal['strMeal'],
                'category': meal.get('strCategory', 'Main'),
                'area': meal.get('strArea', ''),
                'image': meal.get('strMealThumb', ''),
                'source': meal.get('strSource', ''),
                'youtube': meal.get('strYoutube', ''),
                'ingredients': recipe_ingredients,
                'steps': extract_meal_steps(meal),
                **match_info
            }
            all_recipes.append(recipe)
            seen_ids.add(meal_id)
        
        all_recipes.sort(key=lambda x: (x['missing_count'], -x['match_percent']))
        
        categorized = {
            'Quick & Easy': [],
            'Best Matches': [],
            'Good Options': [],
            'More Ideas': []
        }
        
        for recipe in all_recipes:
            if recipe['id'].startswith('simple_') and recipe['missing_count'] <= 2:
                categorized['Quick & Easy'].append(recipe)
            elif recipe['missing_count'] <= 2:
                categorized['Best Matches'].append(recipe)
            elif recipe['missing_count'] <= 4:
                categorized['Good Options'].append(recipe)
            else:
                categorized['More Ideas'].append(recipe)
        
        for key in categorized:
            categorized[key] = categorized[key][:8]
        
        categorized = {k: v for k, v in categorized.items() if v}
        
        return jsonify({
            'recipes': all_recipes[:30],
            'categorized': categorized,
            'total': len(all_recipes)
        })
    
    except Exception as e:
        print(f"Error in search_recipes: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/recipe/<meal_id>', methods=['GET'])
def get_recipe(meal_id):
    """Get full recipe details by ID."""
    try:
        for recipe in SIMPLE_RECIPES:
            if recipe['id'] == meal_id:
                return jsonify(recipe)
        
        meal = fetch_meal_details(meal_id)
        if not meal:
            return jsonify({'error': 'Recipe not found'}), 404
        
        recipe = {
            'id': meal['idMeal'],
            'name': meal['strMeal'],
            'category': meal.get('strCategory', 'Main'),
            'area': meal.get('strArea', ''),
            'image': meal.get('strMealThumb', ''),
            'source': meal.get('strSource', ''),
            'youtube': meal.get('strYoutube', ''),
            'ingredients': extract_meal_ingredients(meal),
            'steps': extract_meal_steps(meal),
        }
        
        return jsonify(recipe)
    
    except Exception as e:
        print(f"Error getting recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
