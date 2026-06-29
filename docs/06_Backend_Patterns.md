# 06 — Backend Patterns

## This Project Has No Backend

**elghaly-vr has zero server-side code.** There are no API routes, no server actions, no middleware, no server components, no serverless functions, and no external service calls. The project is a pure client-side application deployed as a static Next.js export on Vercel's CDN.

This is not an oversight — it is the correct architecture for this use case.

---

## Why No Server Is Needed

The application's entire processing pipeline is:

```
Browser webcam stream
      ↓
Canvas getImageData (CPU — runs in the browser tab)
      ↓
Hex color string (12 bytes of data)
      ↓
Three.js WebGL render loop (GPU — runs in the browser tab)
      ↓
Pixels on screen
```

No step in this pipeline requires a server. There is no data to store, no computation too heavy for a browser, no third-party service to authenticate with, and no multi-user coordination needed.

---

## What "Client-Side Only" Means Operationally

| Concern | Answer |
|---|---|
| API latency | Zero — no network calls at runtime |
| Offline capability | Yes — the app works without an internet connection after initial load |
| CORS issues | None |
| Auth tokens | None |
| Environment variables | None required |
| Rate limiting | Not applicable |
| Cold starts | Not applicable |
| Server logs | None (Vercel access logs only) |

---

## How Vercel Static Deployment Works for This App

Vercel builds the Next.js project (`next build`), which produces a static bundle:
- `page.tsx` is compiled to JavaScript and served as a CDN asset
- `public/` assets are served from Vercel's edge network
- No Node.js runtime is instantiated on request

Requests to the deployed URL are served entirely from Vercel's CDN edge nodes — no compute happens per request. This means sub-50ms TTFB globally with no cold start penalty.

---

## The Canvas Pixel Extraction IS the "Processing"

In a naive architecture, one might send the camera frame to a server for color extraction ("what color is at coordinate X,Y?"). This app correctly identifies that:

1. The webcam frame is already in the browser as a `<video>` element
2. The Canvas 2D API can read a single pixel synchronously in microseconds
3. The result is a 3-byte RGB value

Sending this to a server would add ~100–500ms of latency with zero benefit. The canvas `getImageData` approach is both faster and simpler.

---

## The Three.js Render IS the "Output"

Similarly, the 3D room visualization is computed locally on the device's GPU. No server-side rendering of 3D scenes is performed. Alternatives like server-side ray tracing would add latency, require significant compute cost, and destroy the real-time interactive feel.

---

## How to Add a Backend (Future Enhancements)

If requirements change (e.g., saving color palettes, user accounts, sharing rooms), here is the minimal addition needed:

### Option A: Next.js API Routes

Create `app/api/colors/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { hex, sessionId } = await req.json();
  // save to database...
  return NextResponse.json({ id: savedId });
}
```

No new infrastructure needed — Vercel auto-deploys API routes as serverless functions.

### Option B: Server Actions

For simpler form-based flows, Next.js Server Actions can be added without writing API routes:

```ts
// app/actions.ts
"use server";
export async function saveColor(hex: string) {
  await db.insert({ hex, createdAt: new Date() });
}
```

Called directly from client components: `await saveColor(color)`.

### Option C: Keep No Backend, Use localStorage

For single-user persistence without any server costs:

```ts
const history = JSON.parse(localStorage.getItem("colorHistory") ?? "[]");
history.unshift({ hex: color, at: Date.now() });
localStorage.setItem("colorHistory", JSON.stringify(history.slice(0, 20)));
```

This is often the right call for a mobile utility app where multi-device sync is not a requirement.

---

## Current Deployment Architecture

```
User Browser
    │ HTTPS
    ▼
Vercel Edge CDN
    │ serves static files
    ▼
No compute node — files only
```

When a backend is added, the architecture becomes:

```
User Browser
    │ HTTPS (static assets)
    ▼
Vercel Edge CDN
    │
    ▼ (API calls only)
Vercel Serverless Function
    │
    ▼
Database (e.g., Neon PostgreSQL)
```
