# 腾讯地图轻量底图设计

## Architecture

```text
Garmin WGS-84 geometry
  ├─ classify route / point / none
  ├─ compute existing AppLog MapCamera
  ├─ China-region gate
  └─ convert camera/overlay geometry to Tencent display coordinates
                │
                ▼
TencentStaticMapRenderer
  └─ GET staticmap/v2
       center + integer zoom + 480×480 + scale=2 + roadmap + server-side Key
                │
                ▼
validate 960×960 raster
                │
                ▼
existing Pillow compositor
  ├─ route + start/end
  ├─ point marker
  └─ football heatmap
                │
                ▼
persisted Garmin cover + existing fallback/currentness behavior
```

## Boundaries

- Replace only the basemap adapter. Geometry classification, camera fitting, overlays, cover persistence, currentness and failure protection stay project-owned.
- Do not call Tencent from the browser and do not expose the Key through public APIs.
- Do not send `path`, `markers`, activity IDs or the full trace to Tencent. Only the minimum camera request is sent.
- Remove Martin, PMTiles, local map fonts, release manifests, renderer sidecar, and obsolete fixture/prototype tooling after the Tencent path passes the gate.

## Coordinate contract

Garmin geometry remains WGS-84 at the domain boundary. The renderer introduces one explicit conversion boundary for mainland Tencent display coordinates. Camera center and every locally drawn overlay coordinate must be transformed by the same implementation before Web Mercator projection; converting only the center would visibly offset the route.

Use public control points and synthetic routes for the first test. The gate is overlay-to-road alignment within 2 final pixels at representative zooms 12, 15 and 17. If the static image viewport semantics or conversion cannot meet this reliably, the Tencent option is rejected rather than compensated with an unexplained pixel offset.

Tencent static zoom is integer-valued and uses a 256px tile pyramid, while AppLog's MapLibre-compatible camera uses 512px tiles. Preserve the fitted camera as the source of truth, request Tencent zoom `floor(camera.zoom) + 1` (clamped to 4–17), and project local overlays with `requested_zoom - 1`. This selects the greatest equivalent integer zoom that keeps the 6px red route and its start/end direction arrows inside the 16px target safe area. Tests must cover short routes, long thin routes and loops.

## Request and response contract

The adapter requests HTTPS `staticmap/v2` with:

- converted `center=lat,lng`;
- integer `zoom` in 4–17;
- `size=480*480` and `scale=2`;
- `maptype=roadmap`;
- a server-side WebService Key.

It enforces the existing bounded timeout and maximum raster bytes, accepts only a decodable 960×960 image, and rejects blank/error payloads. URLs are built centrally and sanitized before any diagnostic output.

Read `X-LIMIT` when present and expose bounded quota telemetry: current/limit QPS and daily PV. Missing quota headers do not fail a successful image request. No metric or log may contain the Key, full URL, coordinates or trajectory.

## Region and failure behavior

- A coarse mainland eligibility gate prevents obviously unsupported or overseas requests. The API remains authoritative; invalid/out-of-range responses map to `region_missing` or a provider error without leaking coordinates.
- Existing successful map covers are never overwritten by provider failure or `region_missing`.
- First-time failures retain the existing explicit fallback cover.
- Tencent timeout, HTTP failure, invalid raster and quota exhaustion remain distinguishable structured outcomes.
- Do not add a second provider for overseas activities in MVP.

## Key and operations

- Configure a dedicated Key with only WebService enabled and the narrowest available server-side security restriction.
- Store it in the worker's deployment secret environment, never in Git or generated images.
- Generate covers asynchronously and persist them; page views never call Tencent in real time.
- Cache/reuse is at the final AppLog cover level. Any longer-lived raw basemap cache requires a separate terms review before enabling.

## Visual gate

Generate paired outputs at the same public mainland cameras: current Protomaps and Tencent roadmap, both with identical local overlays. Review road/venue recognizability, Chinese labels, visual hierarchy and route contrast. Tencent is accepted only if it is materially better or at least comparable while satisfying deployment and alignment gates.

## Rollout and rollback

Ship behind provider configuration and validate with public/synthetic fixtures first. Then regenerate only a bounded set of eligible covers. Preserve the old renderer configuration and images during observation. Rollback selects the prior provider/config; existing cover monotonicity avoids destructive mass replacement.

## Trade-offs

- Deployment becomes much lighter, but runtime now depends on Tencent network availability and quota.
- Tencent roadmap improves domestic map completeness, but offers little style customization.
- Sending only camera center reduces third-party exposure versus sending the trace, but does not eliminate disclosure of an approximate activity location.
- Mainland-only scope is operationally simple but intentionally produces no Tencent basemap for overseas activities.
