---
title: "Common Command in Expo-Cli for Development Build"
date: 2023-09-30
id: blog0186
tag: react-native expo-cli
intro: "Record frequently used command in the expo-cli workflow in development build."
toc: false
---

- `yarn add eas-cli`
- `yarn eas device:create`
- ```json
  "scripts": {
      "start:dev": "env-cmd -f .env-cmdrc -e default,dev expo start --dev-client",
      "android": "expo run:android",
      "ios": "expo run:ios",
      "prebuild": "npx expo prebuild",
      "doctor": "npx expo-doctor",
      "easios": "env-cmd -f .env-cmdrc -e default,dev eas build --profile development --platform ios",
      "easan": "env-cmd -f .env-cmdrc -e default,dev eas build --profile development --platform android"
  },
  ```
- repeated use of `expo doctor` can resolve many building issues at the early stage.
