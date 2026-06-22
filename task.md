# IPTV version 6 upgrade and channel config tasks

- [x] Update package.json dependency to react-native-video v6
- [x] Delete custom typings file src/types/react-native-video.d.ts
- [x] Update VideoPlayer.tsx to use react-native-video v6 API
- [x] Add German and Indian channels to App.tsx mock list
- [x] Run npm install to update dependencies
- [x] Verify clean compilation using TypeScript compiler
- [x] Update Android build.gradle to target compileSdkVersion/targetSdkVersion 35 (Media3 requirement)
- [x] Deploy and run debug build on the Android TV emulator
- [x] Compile release APK for physical TV / USB-stick deployment

# Multi-OS TV Web App Tasks
- [x] Add "web" script to package.json
- [x] Create web/index.html layout with HLS player container
- [x] Create web/style.css with premium TV D-pad focus animations
- [x] Create web/app.js with dynamic M3U fetching, async parsing, and D-pad key navigation
- [x] Test the web app locally and verify remote key navigation
- [x] Create LG webOS native app manifest appinfo.json
- [x] Optimize buffer parameters (ExoPlayer & Hls.js) for slow/unstable networks
- [x] Add CLI-based wireless deployment scripts for LG webOS to package.json

# TV Web App Redesign Tasks
- [x] Restructure web/index.html to add top navigation menu and banner updates
- [x] Redesign web/style.css with standard margins (no gap) and vertical poster cards
- [x] Update web/app.js to support D-pad navigation with top header, categories filtering, and Favorites system
- [x] Verify clean compilation and local web server run
