from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import json
import re

app = Flask(__name__)
CORS(app)

ANALYSIS_PROMPT = """Analyze this image of food items or a fridge. Return your response as valid JSON only, no other text.

Your task:
1. Identify all visible food products
2. Suggest recipes using those ingredients, organized by category

Return this exact JSON structure:
{
  "products": [
    {"name": "product name", "quantity": "amount if visible", "note": "any observation"}
  ],
  "recipes": [
    {
      "name": "Recipe Name",
      "category": "Category",
      "description": "Brief description",
      "difficulty": "Easy/Medium/Hard",
      "time": "Cooking time",
      "ingredients_from_image": ["ingredient1", "ingredient2"],
      "additional_ingredients": ["salt", "oil"],
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}

Categories must be one of: "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Salad", "Soup", "Drink"

Rules:
- Only include products you can actually see
- Suggest 4-6 realistic recipes using mostly detected ingredients
- Keep recipes simple and practical
- Return ONLY valid JSON, no markdown or explanation"""

@app.route('/analyze', methods=['POST'])
def analyze_image():
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
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                        },
                    },
                ],
            }],
            max_tokens=2000,
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
            print(f"\n=== TOKEN USAGE ===")
            print(f"Input tokens:  {usage.prompt_tokens}")
            print(f"Output tokens: {usage.completion_tokens}")
            print(f"Total tokens:  {usage.total_tokens}")
            print(f"==================\n")
        
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result_text = json_match.group()
        
        try:
            parsed_result = json.loads(result_text)
            return jsonify({'result': parsed_result, 'raw': response.choices[0].message.content, 'tokens': token_info})
        except json.JSONDecodeError:
            return jsonify({'result': None, 'raw': response.choices[0].message.content, 'parse_error': True, 'tokens': token_info})
    
    except Exception as e:
        print(f"Error in analyze: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

RECIPES_PROMPT = """Based on the following list of available ingredients, suggest recipes.

Available ingredients:
{ingredients}

Return your response as valid JSON only, no other text.

Return this exact JSON structure:
{{
  "recipes": [
    {{
      "name": "Recipe Name",
      "category": "Category",
      "description": "Brief description",
      "difficulty": "Easy/Medium/Hard",
      "time": "Cooking time",
      "ingredients_from_image": ["ingredient1", "ingredient2"],
      "additional_ingredients": ["salt", "oil"],
      "steps": ["Step 1", "Step 2", "Step 3"]
    }}
  ]
}}

Categories must be one of: "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Salad", "Soup", "Drink"

Rules:
- Suggest 4-6 realistic recipes using mostly the available ingredients
- Keep recipes simple and practical
- Return ONLY valid JSON, no markdown or explanation"""

@app.route('/regenerate-recipes', methods=['POST'])
def regenerate_recipes():
    data = request.json
    
    api_key = data.get('api_key')
    products = data.get('products', [])
    
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    
    if not products:
        return jsonify({'error': 'Products list is required'}), 400
    
    try:
        client = OpenAI(api_key=api_key)
        
        ingredients_list = "\n".join([f"- {p.get('name', '')} ({p.get('quantity', 'some')})" for p in products])
        prompt = RECIPES_PROMPT.format(ingredients=ingredients_list)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": prompt
            }],
            max_tokens=2000,
        )
        
        result_text = response.choices[0].message.content
        
        usage = response.usage
        token_info = {}
        if usage:
            token_info = {
                'input_tokens': usage.prompt_tokens,
                'output_tokens': usage.completion_tokens,
                'total_tokens': usage.total_tokens
            }
            print(f"\n=== REGENERATE RECIPES - TOKEN USAGE ===")
            print(f"Input tokens:  {usage.prompt_tokens}")
            print(f"Output tokens: {usage.completion_tokens}")
            print(f"Total tokens:  {usage.total_tokens}")
            print(f"========================================\n")
        
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result_text = json_match.group()
        
        try:
            parsed_result = json.loads(result_text)
            return jsonify({'recipes': parsed_result.get('recipes', []), 'tokens': token_info})
        except json.JSONDecodeError:
            return jsonify({'error': 'Failed to parse recipes', 'raw': response.choices[0].message.content})
    
    except Exception as e:
        print(f"Error in regenerate_recipes: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
