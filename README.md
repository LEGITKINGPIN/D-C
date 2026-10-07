# D&C MediaHouse Web Platform

![Project Banner](https://img.shields.io/badge/Project-Premium_Portfolio-C5A059?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Sanity](https://img.shields.io/badge/Sanity-F03E2F?style=for-the-badge&logo=sanity&logoColor=white)
![Mux Video](https://img.shields.io/badge/Mux-Video_Streaming-F8F5F0?style=for-the-badge)

## 📌 Overview

**D&C MediaHouse** is a premium, full-stack portfolio web application built for a creative media production agency. Designed with a focus on immersive visual storytelling, the platform features a cinematic, high-performance video streaming experience, smooth micro-animations, and a fully dynamic Headless CMS architecture.

This project was developed to showcase high-quality video content (commercials, films, director's cuts) with zero compromise on web performance and user experience.

---

## 🚀 Tech Stack

### Frontend Architecture
* **Framework:** Next.js (App Router)
* **Library:** React 19
* **Styling:** Tailwind CSS (with custom design system & tokens)
* **Animations:** Framer Motion (Layout animations, AnimatePresence, micro-interactions)
* **Typography:** Custom fonts (Playfair Display, Inter, Geist)

### Backend & CMS
* **Headless CMS:** Sanity Studio v3
* **Data Fetching:** GROQ queries, `@sanity/client`
* **Media Handling:** Mux (Adaptive Bitrate HLS Video Streaming)

### Performance & Utilities
* **Video Playback:** `hls.js` (Custom video player component for optimized HLS playback), `@mux/mux-player-react`
* **Viewport Tracking:** `react-intersection-observer` (for lazy loading and hover-to-play mechanics)
* **Class Merging:** `clsx`, `tailwind-merge`

---

## ✨ Key Features & Technical Implementations

### 1. Immersive Cinematic Mode (Custom Idle Detection)
* Developed a custom `useIdleTimer` hook that tracks user inactivity (mouse movement, scrolling, touch events).
* When idle, the platform enters "Cinematic Mode": UI elements seamlessly fade out, and the background video volume dynamically fades in for a distraction-free, immersive viewing experience.

### 2. High-Performance HLS Video Streaming
* Engineered a custom `<HlsVideo />` wrapper around native HTML5 video using `hls.js`.
* Features advanced buffering strategies (prefetching, max buffer sizes) to ensure sub-3-second startup times and zero buffering during playback, even on slower networks.
* Integrated with **Mux** to serve adaptive bitrate `.m3u8` streams.

### 3. Dynamic Headless CMS Integration
* Configured a custom **Sanity Studio** backend to manage all platform content dynamically.
* Client can independently upload high-res videos (via Mux plugin), update portfolio items, manage brand carousels, and categorize projects without touching the codebase.

### 4. Interactive Portfolio Grid & Lazy Loading
* Implemented a responsive masonry/grid layout for the portfolio section.
* Used `react-intersection-observer` to **lazy-load video sources** only when they enter the viewport, drastically reducing initial page load times and memory consumption.
* Features a "Hover-to-Play" mechanic for video thumbnails on desktop, and a scroll-triggered play mechanic for mobile devices.

### 5. Premium UI/UX & Animations
* Crafted a luxury aesthetic using a curated color palette (Dark Charcoal `#2D2926`, Gold `#C5A059`, and Off-White `#F8F5F0`).
* Extensive use of **Framer Motion** for stagger animations, modal pop-ups, and smooth page transitions.
* Custom mobile navigation with backdrop blurs (glassmorphism) and intuitive touch controls.

---

## 📂 Repository Structure

The project is structured as a monorepo containing both the frontend application and the CMS studio:

```bash
├── D&C/                    # Next.js Frontend Application
│   ├── src/
│   │   ├── app/            # Next.js App Router (Pages & Layouts)
│   │   ├── components/     # Reusable UI Components (Hero, Navbar, Grid)
│   │   ├── hooks/          # Custom React Hooks (IdleTimer, Sanity Fetching)
│   │   └── lib/            # Utility functions & Sanity client config
├── studio-d&c-mediahouse/  # Sanity CMS Backend
│   ├── schemas/            # Data models (Projects, Brands, etc.)
│   └── sanity.config.ts    # Studio configuration
└── README.md               # Project documentation
```

---

## 🛠️ Local Development Setup

### 1. Clone the repository
```bash
git clone <repository-url>
cd "D&C MEDIAHOUSE"
```

### 2. Setup the Frontend (Next.js)
```bash
cd D&C
npm install
# Create a .env.local file and add your Sanity & Mux credentials
npm run dev
```
*Frontend runs on http://localhost:3000*

### 3. Setup the CMS (Sanity Studio)
Open a new terminal window:
```bash
cd studio-d&c-mediahouse
npm install
npm run dev
```
*Sanity Studio runs on http://localhost:3333*

---

## 💼 Resume / CV Highlights

*If you are adding this project to your CV, here are some bullet points you can use:*

*   **Engineered a premium, full-stack portfolio platform** using Next.js, React, and Tailwind CSS, delivering a highly visual and immersive user experience for a media production agency.
*   **Integrated Mux and hls.js** to build a custom adaptive bitrate video player, optimizing buffer lengths and reducing initial load times for heavy video assets.
*   **Developed a custom "Cinematic Mode"** utilizing React hooks and event listeners to track user idle time, automatically fading UI elements and audio for distraction-free viewing.
*   **Architected a headless CMS backend** with Sanity Studio, allowing non-technical users to dynamically manage portfolio content, video streams, and brand assets.
*   **Optimized web performance** by implementing lazy loading with intersection observers, ensuring video sources are only fetched when near the viewport, drastically improving the Lighthouse performance score.
*   **Crafted smooth micro-interactions and layout transitions** using Framer Motion, resulting in a luxury, responsive UI across desktop and mobile devices.

---

*Designed and developed for D&C MediaHouse.*
