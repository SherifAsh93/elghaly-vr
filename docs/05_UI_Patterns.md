# 05 — UI Patterns

## Two-Screen Mobile-First Design

The app has no navigation, no sidebar, no header. There are exactly two screens, each occupying 100% of the viewport:

```
Screen 1 — Camera
┌─────────────────────────┐
│                         │
│    Live webcam feed     │
│    (full screen)        │
│                         │
│         ✦ tap dot       │
│                         │
│ ┌───────────────────┐   │
│ │ #A4B28C  [swatch] │   │
│ │  Preview Room →   │   │
│ └───────────────────┘   │
└─────────────────────────┘

Screen 2 — VR Room
┌─────────────────────────┐
│ ← Retake               │
│                         │
│    Three.js Canvas      │
│    (full screen)        │
│                         │
│                         │
│ ┌─────────────────────┐ │
│ │ Wall Color: #A4B28C │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

This full-screen-per-screen pattern is correct for a mobile PWA where distractions hurt UX. The camera needs maximum canvas real estate to aim accurately. The 3D room needs the full viewport to feel immersive.

---

## Full-Screen Element Pattern

Both screens use absolute/fixed positioning to cover the viewport:

```tsx
{/* Camera screen */}
<div className="fixed inset-0 bg-black">
  <Webcam className="w-full h-full object-cover" />
</div>

{/* VR screen */}
<div className="fixed inset-0">
  <Canvas style={{ width: '100%', height: '100%' }} />
</div>
```

`fixed inset-0` (equivalent to `position: fixed; top:0; right:0; bottom:0; left:0`) ensures the element fills the viewport even when the browser's URL bar collapses/expands on scroll, which changes `100vh` on mobile. Fixed positioning is immune to this Safari/Chrome mobile quirk.

---

## Bottom Panel (Glass-Morphic)

The bottom action panel on the camera screen uses a glass-morphic style:

```tsx
<div className="fixed bottom-0 left-0 right-0 p-4
                bg-white/80 backdrop-blur-md
                rounded-t-3xl shadow-lg">
  {/* hex value, color swatch, CTA button */}
</div>
```

Key classes:
- `bg-white/80` — white at 80% opacity, allowing the camera feed to bleed through
- `backdrop-blur-md` — blurs the camera content behind the panel (CSS `backdrop-filter: blur(12px)`)
- `rounded-t-3xl` — softens the panel top edge, following iOS-style sheet patterns
- `shadow-lg` — lifts the panel visually from the camera layer

This pattern makes the panel feel integrated with the camera rather than overlaid as a separate UI layer.

---

## Tap Indicator Circle

After color sampling, a circle appears at the exact tap location showing the sampled color:

```tsx
{isCaptured && (
  <div
    className="absolute w-12 h-12 rounded-full border-4 border-white
               shadow-lg transform -translate-x-1/2 -translate-y-1/2
               transition-all duration-300"
    style={{
      left: tapPos.x,
      top: tapPos.y,
      backgroundColor: color,
    }}
  />
)}
```

Implementation details:
- `position: absolute` inside the camera container — positioned relative to the webcam element
- `left: tapPos.x, top: tapPos.y` — raw CSS pixels from the tap event's `clientX/Y` minus container `rect.left/top`
- `-translate-x-1/2 -translate-y-1/2` — centers the circle on the tap point (without this, the top-left corner of the circle lands on the tap point)
- `backgroundColor: color` — the circle shows the actual hex value that was sampled, providing direct confirmation
- `border-4 border-white` — white ring ensures the circle is visible against any wall color
- `transition-all duration-300` — animates the circle in smoothly when `isCaptured` flips to true

---

## Pre-Capture Instruction Overlay

Before the user taps, an instruction overlay is shown:

```tsx
{!isCaptured && (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="bg-black/40 text-white px-6 py-3 rounded-2xl
                    text-center backdrop-blur-sm">
      Tap any wall surface to pick its color
    </div>
  </div>
)}
```

The overlay disappears after the first successful tap (`isCaptured = true`) and never returns during the session. If the user wants to retake, they go to VR mode and back — `isCaptured` resets to `false` when mode switches back.

---

## Mode Transition

The transition between camera and VR modes is an instant React state swap:

```tsx
{mode === "camera" && <CameraScreen />}
{mode === "vr" && <VRScreen />}
```

There is no CSS transition or animation between the two screens. This is deliberate:

1. **Cognitive clarity** — the user taps "Preview Room →" and immediately sees the room. A cross-fade would feel like a loading state, raising expectations of complexity.
2. **No shared layout** — the two screens share no visual elements. A transition would animate two entirely different compositions, which is harder to make look good than it sounds.
3. **Mobile UX convention** — native iOS/Android apps use instant transitions for tab switches.

---

## Button Pattern

All interactive elements use a consistent button style:

```tsx
<button
  onClick={() => setMode("vr")}
  className="w-full py-3 bg-gray-800 text-white
             rounded-2xl font-medium tracking-wide
             active:scale-95 transition-transform"
>
  Preview Room →
</button>
```

- `active:scale-95` — scales the button to 95% on press, replacing a hover state (hover doesn't exist on touch)
- `transition-transform` — makes the scale change animated (not instant)
- `rounded-2xl` — matches the overall pill aesthetic
- No `hover:` utilities — this is a mobile-first app; hover states are secondary

---

## Color Info Bar (VR Mode)

The VR mode bottom bar is minimal:

```tsx
<div className="fixed bottom-4 left-1/2 -translate-x-1/2
                bg-black/50 text-white px-4 py-2
                rounded-full backdrop-blur-sm text-sm">
  Wall Color: {color.toUpperCase()}
</div>
```

`left-1/2 -translate-x-1/2` is the standard Tailwind pattern for horizontal centering with `fixed` positioning (auto margins do not work on fixed elements). The `rounded-full` creates a pill shape, which is less visually heavy than a full-width bar and doesn't block the 3D scene below.

---

## Retake Button (VR Mode)

```tsx
<button
  onClick={() => { setMode("camera"); setIsCaptured(false); }}
  className="fixed top-4 left-4 bg-white/80 backdrop-blur-sm
             px-4 py-2 rounded-full text-sm font-medium shadow"
>
  ← Retake
</button>
```

Positioned `top-4 left-4` (top-left corner), which is the universal "back" affordance on mobile. Resetting `isCaptured = false` when returning to camera mode restores the instruction overlay so the user knows what to do.

---

## Geist Font Usage

`app/layout.tsx` uses Next.js's built-in Geist font loader:

```tsx
import { Geist, Geist_Mono } from "next/font/google";
```

The font variables (`--font-geist-sans`, `--font-geist-mono`) are applied to the `<html>` element. Tailwind's `font-sans` utility resolves to `--font-geist-sans` via CSS variable inheritance. No explicit `font-family` declarations are needed in components.

The monospace variant (`Geist_Mono`) is available for code or hex value display but is not explicitly applied in the current UI — the hex string in the bottom panel uses the default sans-serif.

---

## Minimal UI Philosophy in VR Mode

Once the user enters VR mode, the UI collapses to two elements:
- A small "← Retake" button (top-left)
- A small color pill (bottom-center)

Everything else is the Three.js canvas. This is the correct hierarchy for a visualization app: the visualization IS the product, not a feature within a UI frame. Any additional chrome would compete with the room for attention.
