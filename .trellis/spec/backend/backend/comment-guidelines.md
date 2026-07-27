# Comment Cross-Layer Contract

> Canonical contract for public comments, moderation, pending-comment capabilities, safe rendering, and Typecho comment migration.

---

## 1. Scope and Trigger

Use this guide whenever changing:

- `CommentEntity`, comment DTOs, controller, service, or comment API consumers;
- the public post comment tree or the admin moderation page;
- pending-comment storage, resolution, or withdrawal;
- comment text/meme rendering;
- Typecho migration resources, mappings, ordering, or statistics.

The privacy and capability rules below are security boundaries, not UI conventions.

## 2. Signatures and Persistent Shape

### Entity

`CommentEntity` persists:

```ts
type CommentStatus = 'pending' | 'approved' | 'rejected'

interface CommentRecord {
  id: number
  content: string
  status: CommentStatus
  likeCount: number
  postId: number
  parentId?: number
  authorId?: number
  guestName?: string
  guestEmail?: string
  guestSite?: string
  ip?: string
  agent?: string
  withdrawTokenHash?: string | null
  source?: string
  sourceId?: string
  extra?: Record<string, unknown>
}
```

Required indexes:

- `(postId, status, parentId)` for public trees;
- `(postId, ip, createdAt)` for throttling;
- unique `(source, sourceId)` for migration idempotency.

`withdrawTokenHash` must use `select: false`. Public DTOs must never contain `guestEmail`, `ip`, `agent`, `withdrawTokenHash`, `source`, or `sourceId`.

### Public API

| Method | Path | Input | Output / rule |
|---|---|---|---|
| `POST` | `/comment` | `CreateCommentDto` | Authenticated comments are `approved`; guest comments are `pending` and receive a one-time plaintext `withdrawToken` |
| `GET` | `/comment?postId=&page=&limit=` | `QueryCommentDto` | Paginates approved root comments and returns approved descendant trees |
| `GET` | `/comment/:id` | positive id | Approved comment only when its full ancestor chain is approved |
| `POST` | `/comment/pending/resolve` | at most 20 `{ commentId, token }` capabilities | Returns matching pending public DTOs, deduplicated by comment id |
| `POST` | `/comment/:id/withdraw` | `{ token }` | Deletes the matching pending subtree only |
| `POST` | `/comment/:id/react` | positive id | Reacts only when the comment and its full ancestor chain are approved |
| `GET` | `/comment/:id/location?limit=` | positive id, limit 1-50 | Returns the approved root's page and id using the public root ordering; hidden comments use not-found behavior |

`CreateCommentDto` accepts content up to 10,000 characters, a positive `postId`, an optional positive `parentId`, and guest name/email/site fields up to the entity's 200-character limits. Guest email is required and valid; site is optional and a valid URL.

### Admin API

All admin routes require `@AuthRoles('admin')`:

```text
GET    /comment/admin
GET    /comment/admin/:id/delete-impact
POST   /comment/:id/approve
PATCH  /comment/:id
DELETE /comment/:id
```

Admin list filters by `pending | approved | rejected` and/or `postId`. Approval sets the requested moderation status and clears `withdrawTokenHash` to SQL `NULL`. Deletion is transactional and removes the entire descendant subtree.

### Typecho Migration

`MigrateDataDto.resources` is an optional non-empty subset of `posts | pages | comments`; omission preserves the full migration behavior. A comments-only migration reads and writes neither posts nor pages. Comments map with:

```text
typecho_comments.cid       -> posts.extra.originalId -> comments.postId
typecho_comments.coid      -> comments.sourceId
source                     -> "typecho"
approved / waiting / spam  -> approved / pending / rejected
type=comment only          -> imported
parent                     -> parentId after topology resolution
created                    -> createdAt and updatedAt
author/mail/url/ip/agent   -> guest identity and request metadata fields
```

## 3. Contracts

### Creation and visibility

