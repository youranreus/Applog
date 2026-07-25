# Research: Umami API（自建）要点

> 规划期摘录，供 implement/check 引用。权威文档以官网为准。

## Auth（self-hosted）

- `POST /api/auth/login` `{ username, password }` → `{ token }`
- 后续：`Authorization: Bearer <token>`
- 来源：https://docs.umami.is/docs/api/authentication

## Stats endpoints

Base: `/api/websites/:websiteId/...`

| Endpoint | 用途（本任务） |
|----------|----------------|
| `GET .../stats?startAt&endAt` | 摘要 pageviews / visitors |
| `GET .../pageviews?startAt&endAt&unit=day&timezone=` | 日趋势 |
| `GET .../metrics?startAt&endAt&type=` | path / os / device / country |

来源：https://docs.umami.is/docs/api/website-stats

## Privacy

- IP 用于 Geo 与会话哈希，**不存储**
- Location：Cloudflare / Vercel headers 或 MaxMind
- 来源：https://docs.umami.is/docs/metric-definitions

## Tracker

- `<script>` + `data-website-id`；SPA 自动跟踪
- 排除：`localStorage umami.disabled` 或本任务的「admin 不注入」
- 来源：https://docs.umami.is/docs/collect-data
