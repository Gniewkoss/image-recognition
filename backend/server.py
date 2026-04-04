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
        
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": ANALYSIS_PROMPT},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{image_base64}",
                    },
                ],
            }],
        )
        
        result_text = response.output_text
        
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result_text = json_match.group()
        
        try:
            parsed_result = json.loads(result_text)
            return jsonify({'result': parsed_result, 'raw': response.output_text})
        except json.JSONDecodeError:
            return jsonify({'result': None, 'raw': response.output_text, 'parse_error': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
