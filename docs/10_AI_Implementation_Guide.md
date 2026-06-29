# 10 — AI Implementation Guide

This file is the authoritative reference for AI assistants continuing work on this project. Read it fully before writing any code. Every rule below traces to an actual pattern in `app/page.tsx`.

---

## Cardinal Rules (Never Violate)

### Rule 1: Always Use `useMemo` for Three.js Objects

Materials, geometries, and textures must NEVER be created in the render body. They must always be wrapped in `useMemo`.

```ts
// CORRECT
const paintMat = useMemo(
  () => new THREE.MeshStandardMaterial({ color: '#D4C5A9', roughness: 0.88, metalness: 0 }),
  []
);

// WRONG — creates a new GPU object on every render
const paintMat = new THREE.MeshStandardMaterial({ color: '#D4C5A9' });
```

This applies to: `MeshStandardMaterial`, `MeshBasicMaterial`, `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `CanvasTexture`, and any other Three.js object.

### Rule 2: Always Call `convertSRGBToLinear()` When Setting Colors from Hex

Hex colors (from `getImageData`, HTML color pickers, or hardcoded strings) are in sRGB space. Three.js materials work in linear space internally. Not converting produces incorrect colors that appear too saturated or too bright in the ACES render pipeline.

```ts
// CORRECT
paintMat.color.set(wallColor).convertSRGBToLinear();

// WRONG — color will be wrong in the rendered scene
paintMat.color.set(wallColor);
```

This only applies when the renderer has `outputColorSpace = THREE.SRGBColorSpace` (which this project does). If you add a new material with a dynamic color, follow this pattern.

### Rule 3: Always Set `material.needsUpdate = true` After a Color Change

Three.js does not automatically detect mutations to material properties. The `needsUpdate` flag tells the renderer to re-upload the material to the GPU.

```ts
// CORRECT
paintMat.color.set(wallColor).convertSRGBToLinear();
paintMat.needsUpdate = true;

// WRONG — the new color may not appear on screen (or may appear with a frame delay)
paintMat.color.set(wallColor).convertSRGBToLinear();
// (missing needsUpdate)
```

### Rule 4: Always Restrict OrbitControls for Mobile UX

Any new camera control configuration must include polar angle and distance limits. Without them, the user can orbit under the floor, look straight down at the ceiling, or zoom into geometry and see inside a mesh.

```tsx
<OrbitControls
  target={[0, 1.3, -1.2]}        // focal point — aim at the main furniture
  minPolarAngle={Math.PI / 6}     // 30° — prevents near-top-down view
  maxPolarAngle={Math.PI / 2.05}  // ~88° — prevents going below floor
  minDistance={1.5}               // prevents clipping into furniture
  maxDistance={5.5}               // prevents escaping the room
  enablePan={false}               // prevents translating camera out of room
/>
```

### Rule 5: Never Add Three.js Object Creation to a `useEffect`

`useEffect` runs after every render matching its deps. Constructing materials in `useEffect` creates them repeatedly and leaks GPU memory.

```ts
// WRONG
useEffect(() => {
  const mat = new THREE.MeshStandardMaterial({ color: wallColor });
  someRef.current.material = mat;
}, [wallColor]);

