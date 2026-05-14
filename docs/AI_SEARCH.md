# AI Search

Endpoint: `POST /api/ai-search`

```json
{
  "query": "user research question",
  "depth": "quick"
}
```

AI Search plans one or more search queries, collects normalized sources, synthesizes an answer, records the session, and deducts 3 to 8 credits depending on depth.
