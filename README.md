# Image Recognition App

A basic Expo app with photo upload and camera functionality.

## Features

- **Upload Photo**: Pick an image from your device's photo library
- **Take Photo**: Capture a new photo using the device camera
- Image preview with 4:3 aspect ratio
- Clear image option

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- npm or yarn
- Expo CLI
- Expo Go app on your mobile device (for testing)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Scan the QR code with:
   - **iOS**: Camera app or Expo Go
   - **Android**: Expo Go app

## Permissions

The app requires the following permissions:
- **Camera**: To take photos
- **Photo Library**: To upload existing photos

These permissions are requested at runtime when you first use each feature.

## Project Structure

```
├── App.js           # Main application component
├── app.json         # Expo configuration
├── package.json     # Dependencies and scripts
├── babel.config.js  # Babel configuration
└── assets/          # App icons and splash screen
```

## Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Start on iOS simulator
- `npm run android` - Start on Android emulator
- `npm run web` - Start in web browser
