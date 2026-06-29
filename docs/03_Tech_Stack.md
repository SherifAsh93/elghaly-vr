# 03 — Tech Stack

## Next.js 16

The app uses Next.js as the framework shell. In practice, only the App Router's file-based routing and automatic bundling are used — there are no server components, server actions, API routes, or middleware. `app/page.tsx` is marked `"use client"` implicitly by its use of `useState`, `useRef`, `useCallback`, and `useEffect`.

`next.config.ts` is minimal with no special configuration. The `"use client"` directive is not explicitly written at the top of `page.tsx` — Next.js infers client boundary from React hooks usage in App Router.

**Why Next.js over plain Vite/CRA?** Vercel first-class support: zero-config deploys, edge CDN, automatic preview URLs on every push, and the Vercel Analytics injection — all without any build configuration.

---

## React 19

React 19 is used as the rendering layer. No React 19-specific features (Actions, `use()`, form enhancements) are used. The codebase relies on stable React 18 patterns: `useState`, `useRef`, `useMemo`, `useCallback`, `useEffect`. The version bump is a baseline choice that keeps the dependency graph current.

---

## TypeScript 5 (Strict Mode)

`tsconfig.json` sets `"strict": true` with `"target": "ES2017"`. The ES2017 target ensures broad browser compatibility, including older Android WebView versions likely to encounter a PWA-style mobile app.

TypeScript is used for:
- Typing the `Webcam` ref: `useRef<Webcam>(null)`
- Typing mode state: `useState<"camera" | "vr">("camera")`
- Dual event handler signature: `(e: MouseEvent<HTMLVideoElement> | TouchEvent<HTMLVideoElement>) => void`

Three.js types come from `@types/three` (bundled with Three.js 0.182.0 as first-party types).

---

## Tailwind CSS v4

Tailwind v4 is imported via a single `@import "tailwindcss"` in `globals.css`. The v4 engine requires no `tailwind.config.js` — it scans files automatically.

No custom design tokens are defined. All styling uses utility classes directly. Key utilities used in this app:

- `backdrop-blur-md` — glass-morphic panels
- `rounded-3xl` — pill-shaped buttons and cards
- `active:scale-95` — tap feedback
- `bg-white/80`, `bg-black/40` — alpha overlays
- `transition-all`, `duration-300` — smooth show/hide
- `fixed inset-0` — full-screen overlays

---

## Three.js 0.182.0

