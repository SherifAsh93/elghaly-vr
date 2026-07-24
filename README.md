# Elghaly VR — Room Color Visualizer

A mobile-first browser app that lets you point your phone camera at any wall, tap to sample the exact paint color, and instantly preview it on a fully furnished 3D living room — with no sign-up, no server, and no file uploads.

**Live:** [elghaly-vr.vercel.app](https://elghaly-vr.vercel.app)

---

## How It Works

1. **Camera mode** — Open the app on your phone. The rear camera activates. Tap any wall surface.
2. **Color sampling** — The app reads the exact pixel color at your tap using HTML5 Canvas `getImageData` with DPI correction.
3. **VR preview** — Tap "Preview Room" to enter a 3D living room with your sampled color applied to all walls in real-time.
4. **Orbit** — Drag to rotate the camera around the room and see the color from any angle.
5. **Retake** — Tap "Retake" to go back and sample a different color.

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack, TypeScript)
- **React 19**
- **Three.js 0.182** via React Three Fiber + Drei
- **react-webcam** for rear-camera access
- **Tailwind CSS v4**
- **Vercel** for deployment

No backend. No database. No environment variables required.

---

## Local Development

```bash
git clone https://github.com/SherifAsh93/elghaly-vr.git
cd elghaly-vr
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Webcam works on localhost without HTTPS.

**Testing on a physical phone:**
```bash
npm run dev -- --hostname 0.0.0.0
# Then visit http://<your-local-ip>:3000 from the phone
# Or use ngrok for HTTPS (required for camera on non-localhost)
```

---

## Build

```bash
npm run build   # Turbopack production build (~2 min cold, faster warm)
npm start       # Start production server
```

---

## Deployment

Every push to `main` auto-deploys to Vercel. No environment variables needed in the Vercel dashboard.

```bash
npx vercel          # Preview deploy
npx vercel --prod   # Production deploy
```

---

## Project Structure

```
app/
  page.tsx      # Full app: MobileColorPicker + Room (3D scene)
  layout.tsx    # Root layout with metadata
  globals.css   # Tailwind base
docs/           # Detailed technical documentation (10 files)
public/
  room.glb      # Reference GLB (unused — procedural geometry used instead)
```

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for full technical documentation, architecture decisions, and WebistryDev metadata.
