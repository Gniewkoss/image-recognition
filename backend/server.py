from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import base64
import os

app = Flask(__name__)
CORS(app)

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
                    {"type": "input_text", "text":
                    """write this You are an AI assistant that analyzes an image of a fridge or food items.

Your task has two steps:

1. Identify all visible food products in the image.
- List every recognizable item.
- Be specific (e.g., “cheddar cheese” instead of just “cheese” if possible).
- Include quantities or states if visible (e.g., “half tomato”, “opened milk carton”).
- Ignore non-food items unless they are clearly food-related.

2. Based on the identified ingredients, generate recipes:
- Suggest multiple recipes that can be made using ONLY or MOSTLY the detected ingredients.
- Recipes should be realistic and commonly known dishes.
- For each recipe, include:
  - Recipe name
  - Short description
  - Ingredients used from the image
  - Any additional basic ingredients (e.g., salt, oil, spices) if needed
  - Brief preparation steps

Output format:

=== DETECTED INGREDIENTS ===
- Item 1
- Item 2
- Item 3
...

=== POSSIBLE RECIPES ===

1. Recipe Name
Description: ...
Uses: ...
Additional ingredients: ...
Steps:
1. ...
2. ...
3. ...

2. Recipe Name
...

Important rules:
- Do NOT hallucinate ingredients that are not visible.
- If uncertain, mark items as “possibly”.
- Prefer simple, quick recipes.
- If very few ingredients are detected, suggest minimal recipes or combinations.


"""},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{image_base64}",
                    },
                ],
            }],
        )
        
        return jsonify({'result': response.output_text})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
