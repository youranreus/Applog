# Visitor Cursor Cross-Layer Contract

## 1. Scope / Trigger

Read this contract when changing visitor presence, the global public-page shell, cursor identity, cursor polling, or `VisitorCursorModule`.

Visitor cursors are ephemeral presence state, not analytics. Keep them session-scoped and process-memory-backed; do not add a TypeORM entity unless the deployment model explicitly changes to shared storage.

## 2. Signatures

```http
POST /visitor-cursor/sync
Content-Type: application/json
```

```typescript
VisitorCursorService.sync(input: SyncVisitorCursorDto): IVisitorCursorResponse[]
useVisitorCursors(): { cursors: Ref<IVisibleVisitorCursor[]> }
```

The endpoint is public: omit `@AuthRoles`. Register the module through `src/module/index.ts` and `AppModule`.
Cross-layer request/response types and timing/limit constants live in `@applog/common`; do not duplicate them in either application package.

## 3. Contracts

Request fields:

| Field | Type | Constraint |
|---|---|---|
| `visitorKey` | string | UUID v4; internal identity, never displayed |
| `displayId` | string | four uppercase hexadecimal characters, displayed with a leading `#` |
| `color` | string | `#RRGGBB` |
| `pagePath` | string | pathname only; starts with one `/`; max 512; no query/hash/newline |
| `x`, `y` | number | normalized document coordinates in `[0, 1]` |

Response: `IVisitorCursorResponse[]`, containing `visitorKey`, `displayId`, `color`, `x`, `y`, ISO `updatedAt`, and server-derived `expiresInMs`. It excludes the caller, includes only the same `pagePath`, sorts newest first, and returns at most 20 entries updated within 15 seconds. The frontend must expire each item using `expiresInMs` minus the completed request's duration, not by restarting a fresh 15-second window when the response arrives.

Frontend identity uses `sessionStorage` and consists of a UUID v4, display ID, and a color from the committed readable palette. Claim the identity through `BroadcastChannel` so tabs whose `sessionStorage` was cloned from an opener regenerate independently. Mouse movement only updates memory; normalize `clientX + scrollX` and `clientY + scrollY` against the full document dimensions. The rendering layer is absolute within the positioned application root so scrolling preserves each cursor's document anchor. Combined sync request starts must remain at least 5 seconds apart, including route/visibility-triggered and queued requests. Non-public routes and hidden tabs stop collection and polling.

## 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Invalid UUID, display ID, color, path, or coordinate | Global `ValidationPipe` rejects the request |
| Cursor is older than 15 seconds | Remove before producing the response |
| Caller appears in same-path storage | Exclude it from the response |
| More than 20 same-path visitors | Return the newest 20 |
| Frontend request fails | Swallow locally; never trigger the global notification UI |
| Frontend has no mouse position yet | Do not send a sync request |
| Slow request overlaps another trigger | Queue one attempt, then apply the same 5-second start cooldown |
| Stored identity is active in another tab | Regenerate and persist a new tab identity |
| Route is `/user/*`, login/callback, or error | Do not collect, send, or render |

## 5. Good / Base / Bad Cases

- Good: two tabs on `/archives/example.html` move their mouse and see one another on the next 5-second cycle; scrolling either tab changes the cursor's viewport offset but preserves its document position.
- Base: a lone visitor or a visitor who has not moved produces no remote cursor UI.
- Bad: using `localStorage`, storing cursor rows in MySQL, sending on every `mousemove`, mixing different pathnames, or surfacing polling failures as toasts.

## 6. Tests Required

- Service unit tests assert same-path filtering, caller exclusion, upsert, 15-second expiry, newest-first order, and the 20-entry limit.
- DTO tests assert one valid payload and rejection of invalid identity, path, color, and out-of-range coordinates.
- Frontend verification must include type-check/build plus two-tab browser coverage for independent identities, pointer passthrough, document-coordinate rendering across scrolling, edge-label flipping, and disabled admin routes.

## 7. Wrong vs Correct

### Wrong

```typescript
window.addEventListener('mousemove', (event) => {
  void syncVisitorCursor(toPayload(event)).send()
})
```

This turns pointer frequency into request frequency and keeps running unless every route handles cleanup.

### Correct

```typescript
window.addEventListener('mousemove', rememberLatestPosition, { passive: true })
syncTimer = setInterval(() => void sync(), 5_000)
```

The global composable owns route/visibility lifecycle, request de-duplication, and cleanup; the component only renders typed cursor state.

### Coordinate anchoring

#### Wrong

```typescript
x: event.clientX / window.innerWidth
y: event.clientY / window.innerHeight
```

Paired with a fixed layer, this anchors the remote cursor to the receiver's viewport. Scrolling then changes the apparent document position.

#### Correct

```typescript
const root = document.documentElement
x: (event.clientX + window.scrollX) / root.scrollWidth
y: (event.clientY + window.scrollY) / root.scrollHeight
```

Render these values as percentages inside an absolute layer whose positioned parent is the full application document. Do not mix document-normalized payloads with `vw`/`vh` rendering.
