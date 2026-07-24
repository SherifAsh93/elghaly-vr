# Project Overview

**elghaly-vr** is a browser-based, mobile-first room color visualizer. A user opens the app on their phone, points the rear camera at any wall, taps to sample the exact paint color from that surface, then instantly previews the color applied to a fully furnished, photorealistic 3D living room — all without any sign-up, server, or file upload. The entire pipeline runs 100% client-side in the browser.

The product solves a concrete pain point: picking a wall paint shade from a physical swatch is unreliable. This app lets anyone standing in front of their own wall see the color previewed on a realistic 3D room within two taps.

---

## Features

- Rear-facing webcam stream (mobile `facingMode: environment`)
- Pixel-exact color sampling via HTML5 Canvas `getImageData` with DPI-scale correction
- Real-time color swatch display with hex value at point of tap
- One-tap mode switch from camera → 3D room preview
- Fully procedural 3D living room (no GLB download — zero network cost):
  - Hardwood floor with procedural wood grain texture
  - Wainscoting with procedural panel texture
  - Upper wall surfaces painted in the sampled color
  - Chair rail, crown molding, and baseboard trim (gold)
  - Window with glass pane and cross dividers
  - Sofa with seat, back, armrests, cushions, and throw pillow
  - Coffee table with decorative vase
  - Side table with floor lamp
  - Ceiling light fixture with emissive glow
- 6-light cinematic rig: ambient, key directional, warm fill, 2 ceiling points, window spotlight, lamp point light
- ACES filmic tone mapping + SRGB output for accurate color representation
- Orbital camera (OrbitControls) with restricted polar angles — mobile-optimized
- Contact shadows via Drei
- "Retake" button to return to camera mode and resample

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.1.1 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5 (strict) |
| Styling | Tailwind CSS | v4 |
| 3D engine | Three.js | 0.182.0 |
| React 3D binding | React Three Fiber | 9.5.0 |
| 3D helpers | Drei | 10.7.7 |
| Webcam access | react-webcam | 7.2.0 |
| Build | Turbopack (Next.js 16 default) | — |
| Deployment | Vercel (auto-deploy on push to main) | — |

**No backend. No database. No API routes. No authentication. No environment variables.**

---

## Folder Structure

```
elghaly-vr/
├── app/
│   ├── layout.tsx          # Root layout — sets page title and Geist fonts
│   ├── page.tsx            # Entire app (single file): MobileColorPicker + Room components
│   ├── globals.css         # Tailwind CSS v4 base styles
│   └── favicon.ico
├── docs/
│   ├── 01_Project_Overview.md
│   ├── 02_Architecture.md
│   ├── 03_Tech_Stack.md
│   ├── 04_Coding_Standards.md
│   ├── 05_UI_Patterns.md
│   ├── 06_Backend_Patterns.md
│   ├── 07_Database.md
│   ├── 08_API_Reference.md
│   ├── 09_Development_Workflow.md
│   └── 10_AI_Implementation_Guide.md
├── public/
│   └── room.glb            # Reference GLB (unused at runtime — procedural path chosen)
├── screenshots/            # Local test artifacts — gitignored
├── next.config.ts          # Minimal Next.js config (no overrides needed)
├── postcss.config.mjs      # Tailwind CSS v4 PostCSS plugin
├── tsconfig.json
├── package.json
└── PROJECT_CONTEXT.md      # This file
```

---

## Database

None. There is no database, no persistence layer, and no server-side state. All data (sampled color, mode, tap position) lives in React component state and is discarded when the tab closes.

---

## Environment Variables

None required. The app has no secrets, API keys, or backend configuration. No `.env.local` file is needed for local development or deployment.

---

## Local Development

```bash
git clone https://github.com/SherifAsh93/elghaly-vr.git
cd elghaly-vr
npm install
npm run dev
```

App runs at `http://localhost:3000`. Webcam access works on `localhost` without HTTPS — browsers whitelist localhost for `getUserMedia`.

**Testing on a physical phone (required for real color sampling):**

```bash
npm run dev -- --hostname 0.0.0.0
# then visit https://<your-local-ip>:3000 from the phone
# OR use ngrok / cloudflared for an HTTPS tunnel
```

HTTPS is required for camera access on non-localhost origins.

---

## Deployment

