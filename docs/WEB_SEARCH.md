# Web Search

`server/src/services/searchService.js` normalizes search providers into:

```json
{
  "title": "",
  "url": "",
  "snippet": "",
  "source": "",
  "publishedDate": "",
  "score": 0
}
```

Supported provider paths: Serper, Tavily, and Brave Search. Demo mode returns local demo results.
