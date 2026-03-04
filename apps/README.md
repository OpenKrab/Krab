# 🦀 Krab Mobile Apps

Cross-platform mobile applications for Krab AI Agent.

## Structure

```
apps/
├── ios/          # iOS app (React Native)
├── android/      # Android app (React Native)
└── shared/       # Shared components & logic
```

## Features

- 🤖 Chat with Krab AI
- 🎙️ Voice input/output
- 📷 Camera integration
- 🔔 Push notifications
- 🌐 Gateway connection
- 📱 Native UI components

## Quick Start

### iOS
```bash
cd apps/ios
npm install
cd ios && pod install
cd ..
npx react-native run-ios
```

### Android
```bash
cd apps/android
npm install
npx react-native run-android
```

## Requirements

- Node.js 18+
- React Native CLI
- Xcode 14+ (iOS)
- Android Studio (Android)

## License

MIT