- **Platform:** Vercel
- **Live URL:** https://elghaly-vr.vercel.app (check Vercel dashboard for current URL)
- **Trigger:** Every push to `main` triggers an automatic Vercel build and production deploy
- **Build command:** `next build` (Vercel default, no override)
- **Output directory:** `.next` (Vercel default)
- **Environment variables:** None required in Vercel dashboard
- **PM2:** Not used — this is a Vercel serverless deployment, not a VPS app

To deploy manually:
```bash
npx vercel          # preview
npx vercel --prod   # production
```

---

## Current Status

**LIVE** — Build passes cleanly. Vercel auto-deploys on every push to main.

Build verified 2026-07-24:
- Next.js 16.1.1 Turbopack build: PASS (compiled in ~119s)
- TypeScript: PASS (no errors)
- Static pages: 4/4 generated successfully
- No blocking errors or warnings

---

## Known Issues

- Build time is ~2 minutes using Turbopack on first compile (cold cache). Warm builds are faster.
- Camera mode requires HTTPS on non-localhost — testing on a local network phone requires a tunnel tool (ngrok, cloudflared).
- The `public/room.glb` file exists but is unused. It adds weight to the repo (not to the app at runtime).
- On very low-end Android devices (pre-2020 hardware), the 6-light WebGL scene may drop below 30 fps.

---

## Future Improvements

- Add multiple room templates (bedroom, kitchen, hallway) switchable from the VR toolbar
- Support saving/sharing a color pick as an image (canvas `toDataURL` export)
- Add a color history strip showing the last 5 sampled colors
- Add smooth animated transition between camera and VR mode
- Integrate a paint brand database to suggest the nearest Jotun / Sigma / Dulux product for a sampled hex
- Add ambient occlusion via Drei's `BakeShadows` for better depth perception on static room elements
- Support landscape orientation on tablets with a side-by-side camera + room layout

---

## Reusable Assets

| Asset | Location | Notes |
|---|---|---|
| `makeFloorTex()` | `app/page.tsx` | Procedural hardwood floor — no external texture file needed |
| `makeWainscotTex()` | `app/page.tsx` | Procedural wainscoting panel texture |
| `<Room>` component | `app/page.tsx` | Complete furnished living room in ~270 lines; portable to any Three.js project |
| Color pick logic (`pickColor`) | `app/page.tsx` | DPI-corrected pixel sampling from a video element; reusable for any webcam color picker |
| 6-light rig (ambient + directional + point + spot) | `app/page.tsx` | Cinematic lighting setup — good template for interior visualization |

---

## Lessons Learned

- **Procedural geometry beats GLB for color-reactive UIs.** A 23 MB GLB with per-material traversal is slower and more fragile than constructing meshes in code with direct material references.
- **Three.js materials must be memoized.** Creating a `new THREE.MeshStandardMaterial(...)` inside a React render body leaks GPU memory on every re-render. All materials and textures must live in `useMemo`.
- **Mutate, don't recreate.** For reactive color changes, `material.color.set(hex); material.needsUpdate = true` is far cheaper than replacing the material object.
- **`convertSRGBToLinear()` is required.** Without it, colors set from CSS hex values appear washed out under Three.js's linear color pipeline + ACES tone mapping.
- **Next.js 16 Turbopack is cold-start heavy.** First build takes ~2 minutes. Not a runtime issue but matters for CI/CD timing expectations.
- **Camera permission is UX-critical.** The app silently fails if the user denies camera access. A visible permission-denied state with instructions would improve onboarding.

---

## WebistryDev Metadata

- **Category:** Interactive Tool / Real Estate & Interior Design Tech / AR/VR Adjacent
- **Complexity:** Medium (single-file app but requires 3D, WebGL, and webcam pipeline knowledge)
- **Template Candidate:** Yes — the `makeFloorTex`, `makeWainscotTex`, `<Room>`, and `pickColor` utilities are all reusable in other interior visualization projects
- **Priority:** Active (live on Vercel; client-facing demo tool)
- **Reusable Modules:**
  - Procedural floor texture generator
  - Procedural wainscoting panel texture generator
  - Webcam DPI-corrected pixel sampler
  - Furnished 3D living room component (React Three Fiber)
  - 6-light cinematic interior lighting rig
  - Two-mode (camera/VR) mobile app shell pattern
- **Similar Projects:**
  - `/home/sherif/sites/Montelle` — luxury ecommerce with Vercel/Neon stack
  - `/home/sherif/sites/zahrtelkhlig` — mobile-first ecommerce on Vercel
  - `/home/sherif/sites/qoya` or `Qoya-Furniture` — furniture brand site (closest thematic match: interior/furniture)
