from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import json
import re
import requests
import os
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, urljoin, urlparse

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


# Browser-like UA so recipe sites return full HTML with og:image
SOURCE_PAGE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def extract_og_image_url(html, base_url):
    """
    Parse Open Graph / Twitter image from HTML (original recipe site preview image).
    """
    if not html or not base_url:
        return None
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<meta[^>]+property=["\']og:image:url["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:image:src["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']',
    ]
    for pattern in patterns:
        m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
        if not m:
            continue
        raw = m.group(1).strip()
        if not raw or raw.lower().startswith("data:"):
            continue
        if raw.startswith("//"):
            raw = "https:" + raw
        if raw.startswith("http://") or raw.startswith("https://"):
            parsed = urlparse(raw)
            path = (parsed.path or "").lower()
            # Skip obvious non-photo assets
            if path.endswith((".svg", ".ico")):
                continue
            return raw
        return urljoin(base_url, raw)
    return None


def fetch_original_recipe_image(source_url, timeout=5):
    """
    Fetch the recipe's source page and return og:image URL if found.
    Falls back to None so caller can keep TheMealDB thumbnail.
    """
    if not source_url or not isinstance(source_url, str):
        return None
    source_url = source_url.strip()
    if not source_url.startswith(("http://", "https://")):
        return None
    try:
        r = requests.get(
            source_url,
            timeout=timeout,
            headers=SOURCE_PAGE_HEADERS,
            allow_redirects=True,
        )
        r.raise_for_status()
        ctype = (r.headers.get("Content-Type") or "").lower()
        if "html" not in ctype and "xml" not in ctype:
            return None
        html = r.text[:800000]
        found = extract_og_image_url(html, r.url)
        return found
    except Exception as e:
        print(f"Could not load source image from {source_url}: {e}")
        return None


# --- Allrecipes (search HTML + JSON-LD on recipe pages; no official API) ---
ALLRECIPES_ORIGIN = "https://www.allrecipes.com"


def fetch_allrecipes_search_urls(query, limit=14):
    """Collect recipe page URLs from Allrecipes search results."""
    if not query or len(query.strip()) < 2:
        return []
    try:
        q = quote(query.strip(), safe="")
        url = f"{ALLRECIPES_ORIGIN}/search?q={q}"
        r = requests.get(url, headers=SOURCE_PAGE_HEADERS, timeout=14)
        r.raise_for_status()
        html = r.text
    except Exception as e:
        print(f"Allrecipes search error ({query}): {e}")
        return []

    urls = []
    seen = set()
    for m in re.finditer(
        r'href="(https://www\.allrecipes\.com/recipe/\d+/[^"?\#]+)',
        html,
        re.I,
    ):
        u = m.group(1).split("?")[0].rstrip("/") + "/"
        if u not in seen:
            seen.add(u)
            urls.append(u)
        if len(urls) >= limit:
            return urls

    for m in re.finditer(r'href="(/recipe/\d+/[a-z0-9-]+)/?"', html, re.I):
        u = urljoin(ALLRECIPES_ORIGIN, m.group(1))
        u = u.split("?")[0].rstrip("/") + "/"
        if u not in seen:
            seen.add(u)
            urls.append(u)
        if len(urls) >= limit:
            break
    return urls[:limit]


def _is_recipe_ld_type(obj):
    if not isinstance(obj, dict):
        return False
    t = obj.get("@type")
    if t == "Recipe":
        return True
    if isinstance(t, list):
        return any(str(x).strip().lower() == "recipe" for x in t)
    return str(t).strip().lower() == "recipe"


def _find_recipe_object_in_jsonld(data):
    """Walk JSON-LD and return the first schema.org Recipe object."""
    if isinstance(data, dict):
        if _is_recipe_ld_type(data):
            return data
        for key in ("@graph", "mainEntity", "itemListElement"):
            if key in data:
                found = _find_recipe_object_in_jsonld(data[key])
                if found:
                    return found
        for v in data.values():
            found = _find_recipe_object_in_jsonld(v)
            if found:
                return found
    elif isinstance(data, list):
        for item in data:
            found = _find_recipe_object_in_jsonld(item)
            if found:
                return found
    return None


def _parse_recipe_instructions_ld(instr):
    if not instr:
        return []
    steps = []
    if isinstance(instr, str):
        for line in re.split(r"\n+", instr):
            line = line.strip()
            if len(line) > 5:
                steps.append(line)
        return steps[:24]
    if isinstance(instr, dict):
        instr = [instr]
    if isinstance(instr, list):
        for item in instr:
            if isinstance(item, str) and item.strip():
                steps.append(item.strip())
            elif isinstance(item, dict):
                t = item.get("@type")
                if t == "HowToStep":
                    txt = item.get("text")
                    if isinstance(txt, str) and txt.strip():
                        steps.append(txt.strip())
                    elif isinstance(txt, list):
                        for x in txt:
                            if isinstance(x, str) and x.strip():
                                steps.append(x.strip())
                elif t == "HowToSection":
                    for el in item.get("itemListElement") or []:
                        if isinstance(el, dict):
                            if el.get("text"):
                                steps.append(str(el["text"]).strip())
                            elif el.get("itemListElement"):
                                steps.extend(_parse_recipe_instructions_ld(el["itemListElement"]))
                        elif isinstance(el, str) and el.strip():
                            steps.append(el.strip())
    return [s for s in steps if s][:24]


def _jsonld_image_url(image_field):
    if not image_field:
        return ""
    if isinstance(image_field, str):
        return image_field
    if isinstance(image_field, list) and image_field:
        first = image_field[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url") or first.get("contentUrl") or ""
    if isinstance(image_field, dict):
        return image_field.get("url") or image_field.get("contentUrl") or ""
    return ""


def extract_allrecipes_recipe_from_html(html, page_url):
    """Parse Recipe JSON-LD from an Allrecipes (or similar) HTML page."""
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        html,
        re.I,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        recipe_obj = _find_recipe_object_in_jsonld(data)
        if not recipe_obj:
            continue
        name = recipe_obj.get("name") or "Recipe"
        if isinstance(name, list):
            name = name[0] if name else "Recipe"
        recipe_ing = recipe_obj.get("recipeIngredient") or []
        if isinstance(recipe_ing, str):
            recipe_ing = [recipe_ing]
        ingredients = []
        for line in recipe_ing:
            if isinstance(line, str) and line.strip():
                ingredients.append({"name": line.strip(), "measure": ""})
        if len(ingredients) < 2:
            continue
        steps = _parse_recipe_instructions_ld(recipe_obj.get("recipeInstructions"))
        cat = recipe_obj.get("recipeCategory")
        if isinstance(cat, list):
            cat = cat[0] if cat else "Main"
        if not cat:
            cat = "Main"
        cuisine = recipe_obj.get("recipeCuisine") or ""
        if isinstance(cuisine, list):
            cuisine = cuisine[0] if cuisine else ""
        vid = recipe_obj.get("video")
        youtube = ""
        if isinstance(vid, dict):
            youtube = vid.get("contentUrl") or ""

        m = re.search(r"/recipe/(\d+)/", page_url)
        rid = f"ar_{m.group(1)}" if m else f"ar_{abs(hash(page_url)) % 10 ** 9}"

        return {
            "id": rid,
            "name": str(name).strip(),
            "category": str(cat),
            "area": str(cuisine).strip() if cuisine else "American",
            "image": _jsonld_image_url(recipe_obj.get("image")),
            "source": page_url.split("?")[0],
            "youtube": youtube,
            "ingredients": ingredients,
            "steps": steps if steps else ["See full recipe on Allrecipes (instructions in app may be abbreviated)."],
        }
    return None


def fetch_allrecipes_recipe_for_match(url, user_ingredients):
    """Fetch one Allrecipes page, parse JSON-LD, filter by ingredient match."""
    try:
        r = requests.get(url, headers=SOURCE_PAGE_HEADERS, timeout=14, allow_redirects=True)
        r.raise_for_status()
        ctype = (r.headers.get("Content-Type") or "").lower()
        if "html" not in ctype:
            return None
        parsed = extract_allrecipes_recipe_from_html(r.text, r.url)
        if not parsed:
            return None
        match_info = calculate_match(parsed["ingredients"], user_ingredients)
        if match_info["match_percent"] < 20 or match_info["missing_count"] > 10:
            return None
        parsed.update(match_info)
        return parsed
    except Exception as e:
        print(f"Allrecipes recipe fetch error {url}: {e}")
        return None


def fetch_allrecipes_detail_by_id(ar_numeric_id):
    """Load recipe by Allrecipes numeric id (slug optional via redirect)."""
    url = f"{ALLRECIPES_ORIGIN}/recipe/{ar_numeric_id}/"
    r = requests.get(url, headers=SOURCE_PAGE_HEADERS, timeout=16, allow_redirects=True)
    r.raise_for_status()
    parsed = extract_allrecipes_recipe_from_html(r.text, r.url)
    return parsed


def enrich_recipes_with_source_images(recipes, max_workers=6):
    """Replace image with og:image from recipe source site when available (parallel)."""
    tasks = []
    for i, r in enumerate(recipes):
        sid = r.get("id")
        if sid is None or (isinstance(sid, str) and sid.startswith("simple_")):
            continue
        if isinstance(sid, str) and sid.startswith("ar_") and r.get("image"):
            continue
        src = r.get("source")
        if not src:
            continue
        tasks.append((i, src))

    if not tasks:
        return recipes

    def fetch_one(item):
        idx, url = item
        img = fetch_original_recipe_image(url)
        return idx, img

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(fetch_one, t) for t in tasks]
        for fut in as_completed(futures):
            try:
                idx, img_url = fut.result()
                if img_url:
                    recipes[idx]["image"] = img_url
            except Exception as e:
                print(f"Source image worker error: {e}")

    return recipes


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
        
        # 3. Allrecipes — search by ingredient keywords, parse JSON-LD on recipe pages
        if os.environ.get("DISABLE_ALLRECIPES", "").lower() not in ("1", "true", "yes"):
            ar_seen_urls = set()
            ar_urls = []
            for ing in search_ingredients[:6]:
                term = normalize_ingredient(ing).split()[0]
                if len(term) < 2:
                    continue
                for u in fetch_allrecipes_search_urls(term, limit=12):
                    if u not in ar_seen_urls:
                        ar_seen_urls.add(u)
                        ar_urls.append(u)
                    if len(ar_urls) >= 28:
                        break
                if len(ar_urls) >= 28:
                    break
            print(f"Allrecipes: collected {len(ar_urls)} unique recipe URLs")

            def _fetch_ar(u):
                return fetch_allrecipes_recipe_for_match(u, ingredients)

            with ThreadPoolExecutor(max_workers=3) as pool:
                futs = [pool.submit(_fetch_ar, u) for u in ar_urls[:16]]
                for fut in as_completed(futs):
                    try:
                        ar_recipe = fut.result()
                        if ar_recipe and ar_recipe["id"] not in seen_ids:
                            all_recipes.append(ar_recipe)
                            seen_ids.add(ar_recipe["id"])
                    except Exception as e:
                        print(f"Allrecipes worker: {e}")
        
        all_recipes.sort(key=lambda x: (x['missing_count'], -x['match_percent']))
        
        # Prefer hero images from the original recipe site (Open Graph) when strSource exists
        enrich_recipes_with_source_images(all_recipes)
        
        categorized = {
            'Quick & Easy': [],
            'Best Matches': [],
            'Good Options': [],
            'More Ideas': []
        }
        
        for recipe in all_recipes:
            rid = str(recipe["id"])
            if rid.startswith("simple_") and recipe["missing_count"] <= 2:
                categorized["Quick & Easy"].append(recipe)
            elif recipe["missing_count"] <= 2:
                categorized["Best Matches"].append(recipe)
            elif recipe["missing_count"] <= 4:
                categorized["Good Options"].append(recipe)
            else:
                categorized["More Ideas"].append(recipe)
        
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
        
        if isinstance(meal_id, str) and meal_id.startswith("ar_"):
            num = meal_id[3:].strip()
            if not num.isdigit():
                return jsonify({"error": "Invalid Allrecipes id"}), 400
            try:
                parsed = fetch_allrecipes_detail_by_id(num)
            except Exception as e:
                print(f"Allrecipes detail error: {e}")
                return jsonify({"error": "Recipe not found"}), 404
            if not parsed:
                return jsonify({"error": "Recipe not found"}), 404
            return jsonify(parsed)
        
        meal = fetch_meal_details(meal_id)
        if not meal:
            return jsonify({'error': 'Recipe not found'}), 404
        
        thumb = meal.get('strMealThumb', '')
        source = meal.get('strSource', '')
        og_image = fetch_original_recipe_image(source) if source else None
        recipe = {
            'id': meal['idMeal'],
            'name': meal['strMeal'],
            'category': meal.get('strCategory', 'Main'),
            'area': meal.get('strArea', ''),
            'image': og_image or thumb,
            'source': source,
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
