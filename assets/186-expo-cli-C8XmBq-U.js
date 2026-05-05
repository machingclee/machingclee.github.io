const e=`---
title: "Expo-CLI for Development Build"
date: 2023-09-30
id: blog0186
tag: react-native, expo
intro: "Record detail of expo-cli workflow in development build."
toc: true
img: expo
---

<style>
  img {
    max-width: 600px
  }
</style>

### Commonly Used Commands

- \`yarn add eas-cli\`
- \`yarn eas device:create\`
- \`\`\`json
  "scripts": {
      "start:dev": "env-cmd -f .env-cmdrc -e default,dev expo start --dev-client",
      "android": "expo run:android",
      "ios": "expo run:ios",
      "prebuild": "npx expo prebuild",
      "doctor": "npx expo-doctor",
      "easios": "eas build --profile development --platform ios",
      "easan": "eas build --profile development --platform android"
  },
  \`\`\`
- repeated use of \`expo doctor\` can resolve many building issues at the early stage.

### Development Build

- After \`yarn easios\` or \`yarn easan\`, a development build will be compiled on cloud.

  [![](/assets/tech/186/001.png)](/assets/tech/186/001.png)

- This **development build** must be linked with \`expo dev-client\` via our \`yarn start:dev\` command above.
- Our flag \`--profile development\` in \`eas build\` will use the config in \`eas.json\`
  \`\`\`json
  {
    "cli": {
      "version": ">= 5.2.0"
    },
    "build": {
      "development": {
        "distribution": "internal",
        "android": {
          "gradleCommand": ":app:assembleDebug"
        },
        "ios": {
          "buildConfiguration": "Debug"
        }
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {}
    },
    "submit": {
      "production": {}
    }
  }
  \`\`\`
  Under this flag, the **_environment variable_** in **_development build_** is not determined at compile time, we can change the environment variables when we spawn a dev-client.
- If you wish, you can embed fixed environment variable in \`eas build\` by providing the variables in \`eas.json\`:
  \`\`\`json
  {
    "build": {
      "production": {
        "env": {
          "EXPO_PUBLIC_API_URL": "https://api.production.com"
        }
      },
      "test": {
        "env": {
          "EXPO_PUBLIC_API_URL": "https://api.test.com"
        }
      }
    }
  }
  \`\`\`
- After \`eas build\` is finished, there will be a QR code for android and ios to download the \`development build\` that contains all the native code we need.

- We will keep developing the project in \`expo dev-client\`, but this time, we will link to our \`development build\` with a new QR code:

  [![](/assets/tech/186/002.png)](/assets/tech/186/002.png)

  instead of \`expo-go\`. Just scan it, we get the same developer experience as before even on Windows machine.

### Prebuild

- A **_prebuild_** is actually the stuff that is generated in \`eas build\` on cloud if we have never \`prebuild\` the project.

- For example, if we look at [react-native-twilio-video-webrtc](https://www.npmjs.com/package/react-native-twilio-video-webrtc), since this package has native code in both android and ios, **in the past** we need to
  - Start from \`react-cli\` / \`eject\` from \`expo\`.
  - Inject native code, and keep going without \`expo\`.
- This workflow is nowadays called a **_bare workflow_**.

- Now look at **Usage with Expo** section of the npm page, the process becomes simply adding

  \`\`\`json
  {
    "name": "my app",
    "plugins": [
      [
        "react-native-twilio-video-webrtc",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone"
        }
      ]
    ]
  }
  \`\`\`

  in \`app.json\`. This will automatically insert

  \`\`\`text
  <key>NSCameraUsageDescription</key>
  <string>Your message to user when the camera is accessed for the first time</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Your message to user when the microphone is accessed for the first time</string>
  \`\`\`

  into \`Info.plist\` of ios and insert similar requirements into \`AndroidManifest.xml\` of android.

- For native code, package developer will write \`expo-modules\` with [Expo Modules API](https://docs.expo.dev/modules/overview/) that helps bridge native code and javascript.

- **_Problem: What if they havn't?_**

- Then we will need to **_prebuild the project_**, this will generate \`ios/\` and \`android/\` folders containing the native code of the project. We then follow the guidelines to modify the native code on our own.

- After modification is done, we can continue to run \`eas build\` on the cloud, this time since \`ios/\` and \`android/\` exist, the cloud service will determine to use our own prebuild file to compile the application.

- A barework workflow doesn't mean you need to start \`react-native-cli\` (in the old days we need to physically connect our ios device to Mac in order to continue).

- After \`eas build --profile development\` and after we have downloaded the built mobile app from cloud, we can \`expo start --dev-client\` again.
`;export{e as default};
