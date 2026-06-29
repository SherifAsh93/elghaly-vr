# 07 — Database

## This Project Has No Database

**elghaly-vr uses no database of any kind.** There is no Postgres, no SQLite, no Redis, no Firestore, no localStorage persistence, and no in-memory store beyond React component state.

---

## What Data Exists

The application manages exactly one piece of data:

| Data | Type | Scope | Persistence |
|---|---|---|---|
| `color` | `string` (hex, e.g. `"#A4B28C"`) | React component state | Lost on page refresh |

The initial value is hardcoded: `useState("#D4C5A9")` (a warm beige). When the user samples a wall color, `setColor(hex)` updates it. When they close the browser tab, the value is gone.

This is correct for the current use case. A paint color visualizer session is inherently transient — the user picks a color, previews it, and leaves. There is no multi-session workflow that would benefit from persistence.

---

## Why No Persistence Is Needed Now

1. **Single session flow** — The user picks a color, sees the room, and either repaints the wall or doesn't. There is no "come back later" moment in the current product design.
2. **No user identity** — There are no accounts. Without a user ID, there is nothing to associate saved colors with.
3. **Trivially re-derivable** — If the user wants the same color again, they tap the same wall again. The "database" is the physical wall.

---

## What Would Be Needed to Support Color History

If saving a history of sampled colors were required, here is the minimal viable schema:

### Relational (e.g., Neon PostgreSQL)

```sql
CREATE TABLE color_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,          -- anonymous browser session identifier
  hex_color   CHAR(7) NOT NULL,       -- e.g. '#A4B28C'
  sampled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON color_sessions (session_id, sampled_at DESC);
```

The `session_id` would be a UUID generated on first visit and stored in `localStorage`. No authentication needed for this use case.

### Document Store (e.g., Firestore)

```
/sessions/{sessionId}/colors/{colorId}
  hex: "#A4B28C"
  sampledAt: Timestamp
```

### Recommended: localStorage (No Database at All)

For a single-device use case, localStorage is simpler and free:

```ts
// Save
const history: string[] = JSON.parse(
  localStorage.getItem("elghaly-color-history") ?? "[]"
);
history.unshift(color);
localStorage.setItem(
  "elghaly-color-history",
  JSON.stringify(history.slice(0, 20))  // keep last 20
);

// Load
const history: string[] = JSON.parse(
  localStorage.getItem("elghaly-color-history") ?? "[]"
);
```

This requires no backend, no schema migration, no connection string, and no environment variables. It would survive page refreshes and browser closures. It does not survive clearing browser storage or switching devices.

---

## Integration Path for a Database (When Needed)

If a database is added:

1. Provision Neon PostgreSQL via the Vercel Marketplace (environment variables auto-injected as `DATABASE_URL`)
2. Install Drizzle ORM: `npm install drizzle-orm @neondatabase/serverless`
3. Define schema in `lib/schema.ts`
4. Create API route at `app/api/colors/route.ts` to read/write
5. Call from `page.tsx` via `fetch('/api/colors', { method: 'POST', body: JSON.stringify({ hex: color }) })`

No changes to the Three.js or camera code would be needed — the database interaction is additive.
