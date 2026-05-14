"""Legal/free source collectors for Wikipedia, Reddit, arXiv, Stack Overflow, RSS, and Common Crawl."""

from __future__ import annotations

import json
import logging
import os
from gzip import GzipFile
from io import BytesIO
from typing import Any

import requests
from bs4 import BeautifulSoup

from config import (
    COMMON_CRAWL_COLLINFO_URL,
    DEFAULT_NEWS_FEEDS,
    DEFAULT_REDDIT_SUBREDDITS,
    SCRAPER_TIMEOUT_SECONDS,
    SCRAPER_USER_AGENT,
)
from pipeline.scraper import scrape_page


def _strip_html(text: str) -> str:
    """Convert HTML snippets from APIs and feeds into plain text."""
    if not text:
        return ""
    return BeautifulSoup(text, "html.parser").get_text(" ", strip=True)


def scrape_wikipedia(topic: str, max_articles: int = 50) -> list[dict[str, Any]]:
    """Fetch Wikipedia article text, summaries, and categories for a topic."""
    if not topic or not topic.strip():
        return []

    try:
        import wikipediaapi

        wiki = wikipediaapi.Wikipedia(user_agent=SCRAPER_USER_AGENT, language="en")
        start_page = wiki.page(topic)
        if not start_page.exists():
            logging.info("Wikipedia page not found for topic: %s", topic)
            return []

        pages = [start_page]
        for linked_page in list(start_page.links.values())[: max(0, max_articles - 1)]:
            pages.append(linked_page)

        articles: list[dict[str, Any]] = []
        for page in pages[:max_articles]:
            try:
                if not page.exists():
                    continue
                articles.append(
                    {
                        "source": "wikipedia",
                        "title": page.title,
                        "summary": page.summary,
                        "content": page.text,
                        "categories": list(page.categories.keys()),
                        "url": page.fullurl,
                    }
                )
            except Exception as exc:
                logging.warning("Failed to read Wikipedia page '%s': %s", page.title, exc)
        return articles
    except ImportError:
        logging.warning("wikipedia-api is not installed; skipping Wikipedia.")
    except Exception as exc:
        logging.warning("Wikipedia scrape failed for topic '%s': %s", topic, exc)
    return []


def scrape_reddit(subreddit: str, max_posts: int = 100) -> list[dict[str, Any]]:
    """Fetch top Reddit posts and top comments using PRAW when credentials exist."""
    if not subreddit or not subreddit.strip():
        return []

    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", SCRAPER_USER_AGENT)
    if not client_id or not client_secret:
        logging.info("Missing Reddit credentials; set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.")
        return []

    try:
        import praw

        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
        )
        reddit.read_only = True
        posts: list[dict[str, Any]] = []

        for submission in reddit.subreddit(subreddit).top(time_filter="month", limit=max_posts):
            try:
                submission.comments.replace_more(limit=0)
                top_comments = [
                    comment.body
                    for comment in submission.comments[:5]
                    if getattr(comment, "body", None)
                ]
                posts.append(
                    {
                        "source": "reddit",
                        "title": submission.title,
                        "content": f"{submission.selftext}\n\n" + "\n\n".join(top_comments),
                        "score": submission.score,
                        "url": f"https://www.reddit.com{submission.permalink}",
                        "comments": top_comments,
                    }
                )
            except Exception as exc:
                logging.warning("Failed to process Reddit submission '%s': %s", submission.id, exc)
        return posts
    except ImportError:
        logging.warning("praw is not installed; skipping Reddit.")
    except Exception as exc:
        logging.warning("Reddit scrape failed for r/%s: %s", subreddit, exc)
    return []


