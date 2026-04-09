from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import json
import re
import requests
import os
from collections import defaultdict

app = Flask(__name__)
CORS(app)

THEMEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"

# Load simple recipes from JSON file
RECIPES_FILE = os.path.join(os.path.dirname(__file__), 'simple_recipes.json')

def load_simple_recipes():
    """Load recipes from JSON file."""
    try:
        with open(RECIPES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {RECIPES_FILE} not found")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing recipes JSON: {e}")
        return []

SIMPLE_RECIPES = load_simple_recipes()
print(f"Loaded {len(SIMPLE_RECIPES)} simple recipes from simple_recipes.json")

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
            print(f"Tokens used: {usage.total_tokens}")
        
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
        
        # 1. Get simple recipes from JSON file
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