- The global `allowComment` setting gates creation.
- The target post must exist and be published.
- A reply parent must belong to the same post and already be approved.
- Logged-in identity comes from the authenticated payload; clients cannot override it with guest fields.
- Guest comments require trimmed name and email. Website remains optional.
- Authenticated comments are created as `approved`, generate no withdrawal token, and are immediately public. Guest comments are created as `pending` and follow the capability workflow.
- Non-admin submissions are limited to one comment per `(postId, server-observed IP)` per 60 seconds.
- IP comes from Fastify/Nest `@Ip()` and UA from the request header; never accept either in the request DTO. Production proxy configuration must trust only known proxy hops before forwarded IPs are relied on.

### Pending capability

- Generate at least 256 bits of random entropy and return plaintext only in the create response.
- Persist only a SHA-256 hash. Compare fixed-length digests with a timing-safe comparison.
- Capability resolution and withdrawal work only while status is `pending`.
- Approval or rejection invalidates the capability by clearing its hash.
- Frontend persistence uses post-scoped `sessionStorage`, validates and deduplicates entries, and keeps at most 20 capabilities. Failure to access storage must not break the current-page experience.
- Pending-tree merge deduplicates again by comment id at the rendering boundary; it cannot rely solely on capability resolution having removed duplicates.
- A withdrawal control is rendered only when the matching capability is present.

### Tree and moderation integrity

- Public root pagination counts approved roots, not flattened descendants.
- Public root pagination and anchor location use the same stable ordering: `createdAt DESC, id DESC`. Location counts roots strictly ahead of the target root and computes `floor(count / limit) + 1`.
- A comment hidden by any non-approved ancestor is neither readable nor reactable through a direct endpoint.
- After a location response, the frontend must verify that the requested anchor exists in the loaded post. A stale or cross-post hash falls back to page 1 without disclosing why the target was unavailable.
- Admin deletion displays fresh impact data. If the descendant count changes before confirmation, refresh and reconfirm.
- Subtree deletion must use a transaction; never delete only the root and leave orphans.

### Rendering and privacy

- Comment content is plain text. Never render comment-provided HTML with `v-html`.
- The shared pure parser recognizes `@(name)`, `::category:name::`, and `#(name)` and emits text/meme segments. Both article Markdown and comment UI reuse that parser.
- Render text through Vue text interpolation and meme segments as controlled image attributes.
- Public payloads expose only display-safe author data. Admin DTOs may expose operational metadata but must still exclude `withdrawTokenHash`.
- Resolve Gravatar server-side from normalized email (`trim().toLowerCase()`) and expose only the final HTTPS avatar URL. Prefer an existing account avatar; never send email to the public client for hashing.
- Every rendered comment uses the stable `comment-<id>` anchor. Hash-based location may select an approved root page but must never reveal pending/rejected comments.
- Visitor-owned pending comments are merged into the normal tree only after capability validation and carry an “审核中” badge; they are not rendered in a separate pseudo-list.

### Migration integrity

- Typecho table prefixes must match `^[A-Za-z0-9_]+$` before interpolation into identifiers.
- Migration must be idempotent through unique `(source, sourceId)` and count existing rows separately.
- Import parents after source ids are known; missing parents become roots and increment `commentsMissingParent`.
- Missing post mappings, unsupported types, unsupported statuses, existing rows, and failures are reported in separate counters.
- `clearExisting` clears only explicitly selected resources. Reject clearing posts without comments because post deletion would implicitly cascade comment data.

## 4. Validation and Error Matrix

| Condition | Required behavior |
|---|---|
| comments disabled | reject creation: `评论功能已关闭` |
| blank content | reject creation |
| post missing or unpublished | reject creation |
| parent missing / other post / non-approved | reject creation with the matching business error |
| guest name or email missing | reject creation |
| invalid guest email/site or excessive field length | DTO validation failure |
| non-admin repeats within 60 seconds for post and IP | reject creation |
| public id missing, non-approved, or under hidden ancestor | return the same not-found business behavior |
| invalid, stale, rejected, approved, or mismatched withdrawal capability | reject without revealing which part failed |
| duplicate pending capabilities | resolve each comment at most once |
| admin deletion target missing | reject; do not start a partial delete |
| invalid Typecho prefix | DTO validation failure before SQL construction |
| Typecho comment has unsupported type/status | skip and increment the corresponding counter |
| Typecho comment has no mapped post | skip and increment `commentsMissingPost` |
| Typecho comment has no mapped parent | import as root and increment `commentsMissingParent` |

