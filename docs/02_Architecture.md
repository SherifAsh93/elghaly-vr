# 02 — Architecture

## Two-Mode Architecture

The application operates in exactly two states, toggled by `mode: "camera" | "vr"`:

```
┌─────────────────────────────────────┐
│         MobileColorPicker           │
│  state: color, mode, isCaptured     │
│           tapPos                    │
│                                     │
│  mode === "camera"   mode === "vr"  │
│       │                    │        │
│  <Webcam>           <Canvas>        │
│  pickColor()        <Room>          │
│  tap indicator      wallColor=color │
└─────────────────────────────────────┘
```

**Camera mode** is the entry point. The user sees a live rear-facing webcam stream. Tapping (mobile) or clicking (desktop) calls `pickColor`, which samples the pixel at the tap coordinate, converts it to a hex string, and stores it in `color` state. A colored circle renders at the tap location to confirm the sampled color. The "Preview Room →" button sets `mode = "vr"`.

**VR mode** replaces the camera view entirely with a full-screen Three.js canvas. The `color` state is passed as `wallColor` to the `<Room>` component. A "Retake →" button restores camera mode.

There is no animation between modes — the switch is an instant React state update. The full-screen canvas mount/unmount is not expensive because Three.js context creation is fast and there is no async data loading.

---

## Data Flow

The complete data pipeline from tap to rendered color:

```
User tap on webcam stream
        │
        ▼
pickColor(event: MouseEvent | TouchEvent)
        │
        ├── get coords from event.clientX/Y or event.touches[0]
        ├── get bounding rect from event.currentTarget
        ├── get video element: webcamRef.current.video
        ├── check video.readyState === 4  (HAVE_ENOUGH_DATA)
        ├── ctx.drawImage(video, 0, 0)
        ├── apply DPI scale: scaleX = video.videoWidth / rect.width
        ├── ctx.getImageData(Math.floor(x*scaleX), Math.floor(y*scaleY), 1, 1)
        ├── [R, G, B, A] = imageData.data
        └── hex = `#${((1<<24)+(R<<16)+(G<<8)+B).toString(16).slice(1)}`
                │
                ▼
        setColor(hex)
        setTapPos({ x, y })
        setIsCaptured(true)
                │
                ▼ (after "Preview Room →" tap)
        setMode("vr")
                │
                ▼
        <Room wallColor={color} />
                │
                ▼
        useEffect([wallColor, paintMat])
        paintMat.color.set(wallColor)
        paintMat.color.convertSRGBToLinear()
        paintMat.needsUpdate = true
                │
                ▼
        Three.js re-renders affected meshes
        ACES tone mapping applied by renderer
        SRGBColorSpace output
```

No network requests occur at any step. No server round-trips. The entire pipeline is synchronous CPU work except for the Three.js WebGL render loop.

---

## Component Hierarchy

```
MobileColorPicker  (root — exported default)
│   state: color, mode, isCaptured, tapPos
│   ref:   webcamRef, canvasRef
│   memo:  pickColor (useCallback)
│
├── [mode === "camera"]
│   ├── <Webcam>                   (react-webcam)
│   │     videoConstraints: { facingMode: "environment" }
│   │     onClick / onTouchStart: pickColor
│   ├── <canvas ref={canvasRef}>   (hidden, for getImageData)
│   ├── overlay div               (instruction text OR tap circle)
│   └── bottom panel              (hex display, swatch, CTA button)
│
└── [mode === "vr"]
    ├── "Retake →" button
    ├── <Canvas>                   (React Three Fiber)
    │     gl, toneMapping, shadows, camera, dpr
    │   ├── <ambientLight>
    │   ├── <directionalLight>    (key, shadows)
    │   ├── <pointLight> × 2      (ceiling fixtures)
    │   ├── <pointLight>          (lamp shade)
    │   ├── <spotLight>           (window)
    │   ├── <directionalLight>    (warm fill)
    │   ├── <Room wallColor={color} />
    │   │     memos: floorTex, wainscotTex,
    │   │            paintMat, floorMat, wainMat,
    │   │            trimMat, ceilMat, glassMat
    │   │     effect: sync wallColor → paintMat
    │   │     meshes: floor, ceiling, 4 walls, wainscoting,
    │   │             trim rails, window/glass, furniture
    │   ├── <OrbitControls>        (Drei)
    │   └── <ContactShadows>       (Drei)
    └── color info bar
```

---

## Why Procedural Geometry Instead of GLB

| Concern | Procedural | GLB (23 MB) |
|---|---|---|
| Download cost | Zero | 23 MB on every visit |
| Mobile load time | Instant | 5–15 s on 3G |
| Color update | `material.color.set(hex)` | Must find correct mesh material by name |
| Dimension change | Edit a variable | Re-export from Blender |
| Suspense needed | No | Yes (`useGLTF` is async) |
| Determinism | Always identical | Depends on exporter settings |

The procedural path is unambiguously correct for this use case. The GLB file remains in `public/` as a reference artifact.

---

## Memoization Strategy

Three.js objects that exist outside React's reconciler must never be created inside the render body — they would be recreated on every render, leaking GPU memory and causing visual flicker.

| Object | Hook | Deps | Reason |
|---|---|---|---|
| `floorTex` | `useMemo` | `[]` | Canvas texture, never changes |
| `wainscotTex` | `useMemo` | `[]` | Canvas texture, never changes |
| `paintMat` | `useMemo` | `[]` | Material created once; color mutated via effect |
| `floorMat` | `useMemo` | `[floorTex]` | Depends on texture reference |
| `wainMat` | `useMemo` | `[wainscotTex]` | Depends on texture reference |
| `trimMat` | `useMemo` | `[]` | Static gold color |
| `ceilMat` | `useMemo` | `[]` | Static off-white |
| `glassMat` | `useMemo` | `[]` | Static transparent blue |
| `pickColor` | `useCallback` | `[]` | Stable ref passed to DOM event handlers |

**The color update pattern** avoids recreating `paintMat` on every color change. Instead, `useEffect([wallColor, paintMat])` mutates the existing material in-place:

```ts
useEffect(() => {
  paintMat.color.set(wallColor).convertSRGBToLinear();
  paintMat.needsUpdate = true;
}, [wallColor, paintMat]);
```

This is the canonical React Three Fiber pattern for reactive Three.js material properties.

---

## Why No Suspense Boundary

`React.Suspense` is needed when a component `throw`s a Promise — typically during async data loading (e.g., `useGLTF`, `useTexture` from Drei). This app uses neither:

- Textures are created synchronously via the Canvas 2D API (`makeFloorTex`, `makeWainscotTex` return `THREE.CanvasTexture` objects immediately)
- No GLB or external asset is loaded at runtime

The `<Canvas>` tree therefore has no suspended components and requires no fallback. If a GLB were added in the future, a `<Suspense fallback={<LoadingScreen />}>` wrapper around `<Room>` would be required.