// CORRECT: create in useMemo, update in useEffect
const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff' }), []);
useEffect(() => {
  mat.color.set(wallColor).convertSRGBToLinear();
  mat.needsUpdate = true;
}, [wallColor, mat]);
```

---

## Implementation Checklist for New Features

Before writing any new Three.js code, verify:

- [ ] Every new material is created in `useMemo` with appropriate deps
- [ ] Every new geometry is created in `useMemo` (geometries with constant args use `[]`)
- [ ] Every new canvas texture is created in a top-level function or `useMemo`, not inline
- [ ] If color changes are reactive, `useEffect` mutates the material (not recreates it)
- [ ] `convertSRGBToLinear()` is called for any hex string set on a material
- [ ] `needsUpdate = true` follows every material property mutation
- [ ] Any new lights use shadow map sizes of 1024×1024 or smaller (performance)
- [ ] Any new OrbitControls usage includes polar angle and distance restrictions
- [ ] Any new event handler touching DOM APIs is wrapped in `useCallback`
- [ ] If async assets are loaded (GLB, image), a `<Suspense>` boundary exists above the loading component

---

## Patterns to Replicate

### Canvas Texture Generation (from `makeFloorTex`)

```ts
function makeMyTex(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Draw to ctx...
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// Inside component:
const myTex = useMemo(() => makeMyTex(), []);
```

The factory function is module-level (not inside the component) because it uses no hooks. Call it inside `useMemo` to memoize the result.

### Dual Event Handler (Click + Touch)

```ts
const handleInteraction = useCallback(
  (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const touch = (e as React.TouchEvent).touches?.[0];
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    // proceed with clientX, clientY...
  },
  [] // empty deps if only reading from refs or event
);

// Usage:
<div onClick={handleInteraction} onTouchStart={handleInteraction} />
```

Always attach both `onClick` and `onTouchStart`. `onClick` fires on mobile too (with 300ms delay), so `onTouchStart` provides immediate feedback without preventing `onClick` from also firing — this is fine since `setColor` is idempotent.

### DPR-Corrected Pixel Sampling

When sampling a pixel from a video or canvas element, always correct for the scale difference between CSS pixels and video pixels:

```ts
const rect = element.getBoundingClientRect();
const scaleX = sourceWidth / rect.width;
const scaleY = sourceHeight / rect.height;
const pixelX = Math.floor((clientX - rect.left) * scaleX);
const pixelY = Math.floor((clientY - rect.top) * scaleY);
```

Where `sourceWidth/sourceHeight` are the intrinsic dimensions (`video.videoWidth`, `canvas.width`, `image.naturalWidth`).

### ACES Tone Mapping Setup

Always include this exact `<Canvas>` configuration when creating a new scene:

```tsx
<Canvas
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  toneMapping={THREE.ACESFilmicToneMapping}
  toneMappingExposure={1.1}
  outputColorSpace={THREE.SRGBColorSpace}
  dpr={[1, 1.5]}
  shadows
>
```

Without `toneMapping`, materials look flat. Without `outputColorSpace`, colors appear washed out. Without `dpr={[1, 1.5]}`, the scene is either blurry (dpr=1) or too slow (dpr=2) on mobile.

---

## Common Mistakes

### Mistake 1: Missing `needsUpdate`

```ts
// Bug: color appears to change in state but not on screen
useEffect(() => {
  paintMat.color.set(wallColor).convertSRGBToLinear();
  // forgot: paintMat.needsUpdate = true;
}, [wallColor, paintMat]);
```

Symptom: state changes, React re-renders, but the wall color in the 3D scene doesn't update (or updates only on the next unrelated render).

### Mistake 2: Texture Created in Component Render Body

```ts
// Bug: new CanvasTexture on every render
function Room({ wallColor }: { wallColor: string }) {
  const floorTex = makeFloorTex(); // WRONG — called on every render
  // ...
}
```

Symptom: GPU memory grows continuously, textures flicker, performance degrades over time.

Fix: `const floorTex = useMemo(() => makeFloorTex(), []);`

### Mistake 3: Not Accounting for DPR in Pixel Extraction

```ts
// Bug: samples wrong pixel on Retina screens
const x = clientX - rect.left;           // CSS pixel
const y = clientY - rect.top;
const data = ctx.getImageData(x, y, 1, 1).data; // WRONG on 2× DPR
```

Symptom: On high-DPI devices (Retina iPhone, etc.), the sampled color is from a different location than where the user tapped — offset by 2×. Looks correct on desktop with DPR=1.

Fix: multiply by `video.videoWidth / rect.width` and `video.videoHeight / rect.height`.

### Mistake 4: Using `readyState` Without Checking

```ts
// Bug: ctx.drawImage on unready video returns a blank frame
ctx.drawImage(video, 0, 0);
const data = ctx.getImageData(x, y, 1, 1).data;
// data = [0, 0, 0, 0] — blank canvas
```

Fix: guard with `if (video.readyState !== 4) return;` before drawing.

### Mistake 5: Creating Material with Color in Memo Deps

```ts
// Bug: new material object created on every color change
const paintMat = useMemo(
  () => new THREE.MeshStandardMaterial({ color: wallColor }),
  [wallColor]  // WRONG dep
);
```

Symptom: Every color tap creates a new GPU material. Old materials are never disposed. Performance degrades and the mesh momentarily shows no material during the swap.

Fix: Create with static color in `[]` deps, update color in `useEffect`.

---

## How to Add GLB Loading with Suspense

If switching to the GLB model at `public/room.glb`:

```tsx
// Step 1: Add Suspense above Room in the Canvas tree
<Canvas ...>
  {/* lights */}
  <Suspense fallback={<LoadingMesh />}>
    <GLBRoom wallColor={color} />
  </Suspense>
  <OrbitControls ... />
  <ContactShadows ... />
</Canvas>

// Step 2: Write the GLB Room component
function GLBRoom({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  useEffect(() => {
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh && node.name === "WallMesh") {
        const mat = node.material as THREE.MeshStandardMaterial;
        mat.color.set(wallColor).convertSRGBToLinear();
        mat.needsUpdate = true;
      }
    });
  }, [wallColor, scene]);

  return <primitive object={scene} dispose={null} />;
}

// Step 3: Preload (optional, improves perceived performance)
useGLTF.preload("/room.glb");
```

The `<LoadingMesh>` fallback should be a simple colored box or a CSS spinner positioned over the canvas via `absolute` positioning outside the `<Canvas>`.

---

## How to Add More Rooms / Scenes

The cleanest extension path is to parameterize `<Room>` with a `roomId` prop and render different geometry sets based on it:

```tsx
type RoomId = "living-room" | "bedroom" | "kitchen";

function Room({ wallColor, roomId }: { wallColor: string; roomId: RoomId }) {
  // ...materials unchanged...

  return (
    <group>
      <BaseRoom wallColor={wallColor} />  {/* shared floor/ceiling/walls */}
      {roomId === "living-room" && <LivingRoomFurniture />}
      {roomId === "bedroom" && <BedroomFurniture />}
      {roomId === "kitchen" && <KitchenFurniture />}
    </group>
  );
}
```

Each furniture sub-component uses `useMemo` for its materials and returns only geometry `<mesh>` elements. The shared base room (floor, ceiling, walls, wainscoting, trim) is extracted to `<BaseRoom>` so it is not duplicated.

In `MobileColorPicker`, add:

```ts
const [roomId, setRoomId] = useState<RoomId>("living-room");
```

And a room selector UI (a tab bar or swipe carousel) that calls `setRoomId`.
