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


def normalize_ingredient(name):
    """Normalize ingredient name for better matching."""
    name = name.lower().strip()
    # Remove common prefixes/suffixes
    remove_words = ['fresh', 'raw', 'cooked', 'dried', 'frozen', 'canned', 'sliced', 'diced', 'chopped', 'minced', 'whole', 'large', 'small', 'medium']
    words = name.split()
    words = [w for w in words if w not in remove_words]
    return ' '.join(words) if words else name


def extract_meal_ingredients(meal):
    """Extract ingredients from a TheMealDB meal object."""
    ingredients = []
    for i in range(1, 21):
        ing = meal.get(f'strIngredient{i}')
        measure = meal.get(f'strMeasure{i}')
        if ing and ing.strip():
            ingredients.append({
                'name': ing.strip(),
                'measure': measure.strip() if measure else ''
            })
    return ingredients


def extract_meal_steps(meal):
    """Extract cooking steps from instructions."""
    instructions = meal.get('strInstructions', '')
    if not instructions:
        return []
    
    # Split by common delimiters
    steps = re.split(r'\r\n|\n\n|\. (?=[A-Z])', instructions)
    steps = [s.strip() for s in steps if s.strip() and len(s.strip()) > 10]
    
    # Number the steps if not already numbered
    result = []
    for i, step in enumerate(steps):
        # Remove existing numbers
        step = re.sub(r'^[\d]+[\.\)]\s*', '', step)
        if step:
            result.append(step)
    
    return result[:10]  # Limit to 10 steps


def calculate_match(recipe_ingredients, user_ingredients):
    """Calculate how well a recipe matches user's ingredients."""
    user_ing_normalized = set(normalize_ingredient(i['name']) for i in user_ingredients)
    user_ing_words = set()
    for i in user_ingredients:
        user_ing_words.update(normalize_ingredient(i['name']).split())
    
    matched = []
    missing = []
    
    for ing in recipe_ingredients:
        ing_name = normalize_ingredient(ing['name'])
        ing_words = set(ing_name.split())
        
        # Check for exact or partial match
        if ing_name in user_ing_normalized:
            matched.append(ing['name'])
        elif ing_words & user_ing_words:  # Word overlap
            matched.append(ing['name'])
        else:
            missing.append(ing['name'])
    
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
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                        },
                    },
                ],
            }],
            max_tokens=1000,
        )
        
        result_text = response.choices[0].message.content
        
        # Get token usage
        usage = response.usage
        token_info = {}
        if usage:
            token_info = {
                'input_tokens': usage.prompt_tokens,
                'output_tokens': usage.completion_tokens,
                'total_tokens': usage.total_tokens
            }
            print(f"\n=== INGREDIENT EXTRACTION - TOKEN USAGE ===")
            print(f"Input tokens:  {usage.prompt_tokens}")
            print(f"Output tokens: {usage.completion_tokens}")
            print(f"Total tokens:  {usage.total_tokens}")
            print(f"==========================================\n")
        
        # Parse JSON
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result_text = json_match.group()
        
        try:
            parsed_result = json.loads(result_text)
            ingredients = parsed_result.get('ingredients', [])
            return jsonify({
                'ingredients': ingredients,
                'tokens': token_info
            })
        except json.JSONDecodeError:
            return jsonify({
                'ingredients': [],
                'error': 'Failed to parse ingredients',
                'raw': result_text
            })
    
    except Exception as e:
        print(f"Error in analyze: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/search-recipes', methods=['POST'])
def search_recipes():
    """Search for real recipes based on user's ingredients."""
    data = request.json
    ingredients = data.get('ingredients', [])
    
    if not ingredients:
        return jsonify({'error': 'Ingredients are required'}), 400
    
    try:
        # Fetch recipes for each ingredient
        all_meal_ids = defaultdict(int)
        
        # Search using top ingredients (limit to avoid too many API calls)
        search_ingredients = [i['name'] for i in ingredients[:8]]
        
        for ing in search_ingredients:
            # Use the main word of the ingredient
            search_term = normalize_ingredient(ing).split()[0]
            meals = fetch_recipes_by_ingredient(search_term)
            for meal in meals:
                all_meal_ids[meal['idMeal']] += 1
        
        # Sort by frequency (recipes that match more ingredients)
        sorted_meal_ids = sorted(all_meal_ids.keys(), key=lambda x: all_meal_ids[x], reverse=True)
        
        # Fetch details for top recipes
        recipes = []
        for meal_id in sorted_meal_ids[:15]:  # Limit to 15 recipes
            meal = fetch_meal_details(meal_id)
            if not meal:
                continue
            
            recipe_ingredients = extract_meal_ingredients(meal)
            match_info = calculate_match(recipe_ingredients, ingredients)
            
            # Skip recipes with very low match
            if match_info['match_percent'] < 10:
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
                'match_percent': match_info['match_percent'],
                'matched_count': match_info['matched_count'],
                'missing_count': match_info['missing_count'],
                'matched_ingredients': match_info['matched_ingredients'],
                'missing_ingredients': match_info['missing_ingredients'],
            }
            recipes.append(recipe)
        
        # Sort by match percentage
        recipes.sort(key=lambda x: x['match_percent'], reverse=True)
        
        # Categorize recipes
        categorized = {
            'Best Matches': [],
            'Good Matches': [],
            'Partial Matches': []
        }
        
        for recipe in recipes:
            if recipe['match_percent'] >= 60:
                categorized['Best Matches'].append(recipe)
            elif recipe['match_percent'] >= 40:
                categorized['Good Matches'].append(recipe)
            else:
                categorized['Partial Matches'].append(recipe)
        
        return jsonify({
            'recipes': recipes,
            'categorized': categorized,
            'total': len(recipes)
        })
    
    except Exception as e:
        print(f"Error in search_recipes: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/recipe/<meal_id>', methods=['GET'])
def get_recipe(meal_id):
    """Get full recipe details by ID."""
    try:
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
            'instructions': meal.get('strInstructions', ''),
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