Three.js is the core 3D engine. It handles:
- Scene graph management
- WebGL context
- Material system (`MeshStandardMaterial`)
- Geometry primitives (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`)
- Canvas-based texture generation (`CanvasTexture`)
- Shadow mapping
- Tone mapping

Three.js is never used directly in JSX — all Three.js object creation goes through React Three Fiber's JSX bridge or is placed in `useMemo` hooks.

---

## React Three Fiber 9.5.0

React Three Fiber (R3F) wraps Three.js in React's component model. Instead of imperative `scene.add(mesh)` calls, the scene is declared as JSX:

```tsx
<mesh position={[0, 0, 0]}>
  <boxGeometry args={[7, 0.05, 5.5]} />
  <primitive object={floorMat} attach="material" />
</mesh>
```

**Why R3F over raw Three.js?**

1. **React state integration** — `wallColor` is a React prop. Without R3F, updating the material would require an imperative `ref` to the Three.js scene. With R3F, `useEffect([wallColor, paintMat])` fits naturally into React's lifecycle.
2. **Reconciler-managed lifecycle** — R3F disposes Three.js objects automatically when components unmount, preventing GPU memory leaks.
3. **`<Canvas>` setup** — camera, renderer, animation loop, resize handling, and WebGL context are all managed by R3F's `<Canvas>` component.

The `<Canvas>` is configured with:
```tsx
<Canvas
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  toneMapping={THREE.ACESFilmicToneMapping}
  toneMappingExposure={1.1}
  outputColorSpace={THREE.SRGBColorSpace}
  dpr={[1, 1.5]}
  shadows
  camera={{ fov: 52, position: [2.8, 1.65, 2.6] }}
>
```

---

## Drei 10.7.7

Drei is the official R3F helper library. Two Drei components are used:

### `<OrbitControls>`

Provides mouse/touch-driven camera orbit around a target point. Configured with:

```tsx
<OrbitControls
  target={[0, 1.3, -1.2]}
  minPolarAngle={Math.PI / 6}
  maxPolarAngle={Math.PI / 2.05}
  minDistance={1.5}
  maxDistance={5.5}
  enablePan={false}
/>
```

- **`target`**: Points at the sofa, keeping it centered in every orbit
- **`minPolarAngle / maxPolarAngle`**: Prevents looking from below the floor or too steeply downward — essential for mobile UX where accidental swipes are common
- **`enablePan: false`**: Prevents translating the camera, which would let users escape the room scene

**Why Drei over a custom OrbitControls?** Drei's implementation handles touch events, pointer lock, wheel zoom, and damping out of the box. Implementing this correctly for both mouse and touch is non-trivial.

### `<ContactShadows>`

Renders soft baked shadows on the floor under furniture:

```tsx
<ContactShadows opacity={0.35} scale={9} blur={2.5} far={1.8} />
```

`ContactShadows` uses a downward-looking orthographic camera with a blur pass. It is faster than per-light shadow maps for floor contact shadows and produces softer, more realistic results.

---

## react-webcam 7.2.0

Provides the `<Webcam>` component and a typed `ref` that exposes `webcamRef.current.video` — a direct reference to the underlying `<video>` HTMLElement.

**Why react-webcam?**

1. **Ref-based video access** — `pickColor` needs to call `ctx.drawImage(video, ...)`. Direct DOM access to the `<video>` element is required.
2. **`facingMode: "environment"`** — the `videoConstraints` prop cleanly maps to `getUserMedia` constraints, requesting the rear camera on mobile.
3. **Correct lifecycle** — handles `getUserMedia` permission flow, stream teardown on unmount, and browser differences.

---

## Tone Mapping: ACES Filmic

`THREE.ACESFilmicToneMapping` is set on the renderer with `exposure: 1.1`.

ACES (Academy Color Encoding System) is the industry-standard tone mapping used in film post-production and game engines (Unreal Engine default). For interior visualization specifically:

- **Warm highlights** — slightly yellows bright areas, matching natural tungsten/LED lighting
- **Preserves shadow detail** — S-curve contrast keeps dark corners visible
- **Avoids clipping** — HDR light values compress gracefully instead of blowing out

The alternative (`LinearToneMapping` or none) produces flat, blown-out results with multiple point lights in a small room.

---

## DPR Strategy: `[1, 1.5]`

`dpr={[1, 1.5]}` tells R3F to use `Math.min(window.devicePixelRatio, 1.5)` as the renderer's pixel ratio.

- **Why not `dpr={2}`?** A full 2× DPR on a 428px-wide iPhone 14 Pro means rendering at 856px internally. In a complex scene with 6 lights and shadows, this adds significant GPU load.
- **Why not `dpr={1}`?** The room would look blurry on modern Retina screens.
- **`[1, 1.5]`** caps at 1.5× as a balanced trade-off: noticeably crisper than 1× without the GPU cost of 2×.

---

## Color Space: `THREE.SRGBColorSpace`

Setting `outputColorSpace = THREE.SRGBColorSpace` tells Three.js to apply gamma correction when writing to the WebGL canvas. The browser display expects sRGB output. Without this, rendered colors appear washed out.

The `convertSRGBToLinear()` call in the color update effect is the inverse step: hex colors from the webcam are in sRGB space, but Three.js materials work in linear space internally. The conversion ensures the sampled color is reproduced accurately in the final render.
