# RETHA Real Estate — ريثا العقارية 🏛️✨

An Arabian Luxury Real Estate Web Application & 3D Architectural Showcase, officially certified by the Saudi General Real Estate Authority (الهيئة العامة للعقار — FAL #1200033904).

Discover exclusive villas, sky penthouses, corporate towers, and prime investment land in Riyadh with real-time interactive mapping, cinematic 3D scroll experiences, and Supabase-powered live property updates.

---

## 🌟 Key Features

- **3D Cinematic Architecture & Scroll Canvas**: Three.js & GSAP powered interactive 3D vision showcase with responsive frame scrubber.
- **Interactive Multi-District Map**: Leaflet & MarkerCluster Riyadh district navigation with luxury gold markers and quick property previews.
- **Bilingual Arabic & English (RTL/LTR)**: Instant one-click toggle with native typography (`Tajawal`, `Cinzel`, `Cormorant Garamond`).
- **Live REGA Registry Updates**: Supabase real-time notifications for live property reservation and status changes.
- **Exclusive Administrative Suite**: Private `/admin` dashboard and `/admin/login` portal for authorized portfolio management.
- **Fully Responsive & Luxury Aesthetic**: Curated glassmorphism design system optimized for mobile, tablet, and desktop viewports.

---

## 🚀 Tech Stack

- **Frontend Core**: Vanilla JavaScript (ES Modules), HTML5, CSS3 Custom Properties (Design System)
- **3D Graphics & Animations**: [Three.js](https://threejs.org/), [GSAP](https://greensock.com/gsap/)
- **Mapping Engine**: [Leaflet](https://leafletjs.com/), Leaflet MarkerCluster
- **Backend & Realtime**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime subscriptions, Edge Functions)
- **Bundler & Tooling**: [Vite 8](https://vitejs.dev/)
- **Deployment**: [Vercel](https://vercel.com/) (configured via `vercel.json`)

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Node.js**: `v18+` or `v20+`
- **npm**: `v9+`

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
*(The client also includes resilient fallbacks for seamless out-of-the-box preview).*

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Production Build
```bash
npm run build
```
Preview production bundle:
```bash
npm run preview
```

---

## ⚡ Deploying to Vercel

This repository is pre-configured and optimized for 1-click deployment on Vercel:

1. Import this repository into your [Vercel Dashboard](https://vercel.com/new).
2. Framework preset will automatically be detected as **Vite**.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**. Multi-page routing (`/`, `/admin`, `/admin/login`) is handled automatically via `vercel.json`.

---

## 📄 License

Proprietary © RETHA Real Estate (ريثا العقارية). All rights reserved.
