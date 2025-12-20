# 🌌 Movie Galaxy: A Spatial Discovery Engine
<img width="996" height="635" alt="Movie_Globe" src="https://github.com/user-attachments/assets/1e991200-7b75-46f1-8cbd-fea0a09c8d16" />

![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.dot-js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

> **"Stop scrolling. Start Warping."** > Movie Galaxy is a WebGL-powered spatial interface that transforms the static TMDB database into an immersive, interactive nebula.

---

## 🛠 The Architecture of the Void

Most movie apps are flat lists. **Movie Galaxy** uses a Fibonacci-sphere distribution algorithm to map titles onto a 3D coordinate system, providing a natural, discovery-based UX.



### 🌌 Core Mechanics

| Feature | Engineering Solution |
| :--- | :--- |
| **The Globe** | Golden-ratio distribution of 3D movie posters using `math.phi`. |
| **Warp Drive** | Lerp-based camera interpolation for seamless scene transitions. |
| **Memory Shield** | Manual `GPU.dispose()` logic to prevent WebGL Context Lost errors. |
| **Glass UI** | High-opacity backdrop blurs (25px) for a "visionOS" aesthetic. |

---

## ✨ Immersive Experience

### 🚀 Warp Navigation
Switching between **Global Discovery** and your **Personal Favorites** uses a "Warp" effect. Instead of a page refresh, the camera FOV (Field of View) expands, creating a hyper-speed visual transition.

### 💎 Glassmorphic HUD
The UI is non-intrusive. It floats on the Z-index above the 3D scene, using real-time backdrop filtering to maintain readability against the glowing stars.

### 🔒 Secure Hangar (Auth)
Powered by Firebase Google Auth. Your favorites aren't just local; they are synced to a real-time Firestore cloud, allowing your "Galaxy" to follow you across devices.

---

## 🔧 Technical Setup (For Developers)

Since this project leverages high-performance post-processing, the following optimizations were implemented:
* **DPR Capping:** Capped at `1.5` to support mobile GPUs without overheating.
* **Antialiasing:** Disabled in favor of custom **Bloom** and **Chromatic Aberration** passes for a cinematic look.
* **Asset Lifecycle:** Textures are cleared from the GPU cache on every "Warp" to ensure 0% memory leakage.

```bash
# Clone the galaxy
git clone [https://github.com/yourusername/movie-galaxy.git](https://github.com/yourusername/movie-galaxy.git)

# Enter the void
cd movie-galaxy

# Install dependencies
npm install

# Launch the engine
npm run dev
