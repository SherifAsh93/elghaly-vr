# 08 — API Reference

## This Project Has No API Routes

**elghaly-vr makes zero network requests at runtime.** There are no `fetch` calls, no `axios` imports, no SWR hooks, no server actions, and no WebSocket connections in `app/page.tsx` or any other source file.

The `app/api/` directory does not exist.

---

## All Data Flows Are Local

Every data operation in the app is a local browser API call:

| Operation | Browser API | Location in Code |
|---|---|---|
| Access camera stream | `navigator.mediaDevices.getUserMedia` | Handled internally by `react-webcam` |
| Read pixel at tap coordinate | `CanvasRenderingContext2D.getImageData` | `pickColor` callback in `page.tsx` |
| Draw video frame to canvas | `CanvasRenderingContext2D.drawImage` | `pickColor` callback in `page.tsx` |
| Generate floor texture | `CanvasRenderingContext2D` (line, bezierCurveTo, fillRect) | `makeFloorTex()` in `page.tsx` |
| Generate wainscoting texture | `CanvasRenderingContext2D` (fillRect, strokeRect) | `makeWainscotTex()` in `page.tsx` |
| Render 3D scene | WebGL (via Three.js/R3F) | `<Canvas>` in `page.tsx` |

None of these operations leave the browser tab. No data is transmitted over the network after the initial page load.

---

## Browser APIs Used (The "API" of This App)

### `getUserMedia` (via react-webcam)

```
Permission: camera
Constraints: { video: { facingMode: "environment" } }
Result: MediaStream → <video> element
```

The rear-facing camera constraint (`facingMode: "environment"`) is requested on mount. The browser permission dialog appears on first use. If denied, the webcam element shows an error state (handled by react-webcam's internal error boundary).

### Canvas 2D API — `drawImage`

```
ctx.drawImage(videoElement, 0, 0)
```

Copies the current video frame into a hidden `<canvas>` element. The canvas is sized to the video's intrinsic dimensions (`video.videoWidth × video.videoHeight`). This operation is synchronous and completes in < 1ms for typical video sizes.

The `video.readyState === 4` guard (`HAVE_ENOUGH_DATA`) ensures the video frame is available before drawing. Calling `drawImage` before the stream is ready produces a blank canvas.

### Canvas 2D API — `getImageData`

```
ctx.getImageData(x, y, 1, 1)
// returns ImageData { data: Uint8ClampedArray([R, G, B, A]) }
```

Extracts one pixel from the canvas at the DPI-corrected tap coordinate. Returns a `Uint8ClampedArray` of four bytes: red, green, blue, alpha (0–255 each). The alpha channel is ignored in the hex conversion.

### Canvas 2D API — Bezier Curves (Texture Generation)

`makeFloorTex()` uses `ctx.bezierCurveTo` to draw wood grain veins:

```
ctx.beginPath()
ctx.moveTo(x, y)
ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
ctx.stroke()
```

`makeWainscotTex()` uses `ctx.fillRect` and `ctx.strokeRect` to draw recessed panel highlights.

Both functions return `new THREE.CanvasTexture(canvas)` — Three.js wraps the canvas element directly, reading it as a WebGL texture. No image encoding/decoding occurs.

### WebGL (via Three.js and React Three Fiber)

The `<Canvas>` component creates a WebGL 2 context on mount. All 3D rendering is GPU-accelerated. The Three.js render loop runs at the display's refresh rate (60–120 Hz) via `requestAnimationFrame`, managed internally by React Three Fiber.

---

## No Network Calls at Runtime

The network waterfall for this app after initial load:

```
(nothing)
```

Once the JavaScript bundle is cached by the browser, the app operates entirely offline. This is a genuine zero-network-at-runtime application.

---

## What APIs Would Be Needed to Add Features

### Saving Color History

```
POST /api/colors
Body: { hex: "#A4B28C", sessionId: "uuid" }
Response: { id: "uuid", savedAt: "ISO timestamp" }

GET /api/colors?sessionId=uuid
Response: [{ id, hex, savedAt }, ...]
```

### Sharing a Room Preview

```
POST /api/share
Body: { hex: "#A4B28C" }
Response: { shareId: "abc123", url: "https://elghaly-vr.vercel.app/room/abc123" }
```

This would require a new dynamic route `app/room/[shareId]/page.tsx` that reads the `shareId` from the URL and pre-fills the color state.

### Named Paint Colors (Brand Database)

```
GET /api/paint-match?hex=A4B28C
Response: {
  closestMatch: { brand: "Benjamin Moore", name: "Revere Pewter", code: "HC-172" },
  delta_e: 2.3
}
```

This would require a color-distance algorithm (ΔE calculation in CIELAB color space) and a paint brand color database — most naturally implemented as a serverless function with a JSON dataset.
