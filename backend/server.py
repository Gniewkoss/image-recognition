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
                    {"type": "input_text", "text": "What's in this image? Describe it in detail."},
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
