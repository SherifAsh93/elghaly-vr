# 01 — Project Overview

## What This Project Is

**elghaly-vr** is a real-time 3D room color visualizer that runs entirely in the browser. A user points their phone camera at a wall, taps to sample the color, and is immediately transported into a fully rendered 3D living room painted in that exact color. No sign-up, no server, no file upload — the entire pipeline runs client-side.

The product solves a concrete UX problem: paint-shade selection is notoriously hard to visualize from a swatch. This app lets anyone standing in front of an existing wall preview the color in a furnished 3D room within two taps.

---

## Core Features

| Feature | Implementation |
|---|---|
| Rear-facing webcam stream | `react-webcam` with `facingMode: "environment"` |
| Pixel-exact color extraction | HTML5 Canvas `getImageData` at tap/click coordinates, DPI-corrected |
| Procedural 3D room | Three.js geometry constructed entirely in code (no model file at runtime) |
| Six material types | Floor (wood texture), wainscoting (panel texture), upper wall paint, trim (gold), ceiling, glass window |
| Real-time paint preview | Hex string passed as prop → `paintMat.color.set(hex)` → `convertSRGBToLinear()` → `needsUpdate = true` |
| Orbital camera | Drei `OrbitControls` with restricted polar angles and distance — mobile-optimized |
| Cinematic lighting | 6-light rig: ambient, key directional, warm fill, 2 ceiling points, window spotlight |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16 |
| UI library | React | 19 |
| Language | TypeScript | 5 (strict mode) |
| Styling | Tailwind CSS | v4 |
| 3D engine | Three.js | 0.182.0 |
| React 3D binding | React Three Fiber | 9.5.0 |
| 3D helpers | Drei | 10.7.7 |
| Webcam access | react-webcam | 7.2.0 |
| Deployment | Vercel | (linked via `.vercel/project.json`) |

**No backend.** No database. No API routes. No environment variables. No authentication.

---

## Folder Structure

```
elghaly-vr/
├── app/
│   ├── page.tsx          ← ENTIRE APPLICATION (19.2 KB)
│   ├── layout.tsx        ← Geist fonts, metadata, html/body wrapper
│   ├── globals.css       ← Tailwind v4 @import + Geist variable setup
│   └── favicon.ico
├── public/
│   ├── room.glb          ← 23 MB model file — NOT USED AT RUNTIME
│   └── images/           ← Reference photos (2.jpg, 3.jpg, room-360.jpg, wood-room.jpg)
├── .vercel/
│   └── project.json      ← Vercel project + org ID for CLI linking
├── next.config.ts        ← Minimal — no special Next.js config needed
├── tsconfig.json         ← Strict TypeScript, target ES2017
└── package.json
```

### Why `public/room.glb` exists but is not used

During development, a GLB model of the room was explored as an alternative to procedural geometry. The procedural approach was chosen because it:

1. Requires no network download (the GLB is 23 MB — unacceptable on mobile)
2. Allows instant, deterministic color updates without re-loading material slots
3. Makes every dimension and surface a named variable in code, not a mesh name to hunt for inside Blender

The file was left in `public/` but is never referenced in any import or `useGLTF` call.

---

## Why Everything Lives in One File

`app/page.tsx` contains the entire application: two texture factory functions, the `Room` component, and the root `MobileColorPicker` component. This is a deliberate decision for a project of this scope:

- **No shared state between pages** — there is only one page
- **No reusable components** — `Room` is only ever rendered here; extracting it gains nothing
- **Co-location of tightly coupled logic** — the `pickColor` callback, the `color` state, and the `Room` prop are all read in one eyeful
- **Zero import overhead** — no barrel files, no circular dependency risk

If the project grows to include additional rooms or a saved-palette feature, splitting into `components/Room.tsx`, `components/ColorPicker.tsx`, and `hooks/useColorPicker.ts` would be the natural first refactor.

---

## Live Deployment

The project is deployed on Vercel. Pushes to the main branch auto-deploy. No build-time environment variables are required. The `vercel` CLI project link is stored in `.vercel/project.json`.
