# Castify TV

Castify TV is a modern, premium IPTV media application designed specifically for Smart TVs. It features a Netflix-style grid, dynamic M3U playlist downloads, automated category grouping, custom D-pad navigation support, and a favorite channels manager.

The codebase supports two targets:
1. **LG webOS TV**: Built with vanilla HTML5/CSS3/JavaScript (in the `web` folder) and packaged into an `.ipk` package.
2. **Android TV (Xiaomi, Sony, etc.)**: Built using React Native TVOS and packaged into an `.apk` package.

---

## 📺 How to Install on Android TV (Xiaomi & Sony TV 70")

Sony and Xiaomi TVs run **Android TV** (or Google TV). To install the app with pixel-perfect design scaling on large 70" screens, follow these step-by-step guidelines.

### Step 1: Build the Release APK
To compile the Android release package, run the following commands on your development machine:
```bash
cd android
./gradlew assembleRelease
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

---

### Step 2: Prepare your Xiaomi / Sony TV
Before you can install the app, you must allow installation of third-party applications (sideloading):

1. **Enable Developer Options**:
   - Go to **Settings** > **Device Preferences** (or **System**) > **About**.
   - Scroll down to **Build** (or **Android TV OS Build**) and click it **7 times** until a toast message says *"You are now a developer!"*.
2. **Allow Unknown Sources**:
   - Navigate back to **Settings** > **Apps** > **Security & Restrictions** > **Unknown Sources**.
   - Enable permission for the file manager or downloader app you plan to use (e.g., *Downloader* or *File Commander*).
3. **Turn on USB Debugging** (if using ADB):
   - Go to **Settings** > **Developer Options**.
   - Enable **USB Debugging**.

---

### Step 3: Install the APK on the TV (3 Methods)

#### Method A: Wireless ADB (Recommended for Developers)
If your TV and computer are on the same Wi-Fi network:
1. Find your TV's IP address: **Settings** > **Network & Internet** > select your active connection.
2. Connect to the TV from your terminal:
   ```bash
   adb connect <TV_IP_ADDRESS>:5555
   ```
3. Accept the connection prompt on your TV screen.
4. Install the APK:
   ```bash
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

#### Method B: USB Flash Drive (Easiest)
1. Format a USB flash drive to **FAT32** or **NTFS**.
2. Copy `app-release.apk` onto the flash drive.
3. Plug the drive into the USB port of your Sony or Xiaomi TV.
4. Open a File Manager app on your TV (e.g., *File Commander* or the default file explorer).
5. Navigate to the USB drive, select `app-release.apk`, click **Install**, and confirm.

#### Method C: "Downloader" App (Fully Wireless & Remote-only)
1. Install the free **Downloader** app by AFTVNews from the Google Play Store on your TV.
2. Open **Downloader** and type the URL where you've uploaded the APK (or host a local server on your laptop using `npx http-server` and type your laptop's IP address).
3. Download the file, and the app will automatically trigger the installer prompt.

---

### 🎨 Avoiding Design & Clipping Problems on 70" TVs

Large screens like a 70" 4K TV can suffer from clipping, layout stretching, or low-resolution rendering if not styled correctly. Follow these rules to ensure perfect design presentation:

*   **Overscan Safe Zones**:
    - Keep all critical navigation headers, buttons, and logos inside a **5% padding margin** (`2vw` horizontal, `2vh` vertical safe zone). This prevents the TV screen bezel from cutting off the edges of the UI.
*   **Viewport Density Scaling**:
    - For the webOS app, `viewport` is configured to use absolute percentages (`vh` and `vw`) relative to a standard `1920x1080` screen size. Avoid absolute pixel margins for major layouts.
    - For the React Native TVOS app, all sizes are defined in **dp** (density-independent pixels), which Android automatically scales based on the screen's pixel density, ensuring icons and text look identical on a 32" HD screen and a 70" 4K screen.
*   **Asset Resolution**:
    - The logos and icons are saved in high resolution (min `500px` for main logos) to prevent pixelation on large display panels.

---

## 🏷️ How to Install on LG webOS TV

### Step 1: Connect your PC to the TV
1. Install **Developer Mode** from the LG Content Store on your TV.
2. Open the Developer Mode app, log in with your LG Developer Account, and toggle **Dev Mode ON** and **Key Server ON**.
3. Install the webOS CLI on your computer:
   ```bash
   npm install -g @webos-tools/cli
   ```
4. Register the TV on your PC (replace `tv` with your device name, and input the IP/passphrase shown in the Dev Mode app):
   ```bash
   ares-setup-device
   ```

### Step 2: Build & Install
Run the configured package scripts in the project directory:
```bash
# Package the web app into an .ipk file
npm run webos:package

# Install the package onto the TV
npm run webos:install
```

### Step 3: Launch
Launch the app directly from your terminal or select **Castify TV** from the LG launcher bar:
```bash
npx ares-launch --device tv com.castifytv.app
```