Unexpected persistence failures must be logged with `HLogger` and translated to `BusinessException`; secrets and plaintext capability tokens must not be logged.

## 5. Good, Base, and Bad Cases

### Base case

1. A guest submits plain text with a supported meme token.
2. For a guest, backend records server-observed IP/UA, stores status `pending`, hashes the capability, and returns plaintext once. For an authenticated user, it stores `approved` and returns no token.
3. The current tab stores the capability by post and resolves the pending comment after reload.
4. An admin approves the comment, clearing the hash.
5. It appears in the approved public tree; email, IP, and UA remain absent.

### Good edge cases

- A nested reply remains hidden until its entire ancestor chain is approved.
- Re-running a Typecho comments migration reports existing rows without duplicating them.
- A migrated child seen before its parent is connected during topology resolution.
- Corrupt or unavailable `sessionStorage` degrades to current-page state without crashing.

### Bad cases

- Returning the withdrawal hash or guest email from `GET /comment`.
- Letting a client send its own IP or trusting arbitrary `X-Forwarded-For` hops.
- Resolving pending comments by id without a matching capability.
- Rendering comment content via `v-html` or parsing it as Markdown.
- Paginating all rows and then trying to reconstruct incomplete trees.
- Importing comments by title/slug instead of `posts.extra.originalId`.
- Clearing posts during a comments-only reset.

## 6. Tests Required

Backend changes require tests for:

- token hashing/matching and invalid token handling;
- public DTO privacy;
- pending resolution deduplication and pending-only behavior;
- hidden-ancestor protection for direct read and reaction;
- approval/rejection clearing the capability hash;
- transactional subtree deletion impact;
- Typecho status/type mapping, topology, missing references, idempotency, and comments-only zero post/page reads/writes;
- prefix validation and selected-resource clear behavior.

Frontend changes require lint, type-check, and tests or deterministic coverage for:

- meme segment parsing without HTML execution;
- post-scoped storage validation, deduplication, 20-entry cap, and storage failure;
- pending merge/withdraw visibility;
- pending root/reply placement and duplicate-id handling;
- valid, malformed, stale, and cross-post comment hashes, including page-1 fallback when the loaded DOM has no target anchor;
- refreshed delete-impact confirmation.

Minimum quality gate: backend tests, backend lint/build, frontend task-file lint, frontend type-check/build, root build, and `git diff --check`. A real MySQL copy of the Typecho schema must validate generated DDL and a repeated comments-only migration before production use.

## 7. Wrong vs Correct

```ts
// Wrong: sensitive persistence entity returned directly.
return this.commentRepo.find({ where: { postId } })

// Correct: query only publicly eligible rows and map to IPublicCommentDto.
return this.buildPublicTree(rows).map(comment => this.toPublic(comment))
```

```ts
// Wrong: plaintext token stored or compared directly.
comment.withdrawTokenHash = token

// Correct: plaintext is returned once; only its digest is persisted.
comment.withdrawTokenHash = hashWithdrawToken(token)
```

```vue
<!-- Wrong: user comment can execute markup. -->
<div v-html="comment.content" />

<!-- Correct: render parser-produced text and controlled meme image segments. -->
<template v-for="segment in parseMemeSegments(comment.content)">
  <span v-if="segment.type === 'text'">{{ segment.value }}</span>
  <img v-else :src="segment.src" :alt="segment.alt">
</template>
```

```ts
// Wrong: comments-only migration also reads or truncates posts.
await adapter.readPosts()
await postRepo.clear()

// Correct: branch every read, write, and clear by the explicit resources set.
if (resources.includes('comments')) await migrateComments()
```
