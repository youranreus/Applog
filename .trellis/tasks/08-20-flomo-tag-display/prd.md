# Add tag-filtered Flomo display

## Goal

Allow the blog to display Flomo memos selected by an explicit publication tag,
without exposing Flomo credentials or private, untagged memos to browsers.

## Dependency

Implementation is blocked by `08-20-migrate-app-secret-encryption-key`. The
Flomo token must use that task's generic encrypted-secret contract rather than
introducing another feature-specific encryption-key environment variable.

## Requirements

- Store the Flomo Web bearer token encrypted in the database and decrypt it only
  within trusted backend execution.
- Keep all Flomo private-API access behind a replaceable backend adapter.
- Synchronize memo changes incrementally and filter them through an exact,
  configurable publication-tag allowlist before exposing content.
- Serve only sanitized, normalized blog-facing data from Applog APIs; never
  return Flomo credentials or raw private-account responses.
- Retain the last successful public snapshot when Flomo authentication, rate
  limits, or private API compatibility fails.
- Treat the private API/signature implementation as an unstable dependency with
  explicit operational diagnostics and a future path to the official MCP.
- Finalize product presentation, attachment policy, deletion behavior, sync
  schedule, and administration UX during this task's own planning phase.

## Acceptance Criteria

- [ ] A configured publication tag exposes only matching memos.
- [ ] Flomo credentials remain encrypted at rest and never appear in frontend
  responses, bundles, or logs.
- [ ] Synchronization handles pagination and repeat processing idempotently.
- [ ] Remote failures do not take the public blog view offline or reveal private
  data.
- [ ] Rendered memo content is sanitized before public display.
- [ ] Automated tests cover authorization, tag isolation, sync failure, and
  credential redaction.

## Out of Scope for Initial Planning

- Work on this task before the encryption-key migration contract is complete.
- Copying the Obsidian-specific filesystem, timer, or UI implementation from
  `flomo-bridge`.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