def scrape_arxiv(topic: str, max_papers: int = 50) -> list[dict[str, Any]]:
    """Fetch arXiv paper titles, abstracts, authors, and URLs for a topic."""
    if not topic or not topic.strip():
        return []

    try:
        import arxiv

        client = arxiv.Client()
        search = arxiv.Search(
            query=topic,
            max_results=max_papers,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        papers: list[dict[str, Any]] = []
        for result in client.results(search):
            papers.append(
                {
                    "source": "arxiv",
                    "title": result.title,
                    "summary": result.summary,
                    "content": result.summary,
                    "authors": [author.name for author in result.authors],
                    "url": result.entry_id,
                    "published": result.published.isoformat() if result.published else None,
                }
            )
        return papers
    except ImportError:
        logging.warning("arxiv is not installed; skipping arXiv.")
    except Exception as exc:
        logging.warning("arXiv scrape failed for topic '%s': %s", topic, exc)
    return []


def scrape_stackoverflow(tag: str, max_questions: int = 100) -> list[dict[str, Any]]:
    """Fetch Stack Overflow questions and accepted answers for one tag."""
    if not tag or not tag.strip():
        return []

    try:
        from stackapi import StackAPI

        site = StackAPI("stackoverflow")
        site.page_size = min(100, max_questions)
        site.max_pages = max(1, (max_questions + site.page_size - 1) // site.page_size)
        questions = site.fetch(
            "questions",
            tagged=tag,
            sort="votes",
            filter="withbody",
        ).get("items", [])

        records: list[dict[str, Any]] = []
        for question in questions[:max_questions]:
            accepted_answer_id = question.get("accepted_answer_id")
            if not accepted_answer_id:
                continue
            try:
                answer_items = site.fetch(
                    "answers/{ids}",
                    ids=[accepted_answer_id],
                    filter="withbody",
                ).get("items", [])
                if not answer_items:
                    continue
                answer_body = _strip_html(answer_items[0].get("body", ""))
                records.append(
                    {
                        "source": "stackoverflow",
                        "title": _strip_html(question.get("title", "")),
                        "question": _strip_html(question.get("body", "")),
                        "accepted_answer": answer_body,
                        "content": f"{_strip_html(question.get('body', ''))}\n\n{answer_body}",
                        "url": question.get("link"),
                        "tags": question.get("tags", []),
                    }
                )
            except Exception as exc:
                logging.warning("Failed Stack Overflow accepted answer lookup: %s", exc)
        return records
    except ImportError:
        logging.warning("stackapi is not installed; skipping Stack Overflow.")
    except Exception as exc:
        logging.warning("Stack Overflow scrape failed for tag '%s': %s", tag, exc)
    return []


def scrape_news_rss(
    feeds: list[str] | None = None,
    max_articles: int = 100,
) -> list[dict[str, Any]]:
    """Fetch RSS entries and scrape linked article text when robots allow it."""
    selected_feeds = feeds or DEFAULT_NEWS_FEEDS
    try:
        import feedparser
    except ImportError:
        logging.warning("feedparser is not installed; skipping RSS feeds.")
        return []

    articles: list[dict[str, Any]] = []
    for feed_url in selected_feeds:
        if len(articles) >= max_articles:
            break
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                if len(articles) >= max_articles:
                    break
                link = entry.get("link", "")
                summary = _strip_html(entry.get("summary", ""))
                full_text = scrape_page(link) if link else None
                articles.append(
                    {
                        "source": "news_rss",
                        "title": entry.get("title", ""),
                        "summary": summary,
                        "content": full_text or summary,
                        "url": link,
                    }
                )
        except Exception as exc:
            logging.warning("RSS scrape failed for feed %s: %s", feed_url, exc)
    return articles


def _latest_common_crawl_index() -> str | None:
    """Read Common Crawl's archive listing and return the newest CDX API endpoint."""
    try:
        response = requests.get(
            COMMON_CRAWL_COLLINFO_URL,
            headers={"User-Agent": SCRAPER_USER_AGENT},
            timeout=SCRAPER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        archives = response.json()
        if not archives:
            return None
        latest = archives[0]
        return str(latest.get("cdx-api") or latest.get("cdx-api-full") or "")
    except Exception as exc:
        logging.warning("Could not fetch Common Crawl archive list: %s", exc)
        return None


def _extract_warc_html(record_bytes: bytes) -> str:
    """Extract HTML body text from one compressed Common Crawl WARC record."""
    with GzipFile(fileobj=BytesIO(record_bytes)) as gzip_file:
        decompressed = gzip_file.read()

    _, _, after_warc_headers = decompressed.partition(b"\r\n\r\n")
    _, _, body = after_warc_headers.partition(b"\r\n\r\n")
    html = body.decode("utf-8", errors="ignore")
    return _strip_html(html)


def _download_common_crawl_record(item: dict[str, Any]) -> str | None:
    """Download a single indexed Common Crawl byte range and return plain text."""
    filename = item.get("filename")
    offset = item.get("offset")
    length = item.get("length")
    if filename is None or offset is None or length is None:
        return None

    try:
        start = int(offset)
        end = start + int(length) - 1
        response = requests.get(
            f"https://data.commoncrawl.org/{filename}",
            headers={
                "User-Agent": SCRAPER_USER_AGENT,
                "Range": f"bytes={start}-{end}",
            },
            timeout=SCRAPER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return _extract_warc_html(response.content)
    except Exception as exc:
        logging.debug("Could not download Common Crawl record: %s", exc)
        return None


def search_common_crawl(query: str, max_results: int = 100) -> list[dict[str, Any]]:
    """Search the Common Crawl URL index for pages whose URLs match a topic query."""
    if not query or not query.strip():
        return []

    endpoint = _latest_common_crawl_index()
    if not endpoint:
        return []

    url_pattern = f"*{'*'.join(query.lower().split())}*"
    try:
        response = requests.get(
            endpoint,
            params={
                "url": url_pattern,
                "output": "json",
                "filter": "status:200",
                "limit": max_results,
            },
            headers={"User-Agent": SCRAPER_USER_AGENT},
            timeout=SCRAPER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        records: list[dict[str, Any]] = []
        for line in response.text.splitlines():
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except ValueError:
                logging.debug("Skipping malformed Common Crawl index line: %s", line[:120])
                continue
            live_url = item.get("url", "")
            content = _download_common_crawl_record(item)
            records.append(
                {
                    "source": "common_crawl",
                    "title": live_url,
                    "content": content or "",
                    "url": live_url,
                    "timestamp": item.get("timestamp"),
                    "digest": item.get("digest"),
                    "mime": item.get("mime"),
                }
            )
        return records
    except Exception as exc:
        logging.warning("Common Crawl search failed for query '%s': %s", query, exc)
        return []
