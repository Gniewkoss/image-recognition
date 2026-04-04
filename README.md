# Image Recognition App

An Expo app that uses OpenAI's vision API to analyze photos.

## Features

- **Upload Photo**: Pick an image from your device's photo library
- **Take Photo**: Capture a new photo using the device camera
- **Analyze Image**: Send the image to OpenAI to get a description of what's in it
- **API Key Storage**: Your OpenAI API key is stored locally and remembered

## Project Structure

```
├── App.js              # Main React Native app
├── app.json            # Expo configuration
├── package.json        # Frontend dependencies
├── backend/
│   ├── server.py       # Flask server for OpenAI API
│   └── requirements.txt # Python dependencies
└── assets/             # App icons and splash screen
```

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- Python 3.8+
- OpenAI API key

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Set Up Python Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run the Backend Server

```bash
cd backend
source venv/bin/activate
python server.py
```

The server will start at `http://localhost:5000`

### 4. Run the Expo App

In a new terminal:

```bash
npm start
```

### 5. Configure API Key

1. Open the app
2. Tap the ⚙️ settings icon
3. Enter your OpenAI API key
4. The key is saved locally on your device

## Usage

1. Take a photo or upload one from your gallery
2. Tap "What's in this photo?" button
3. Wait for the AI analysis
4. View the description of your image

## API Endpoint

The backend exposes:

- `POST /analyze` - Analyze an image
  - Body: `{ "api_key": "sk-...", "image_base64": "..." }`
  - Returns: `{ "result": "Description of the image" }`

- `GET /health` - Health check

## Notes

- The backend must be running for image analysis to work
- Camera feature requires a physical device (not simulator)
- Image quality is set to 80% to reduce upload size
