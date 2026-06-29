# 04 — Coding Standards

## Single-File Monolithic Pattern

The entire application lives in `app/page.tsx`. This is intentional and appropriate when all three conditions hold:

1. **One page only** — no other route would share any of these components
2. **No reusable surface** — `Room` is the only consumer of its own materials and geometry
3. **Small total scope** — 19.2 KB is readable in a single sitting

This is NOT a license for monolithic files in general. The rule is: if you find yourself writing `components/Room.tsx` and that file is only ever imported by `page.tsx`, you have added a file without adding value. Refactor when a second consumer emerges or when the file exceeds ~400 lines and the coupling between sections is low.

---

## `useMemo` for Three.js Objects

**Rule: Every Three.js object (material, geometry, texture) must be created inside `useMemo`, never in the render body.**

```ts
// CORRECT
const paintMat = useMemo(
  () => new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.88, metalness: 0 }),
  []  // note: wallColor is NOT a dep — color is updated via useEffect
);

// WRONG — creates a new material on every render
const paintMat = new THREE.MeshStandardMaterial({ color: wallColor });
```

**Why?** Three.js materials are GPU objects. Creating them in the render body means:
- A new GPU texture/program is allocated every render frame
- The previous material is never disposed (memory leak)
- The mesh flickers as the old and new materials race

The empty deps array `[]` is correct for `paintMat` because the color is not set during construction — it is mutated in a `useEffect` afterwards.

---

## `useCallback` for Event Handlers

Event handlers passed to DOM elements must be wrapped in `useCallback` with the appropriate deps array.

```ts
const pickColor = useCallback(
  (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    // ...
  },
  []  // empty deps: no captured state, all values read from refs or event
);
```

**Why empty deps?** `pickColor` reads `webcamRef.current` and `canvasRef.current` — these are refs, not state values. Refs are mutable containers; their `.current` value is always up-to-date without being listed as a dependency. Listing `webcamRef` would be a no-op (the ref object identity never changes) and listing `webcamRef.current` would be incorrect (changes to `.current` do not trigger React re-renders and therefore would not update the callback).

The stable function reference also prevents `<Webcam>` from re-registering its event listener on every render.

---

## `useEffect` for Material Color Sync

Syncing a prop into a mutable Three.js object is the only place `useEffect` is used in this app:

```ts
useEffect(() => {
  paintMat.color.set(wallColor).convertSRGBToLinear();
  paintMat.needsUpdate = true;
}, [wallColor, paintMat]);
```

**Exact deps required:**

- `wallColor` — the hex string prop; the effect must re-run when it changes
- `paintMat` — the material memo; always stable after mount, but included for correctness (ESLint `react-hooks/exhaustive-deps` requires it)

**Why not derive color directly in `useMemo`?**

```ts
// This would NOT work
const paintMat = useMemo(
  () => new THREE.MeshStandardMaterial({ color: wallColor }),
  [wallColor]  // new material on every color change = GPU memory leak
);
```

Listing `wallColor` in the memo deps creates a new `MeshStandardMaterial` object on every color change. The mesh's material reference must then be swapped, which causes a flicker. The `useEffect` mutation pattern avoids this entirely.

---

## TypeScript in a Three.js Context

### Typing Refs

```ts
const webcamRef = useRef<Webcam>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
```

The generic argument must match the DOM element or library class the ref will point to. `Webcam` is the class exported from `react-webcam`. Accessing `webcamRef.current?.video` is type-safe because `Webcam` declares `video: HTMLVideoElement | null`.

### Typing Three.js Refs

If you need an imperative ref to a Three.js object (e.g., a mesh you want to animate), type it as:

```ts
const meshRef = useRef<THREE.Mesh>(null);
```

Then access it safely:

```ts
useFrame(() => {
  if (meshRef.current) {
    meshRef.current.rotation.y += 0.01;
  }
});
```

The `null` initial value is correct — the ref is populated by R3F after the component mounts.

### Mode State Union Type

```ts
const [mode, setMode] = useState<"camera" | "vr">("camera");
```

A union type instead of `string` means TypeScript will catch any typo in `setMode("vrr")` at compile time and enables exhaustive checks in switch statements.

---

## Dual Event Handler for Click + Touch

Webcam interaction must work on both desktop (click) and mobile (touch). The pattern used:

```ts
// Type union at the function signature
const pickColor = useCallback(
  (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    // Runtime discrimination
    const touch = (e as React.TouchEvent).touches?.[0];
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    // ...
  },
  []
);

// Attached to both events
<Webcam
  onClick={pickColor}
  onTouchStart={pickColor}
/>
```

**Why `onTouchStart` instead of `onClick`?** `onClick` fires on mobile too, but with a ~300ms delay (the tap delay). `onTouchStart` fires immediately, giving instant visual feedback at the tap circle. Both events are attached so desktop users get the standard click behavior.

---

## DPI-Aware Pixel Sampling

Canvas `getImageData` operates in device pixels, while mouse/touch coordinates are in CSS pixels. On a 2× DPR screen, failing to account for this samples the wrong pixel:

```ts
const rect = (e.currentTarget as HTMLVideoElement).getBoundingClientRect();
const scaleX = video.videoWidth / rect.width;
const scaleY = video.videoHeight / rect.height;

const x = clientX - rect.left;
const y = clientY - rect.top;

const pixel = ctx.getImageData(
  Math.floor(x * scaleX),
  Math.floor(y * scaleY),
  1, 1
).data;
```

The `video.videoWidth / rect.width` ratio converts from CSS-space coordinates to video-source-space coordinates. This works regardless of the device's pixel ratio.

---

## Hex Conversion from RGB

```ts
const hex = `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
```

The `(1 << 24)` prefix ensures the result is always 7 characters (e.g., `#0f0f0f` not `#f0f0f` for low R values). Without it, `toString(16)` on a small number would drop leading zeros.

---

## No Unused Imports

The codebase imports only what is used. `room.glb` is never imported or referenced in `page.tsx`. If you add imports during development, remove them before committing — the TypeScript compiler (`noUnusedLocals: true` is implied by `strict: true`) and Next.js build will flag them.

---

## Code Organization Order (within page.tsx)

The file follows this top-to-bottom order:

1. `"use client"` directive (implicit — hooks used)
2. Imports
3. Procedural texture factory functions (`makeFloorTex`, `makeWainscotTex`)
4. `Room` sub-component
5. `MobileColorPicker` root component (default export)

Texture factories are top-level functions (not defined inside a component) because they do not use React hooks and do not need to be in the component closure. Placing them at module scope is more idiomatic and avoids the linter warning about hooks placement.
