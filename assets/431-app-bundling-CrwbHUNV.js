const n=`---
title: "Study Notes of \`egui\` Part III: App Bundling"
date: 2025-10-25
id: blog0431
tag: rust, egui
toc: true
intro: Study how to bundle an application.
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px !important;
  }
</style>

<Center>

[![](/assets/img/2025-10-26-17-29-12.png)](/assets/img/2025-10-26-17-29-12.png)

</Center>



### The Release Build and its Problem

In an \`egui\` application we can build it via

\`\`\`bash
cargo build --release
\`\`\`
<customimage src="/assets/img/2025-10-25-22-38-59.png" width="320"></customimage>


The result will be an executable that will be ***first*** executed in shell script and ***then*** display our GUI.


[![](/assets/img/2025-10-25-22-40-46.png)](/assets/img/2025-10-25-22-40-46.png)

But of course we don't want our logging be exposed to the users. And any standard GUI application wouldn't pop up a terminal right? 

To remove this terminal, we need to bundle our application into a native macOS application (known as \`.app\`-bundle).

### App-bundling


Create a \`bundle_macos.sh\` and write (change the highlighted for your own application):


\`\`\`bash{6-9}
#!/bin/bash
# Script to bundle the Rust app into a macOS .app bundle

set -e

APP_NAME="Shell Script Manager"
BUNDLE_NAME="Shell Script Manager.app"
EXECUTABLE_NAME="shell_script_manager"
BUNDLE_ID="com.shellscriptmanager.app"
VERSION="0.1.0"

echo "Building release binary..."
cargo build --release

echo "Creating app bundle structure..."
rm -rf "$BUNDLE_NAME"
mkdir -p "$BUNDLE_NAME/Contents/MacOS"
mkdir -p "$BUNDLE_NAME/Contents/Resources"

echo "Copying executable..."
cp "target/release/$EXECUTABLE_NAME" "$BUNDLE_NAME/Contents/MacOS/$EXECUTABLE_NAME"

echo "Copying icon..."
cp "assets/icon-256.png" "$BUNDLE_NAME/Contents/Resources/icon.png"

# Convert PNG to ICNS (macOS icon format) if sips is available
if command -v sips &> /dev/null && command -v iconutil &> /dev/null; then
    echo "Converting icon to ICNS format..."
    mkdir -p icon.iconset
    sips -z 16 16     assets/icon-256.png --out icon.iconset/icon_16x16.png
    sips -z 32 32     assets/icon-256.png --out icon.iconset/icon_16x16@2x.png
    sips -z 32 32     assets/icon-256.png --out icon.iconset/icon_32x32.png
    sips -z 64 64     assets/icon-256.png --out icon.iconset/icon_32x32@2x.png
    sips -z 128 128   assets/icon-256.png --out icon.iconset/icon_128x128.png
    sips -z 256 256   assets/icon-256.png --out icon.iconset/icon_128x128@2x.png
    sips -z 256 256   assets/icon-256.png --out icon.iconset/icon_256x256.png
    sips -z 512 512   assets/icon-1024.png --out icon.iconset/icon_256x256@2x.png
    sips -z 512 512   assets/icon-1024.png --out icon.iconset/icon_512x512.png
    sips -z 1024 1024 assets/icon-1024.png --out icon.iconset/icon_512x512@2x.png
    iconutil -c icns icon.iconset -o "$BUNDLE_NAME/Contents/Resources/icon.icns"
    rm -rf icon.iconset
fi

echo "Creating Info.plist..."
cat > "$BUNDLE_NAME/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

echo "Setting executable permissions..."
chmod +x "$BUNDLE_NAME/Contents/MacOS/$EXECUTABLE_NAME"

echo "Removing quarantine attributes..."
# Remove quarantine before signing
xattr -cr "$BUNDLE_NAME" 2>/dev/null || true
xattr -d com.apple.quarantine "$BUNDLE_NAME" 2>/dev/null || true

echo "Code signing the app bundle..."
# Ad-hoc signing (no developer certificate needed)
codesign --force --deep --sign - "$BUNDLE_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Code signing successful"

    # Remove quarantine again after signing
    xattr -cr "$BUNDLE_NAME" 2>/dev/null || true
    xattr -d com.apple.quarantine "$BUNDLE_NAME" 2>/dev/null || true

    # Also remove from the executable directly
    xattr -cr "$BUNDLE_NAME/Contents/MacOS/$EXECUTABLE_NAME" 2>/dev/null || true
else
    echo "⚠️  Code signing failed, but app may still work"
fi

echo ""
echo "✅ App bundle created successfully: $BUNDLE_NAME"
echo ""
echo "To run the app:"
echo "  • Double-click '$BUNDLE_NAME' to launch"
echo "  • Or run: open '$BUNDLE_NAME'"
echo ""
echo "If you get a 'malware' warning from macOS Gatekeeper:"
echo "  1. Right-click (or Control+click) on '$BUNDLE_NAME'"
echo "  2. Select 'Open' from the menu"
echo "  3. Click 'Open' in the dialog that appears"
echo "  4. The app will open and macOS will remember your choice"
echo ""
echo "Alternative: Disable Gatekeeper check for this app:"
echo "  sudo xattr -rd com.apple.quarantine '$BUNDLE_NAME'"
echo ""
\`\`\`


### The Warning: Apple could not verify "your-application" is free of malware ...

<customimage src="/assets/img/2025-10-25-23-09-33.png" width="400"></customimage>

Since we have not signed the application with an Apple Developer account, we are not able to share this application without the apple default warning. 

For this, any user that download our app-bundle will need to execute:

\`\`\`bash
xattr -rd com.apple.quarantine "Shell Script Manager.app"
\`\`\`
in order to remove the warning (worse still, we ***cannot*** even run the application without doing so). `;export{n as default};
