# 09 — Development Workflow

## Environment Setup

No environment variables are required. There is no `.env.local`, no `.env.example`, and no secrets to provision.

```bash
git clone <repo-url>
cd elghaly-vr
npm install
npm run dev
```

The app is available at `http://localhost:3000`. Webcam access requires HTTPS or `localhost` — `localhost` is whitelisted by all major browsers for `getUserMedia`, so development on port 3000 works without a self-signed certificate.

**To test on a phone while developing:** Use `npm run dev -- --hostname 0.0.0.0` to bind to all interfaces, then access `https://<your-local-ip>:3000` from the phone. Modern browsers require HTTPS for camera access on non-localhost origins — use a tool like `ngrok` or `cloudflared tunnel` for a quick HTTPS tunnel during development.

---

## Vercel Deployment

The project is linked to Vercel via `.vercel/project.json`. Every push to the main branch triggers an automatic Vercel build and deploy. No CI configuration files are needed.

```bash
# Deploy manually (preview)
npx vercel

# Deploy to production
npx vercel --prod
```

Build command: `next build` (Vercel default — no override needed)
Output directory: `.next` (Vercel default)
No environment variables to configure in the Vercel dashboard.

---

## How to Modify Room Dimensions

Room dimensions are defined as constants at the top of the `<Room>` component in `app/page.tsx`:

```ts
const W = 7;      // room width in meters
const D = 5.5;    // room depth in meters
const H = 3.2;    // room height in meters
```

Every mesh in the room is derived from these three values. Changing `W` from `7` to `8` widens the room, floor, ceiling, all four walls, wainscoting, trim, and the window proportionally — because all geometry arguments reference `W`, `D`, or `H` arithmetically.

Example: the floor mesh is `<boxGeometry args={[W, 0.05, D]} />`. The ceiling is at `position-y={H}`. The back wall is at `position-z={-D/2}`.

If you change dimensions, also review:
- Window position: `position-z={-D/2 + 0.02}` — tied to `D`
- Camera initial position: `[2.8, 1.65, 2.6]` — may need adjustment for a much larger/smaller room
- OrbitControls `maxDistance: 5.5` — should be roughly `max(W, D) * 0.8` to keep the room framed
- ContactShadows `scale: 9` — should cover the floor

---

## How to Change Furniture

All furniture is procedural geometry positioned manually. The sofa is built from individual `<mesh>` elements with `boxGeometry`:

```
Sofa:
  seat:     position=[0, 0.22, -0.6],  args=[2.2, 0.44, 0.9]
  back:     position=[0, 0.72, -1.02], args=[2.2, 0.58, 0.14]
  armL:     position=[-1.06, 0.46, -0.6], args=[0.08, 0.5, 0.9]
  armR:     position=[ 1.06, 0.46, -0.6], args=[0.08, 0.5, 0.9]
  cushions: 3 × position=[±0.73/0, 0.53, -0.6], args=[0.65, 0.14, 0.82]
  pillow:   position=[0.72, 0.67, -0.67], args=[0.28, 0.22, 0.08]
```

To move the sofa, change the `position` attributes. To resize, change `args`. All positions are in meters, with Y=0 at the floor surface.

To add a new furniture piece, add new `<mesh>` elements inside the `<Room>` component's JSX return, using existing materials (`floorMat`, `paintMat`, etc.) or new materials defined in `useMemo`.

---

## How to Add a New Material Type

1. Define the material in a `useMemo` inside `<Room>`:

```ts
const newMat = useMemo(
  () => new THREE.MeshStandardMaterial({
    color: '#8B6914',
    roughness: 0.6,
    metalness: 0.2,
  }),
  []
);
```

2. Use it in a mesh:

```tsx
<mesh position={[0, 0.5, 0]}>
  <boxGeometry args={[1, 1, 1]} />
  <primitive object={newMat} attach="material" />
</mesh>
```

3. If the material color should respond to user input (like `paintMat`), add a `useEffect`:

```ts
useEffect(() => {
  newMat.color.set(someColor).convertSRGBToLinear();
  newMat.needsUpdate = true;
}, [someColor, newMat]);
```

Do NOT add the material to a `useEffect` that runs on every frame — only update when the source value changes.

---

## How to Change the Initial Color

The default wall color is set in the `useState` initializer in `MobileColorPicker`:

```ts
const [color, setColor] = useState("#D4C5A9");
```

Change `"#D4C5A9"` to any valid 6-digit hex string. The room will open with that color in VR mode. The `paintMat` `useEffect` fires after mount with the initial value, so the color is applied correctly on first render.

---

## How to Load the GLB Model (If Needed)

The `public/room.glb` file exists but is currently unused. To switch from procedural geometry to the GLB:

1. Install the dependency (already present as a Drei dep): `useGLTF` from `@react-three/drei`
2. Replace the `<Room>` component body:

```tsx
import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";

function Room({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name === "WallPaint") {
        (child.material as THREE.MeshStandardMaterial).color
          .set(wallColor)
          .convertSRGBToLinear();
        (child.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });
  }, [wallColor, scene]);

  return <primitive object={scene} />;
}

// In the Canvas JSX:
<Suspense fallback={<mesh><boxGeometry /><meshStandardMaterial color="gray" /></mesh>}>
  <Room wallColor={color} />
</Suspense>
```

**Caveats with the GLB approach:**
- The 23 MB file will block on slow mobile connections
- Material names must match exactly what was set in Blender
- The `scene.traverse` pattern is fragile (mesh names can drift between Blender exports)
- A `<Suspense>` boundary with a visible fallback is required

These are the reasons the procedural approach was chosen originally.

---

## Performance Testing on Mobile

The most important performance metric for this app is **frame rate in VR mode on mid-range Android devices**.

To test:
1. Open Chrome DevTools → More tools → Remote devices
2. Connect the phone via USB and enable USB debugging
3. Open the Vercel preview URL on the phone
4. In DevTools, open the Performance tab and record while orbiting the room

Target metrics:
- **60 fps** on flagship devices (iPhone 14+, Pixel 7+)
- **≥ 30 fps** on mid-range devices (Android 2021–2023 class hardware)

If frame rate drops:
- Reduce shadow map resolution: `<directionalLight shadow-mapSize-width={512} shadow-mapSize-height={512} />` (currently 1024×1024)
- Reduce `dpr` ceiling from `[1, 1.5]` to `[1, 1.2]`
- Disable `ContactShadows`
- Reduce point light count (currently 4 point lights + 1 spot light — consider removing the two ceiling point lights and relying on the directional key light)

---

## Adding a Linter Rule

`eslint.config.mjs` contains the default Next.js ESLint config. To enforce the Three.js memoization rules, add:

```js
rules: {
  // Warn if a variable named *Mat or *Tex is assigned outside useMemo
  // (requires a custom ESLint plugin — not currently installed)
}
```

In practice, code review is sufficient enforcement for a 1-file project. The rules in `04_Coding_Standards.md` describe the patterns; `eslint-plugin-react-hooks` (`exhaustive-deps`) already enforces the dependency array rules.
