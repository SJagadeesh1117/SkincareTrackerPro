#!/bin/bash
set -e

echo "=== Skincare Tracker Pro — Build and Install ==="

# Check adb is available
if ! command -v adb &> /dev/null; then
  echo "ERROR: adb not found. Install Android Studio and add platform-tools to PATH."
  exit 1
fi

# Check device connected
DEVICE=$(adb devices | grep -v "List" | grep "device$" | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  echo "ERROR: No Android device found."
  echo "Fix: plug in phone via USB, enable USB debugging, accept the popup on phone."
  exit 1
fi
echo "Device found: $DEVICE"

# Build release APK
echo "Building APK..."
cd android
./gradlew assembleDebug --quiet
cd ..

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

# Uninstall old version silently (ignore error if not installed)
adb -s $DEVICE uninstall com.skincaretrackerpro 2>/dev/null || true

# Install new APK
echo "Installing on device..."
adb -s $DEVICE install -r $APK_PATH

# Launch app automatically
echo "Launching app..."
adb -s $DEVICE shell am start -n com.skincaretrackerpro/.MainActivity

echo "=== Done. App is running on your phone. ==="
