#!/usr/bin/env python3
"""JD scraper for relevant role discovery with persistent resume cache.

Features:
- Native crawl and optional Firecrawl search provider.
- Persistent SQLite cache for processed pages (URL + content hash dedupe).
- Incremental commits after each successful scrape.
- Resume-safe: reruns skip already processed information by default.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus, urljoin, urlparse
from urllib.request import Request, urlopen

USER_AGENT = "MuhFweeCeeVee-JD-Scraper/0.2 (+local-dev)"


@dataclass
class CrawlNode:
  url: str
  depth: int


@dataclass
class RelevantJD:
  url: str
  title: str
  score: float
  matched_keywords: list[str]
  role_hits: list[str]
  domain: str
  snippet: str


class LinkParser(HTMLParser):
  def __init__(self) -> None:
    super().__init__()
    self.links: list[str] = []

  def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
    if tag.lower() != "a":
      return
    for key, value in attrs:
      if key.lower() == "href" and value:
        self.links.append(value.strip())


def utc_now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def text_hash(value: str) -> str:
  return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def load_seed_urls(path: Path) -> list[str]:
  if not path.exists():
    return []
  urls: list[str] = []
  for line in path.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
      continue
    urls.append(stripped)
  return urls


def load_keyword_config(path: Path) -> dict:
  data = json.loads(path.read_text(encoding="utf-8"))
  data.setdefault("target_roles", [])
  data.setdefault("weighted_keywords", {})
  data.setdefault("job_signals", [])
  data.setdefault("native_query_suffixes", [])
  data.setdefault("native_search_templates", [])
  return data


def build_native_seed_urls(static_seeds: list[str], config: dict) -> list[str]:
  """Expand native crawl seeds from target roles and search templates."""
  default_suffixes = [
    "jobs",
    "job description",
    "careers",
    "remote jobs",
    "hiring",
    "open positions",
  ]
  default_templates = [
    "https://duckduckgo.com/html/?q={query}",
    "https://www.bing.com/search?q={query}",
    "https://www.indeed.com/jobs?q={query}",
    "https://www.indeed.com/jobs?q={query}&sort=date",
    "https://www.simplyhired.com/search?q={query}",
    "https://www.ziprecruiter.com/jobs-search?search={query}",
  ]

  target_roles = [str(role).strip() for role in config.get("target_roles", []) if str(role).strip()]
  suffixes = [str(item).strip() for item in config.get("native_query_suffixes", default_suffixes) if str(item).strip()]
  templates = [
    str(item).strip()
    for item in config.get("native_search_templates", default_templates)
    if str(item).strip()
  ]

  out: list[str] = []
  seen: set[str] = set()

  def add(url: str) -> None:
    if not url:
      return
    if url in seen:
      return
    seen.add(url)
    out.append(url)

  for seed in static_seeds:
    add(seed)

  for role in target_roles:
    role_query = quote_plus(role)
    for template in templates:
      add(template.format(query=role_query))
    for suffix in suffixes:
      composed = quote_plus(f"{role} {suffix}")
      for template in templates:
        add(template.format(query=composed))

  return out


def connect_db(db_path: Path) -> sqlite3.Connection:
  db_path.parent.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(str(db_path))
  conn.execute("PRAGMA journal_mode=WAL")
  conn.execute("PRAGMA synchronous=NORMAL")
  conn.execute(
    """
    CREATE TABLE IF NOT EXISTS scraped_pages (
      url TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      title TEXT,
      description TEXT,
      content_hash TEXT,
      score REAL,
      matched_keywords_json TEXT,
      role_hits_json TEXT,
      snippet TEXT,
      is_relevant INTEGER NOT NULL DEFAULT 0,
      scraped INTEGER NOT NULL DEFAULT 1,
      scraped_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )
    """
  )
  conn.execute(
    """
    CREATE TABLE IF NOT EXISTS run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL
    )
    """
  )
  conn.execute("CREATE INDEX IF NOT EXISTS idx_scraped_pages_hash ON scraped_pages(content_hash)")
  conn.execute("CREATE INDEX IF NOT EXISTS idx_scraped_pages_relevant ON scraped_pages(is_relevant, score DESC)")
  conn.commit()
  return conn


def url_already_scraped(conn: sqlite3.Connection, url: str) -> bool:
  row = conn.execute("SELECT 1 FROM scraped_pages WHERE url = ?", (url,)).fetchone()
  return row is not None


def hash_already_scraped(conn: sqlite3.Connection, content_digest: str) -> bool:
  if not content_digest:
    return False
  row = conn.execute("SELECT 1 FROM scraped_pages WHERE content_hash = ? LIMIT 1", (content_digest,)).fetchone()
  return row is not None


def upsert_scraped_page(
  conn: sqlite3.Connection,
  *,
  url: str,
  provider: str,
  title: str,
  description: str,
  content_hash_value: str,
  score: float,
  matched_keywords: list[str],
  role_hits: list[str],
  snippet: str,
  is_relevant: bool,
) -> None:
  now = utc_now_iso()
  conn.execute(
    """
    INSERT INTO scraped_pages (
      url, provider, title, description, content_hash, score,
      matched_keywords_json, role_hits_json, snippet,
      is_relevant, scraped, scraped_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      provider = excluded.provider,
      title = excluded.title,
      description = excluded.description,
      content_hash = excluded.content_hash,
      score = excluded.score,
      matched_keywords_json = excluded.matched_keywords_json,
      role_hits_json = excluded.role_hits_json,
      snippet = excluded.snippet,
      is_relevant = excluded.is_relevant,
      scraped = 1,
      last_seen_at = excluded.last_seen_at
    """,
    (
      url,
      provider,
      title,
      description,
      content_hash_value,
      score,
      json.dumps(sorted(set(matched_keywords)), ensure_ascii=False),
      json.dumps(sorted(set(role_hits)), ensure_ascii=False),
      snippet,
      1 if is_relevant else 0,
      now,
      now,
    ),
  )
  conn.commit()


def append_event(conn: sqlite3.Connection, run_id: str, provider: str, event_type: str, url: str = "") -> None:
  conn.execute(
    "INSERT INTO run_events (run_id, provider, event_type, url, created_at) VALUES (?, ?, ?, ?, ?)",
    (run_id, provider, event_type, url, utc_now_iso()),
  )
  conn.commit()


def fetch_html(url: str, timeout: int) -> str:
  request = Request(url, headers={"User-Agent": USER_AGENT})
  with urlopen(request, timeout=timeout) as response:  # noqa: S310
    content_type = (response.headers.get("Content-Type") or "").lower()
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
      return ""
    raw = response.read()
  return raw.decode("utf-8", errors="ignore")


def extract_title(html: str) -> str:
  match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
  if not match:
    return ""
  return re.sub(r"\s+", " ", match.group(1)).strip()


def strip_html_to_text(html: str) -> str:
  without_script = re.sub(
    r"<script[\\s\\S]*?</script>|<style[\\s\\S]*?</style>",
    " ",
    html,
    flags=re.IGNORECASE,
  )
  text = re.sub(r"<[^>]+>", " ", without_script)
  return re.sub(r"\s+", " ", text).strip()


def extract_links(base_url: str, html: str) -> list[str]:
  parser = LinkParser()
  parser.feed(html)
  links: list[str] = []
  for href in parser.links:
    absolute = urljoin(base_url, href)
    parsed = urlparse(absolute)
    if parsed.scheme not in ("http", "https"):
      continue
    clean = absolute.split("#", 1)[0]
    links.append(clean)
  return links


def is_likely_job_page(url: str, text: str, signals: Iterable[str]) -> bool:
  lowered = text.lower()
  parsed = urlparse(url)
  url_hint = any(token in parsed.path.lower() for token in ("job", "jobs", "career", "position", "vacancy"))
  signal_hint = any(signal.lower() in lowered for signal in signals)
  return url_hint or signal_hint


def score_relevance(title: str, text: str, config: dict) -> tuple[float, list[str], list[str]]:
  lowered_title = title.lower()
  lowered_text = text.lower()
  weighted_keywords = config.get("weighted_keywords", {})
  target_roles = [str(role).lower() for role in config.get("target_roles", [])]

  matched_keywords: list[str] = []
  score = 0.0

  for keyword, weight in weighted_keywords.items():
    key = str(keyword).lower().strip()
    if not key:
      continue
    in_title = key in lowered_title
    in_text = key in lowered_text
    if in_title or in_text:
      matched_keywords.append(keyword)
      if in_title:
        score += float(weight) * 1.6
      if in_text:
        score += float(weight)

  role_hits = [role for role in target_roles if role in lowered_title or role in lowered_text]
  score += len(role_hits) * 3.0

  return score, matched_keywords, role_hits


def run_scrape_native(
  conn: sqlite3.Connection,
  run_id: str,
  seed_urls: list[str],
  config: dict,
  max_pages: int,
  max_depth: int,
  min_score: float,
  max_results: int,
  timeout: int,
  sleep_ms: int,
) -> tuple[list[RelevantJD], dict[str, int]]:
  queue: deque[CrawlNode] = deque(CrawlNode(url=url, depth=0) for url in seed_urls)
  visited_in_run: set[str] = set()
  relevant: list[RelevantJD] = []

  stats = {
    "attempted": 0,
    "scraped_new": 0,
    "skipped_url_cached": 0,
    "skipped_hash_cached": 0,
    "errors": 0,
  }

  while queue and len(visited_in_run) < max_pages and len(relevant) < max_results:
    node = queue.popleft()
    if node.url in visited_in_run:
      continue
    visited_in_run.add(node.url)
    stats["attempted"] += 1

    if url_already_scraped(conn, node.url):
      stats["skipped_url_cached"] += 1
      continue

    try:
      html = fetch_html(node.url, timeout=timeout)
    except Exception:
      stats["errors"] += 1
      append_event(conn, run_id, "native", "fetch_error", node.url)
      continue
    if not html:
      continue

    title = extract_title(html)
    text = strip_html_to_text(html)
    digest = text_hash(text)
    if hash_already_scraped(conn, digest):
      stats["skipped_hash_cached"] += 1
      upsert_scraped_page(
        conn,
        url=node.url,
        provider="native",
        title=title,
        description="",
        content_hash_value=digest,
        score=0.0,
        matched_keywords=[],
        role_hits=[],
        snippet=text[:300],
        is_relevant=False,
      )
      continue

    score, matched_keywords, role_hits = score_relevance(title, text, config)
    relevant_hit = is_likely_job_page(node.url, text, config.get("job_signals", [])) and score >= min_score

    upsert_scraped_page(
      conn,
      url=node.url,
      provider="native",
      title=title,
      description="",
      content_hash_value=digest,
      score=round(score, 2),
      matched_keywords=matched_keywords,
      role_hits=role_hits,
      snippet=text[:300],
      is_relevant=relevant_hit,
    )
    stats["scraped_new"] += 1

    if relevant_hit:
      relevant.append(
        RelevantJD(
          url=node.url,
          title=title,
          score=round(score, 2),
          matched_keywords=sorted(set(matched_keywords)),
          role_hits=sorted(set(role_hits)),
          domain=urlparse(node.url).netloc,
          snippet=text[:300],
        )
      )

    if node.depth < max_depth:
      for link in extract_links(node.url, html):
        if link not in visited_in_run:
          queue.append(CrawlNode(url=link, depth=node.depth + 1))

    if sleep_ms > 0:
      time.sleep(sleep_ms / 1000)

  relevant.sort(key=lambda item: item.score, reverse=True)
  return relevant[:max_results], stats


def firecrawl_search(
  api_key: str,
  api_base: str,
  query: str,
  limit: int,
  timeout: int,
) -> list[dict]:
  endpoint = f"{api_base.rstrip('/')}/search"
  body = {
    "query": query,
    "sources": ["web"],
    "limit": limit,
    "scrapeOptions": {
      "formats": ["markdown"],
    },
  }
  payload = json.dumps(body).encode("utf-8")
  request = Request(
    endpoint,
    data=payload,
    headers={
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      "Authorization": f"Bearer {api_key}",
    },
    method="POST",
  )
  with urlopen(request, timeout=timeout) as response:  # noqa: S310
    raw = response.read().decode("utf-8", errors="ignore")
  parsed = json.loads(raw)

  data_node = parsed.get("data", [])
  if isinstance(data_node, list):
    return data_node
  if isinstance(data_node, dict):
    web_results = data_node.get("web", [])
    return web_results if isinstance(web_results, list) else []
  return []


def run_scrape_firecrawl(
  conn: sqlite3.Connection,
  run_id: str,
  config: dict,
  api_key: str,
  api_base: str,
  per_query_limit: int,
  timeout: int,
  min_score: float,
  max_results: int,
  sleep_ms: int,
) -> tuple[list[RelevantJD], dict[str, int]]:
  target_roles = [str(role).strip() for role in config.get("target_roles", []) if str(role).strip()]
  queries = [f"{role} job description" for role in target_roles]
  unique_queries = list(dict.fromkeys(queries))

  by_url: dict[str, RelevantJD] = {}
  stats = {
    "attempted": 0,
    "scraped_new": 0,
    "skipped_url_cached": 0,
    "skipped_hash_cached": 0,
    "errors": 0,
  }

  for query in unique_queries:
    try:
      rows = firecrawl_search(api_key, api_base, query, per_query_limit, timeout)
    except Exception:
      stats["errors"] += 1
      append_event(conn, run_id, "firecrawl", "search_error", query)
      continue

    for row in rows:
      stats["attempted"] += 1
      if not isinstance(row, dict):
        continue
      url = str(row.get("url") or "").strip()
      if not url:
        continue

      if url_already_scraped(conn, url):
        stats["skipped_url_cached"] += 1
        continue

      title = str(row.get("title") or "").strip()
      description = str(row.get("description") or "").strip()
      markdown = str(row.get("markdown") or "").strip()
      combined = " ".join(part for part in (title, description, markdown) if part)
      if not combined:
        continue

      digest = text_hash(combined)
      if hash_already_scraped(conn, digest):
        stats["skipped_hash_cached"] += 1
        upsert_scraped_page(
          conn,
          url=url,
          provider="firecrawl",
          title=title,
          description=description,
          content_hash_value=digest,
          score=0.0,
          matched_keywords=[],
          role_hits=[],
          snippet=combined[:300],
          is_relevant=False,
        )
        continue

      if not is_likely_job_page(url, combined, config.get("job_signals", [])):
        upsert_scraped_page(
          conn,
          url=url,
          provider="firecrawl",
          title=title,
          description=description,
          content_hash_value=digest,
          score=0.0,
          matched_keywords=[],
          role_hits=[],
          snippet=combined[:300],
          is_relevant=False,
        )
        stats["scraped_new"] += 1
        continue

      score, matched_keywords, role_hits = score_relevance(title, combined, config)
      relevant_hit = score >= min_score
      upsert_scraped_page(
        conn,
        url=url,
        provider="firecrawl",
        title=title,
        description=description,
        content_hash_value=digest,
        score=round(score, 2),
        matched_keywords=matched_keywords,
        role_hits=role_hits,
        snippet=combined[:300],
        is_relevant=relevant_hit,
      )
      stats["scraped_new"] += 1

      if relevant_hit:
        candidate = RelevantJD(
          url=url,
          title=title,
          score=round(score, 2),
          matched_keywords=sorted(set(matched_keywords)),
          role_hits=sorted(set(role_hits)),
          domain=urlparse(url).netloc,
          snippet=combined[:300],
        )
        existing = by_url.get(url)
        if existing is None or candidate.score > existing.score:
          by_url[url] = candidate

      if len(by_url) >= max_results:
        break

    if len(by_url) >= max_results:
      break

    if sleep_ms > 0:
      time.sleep(sleep_ms / 1000)

  ranked = sorted(by_url.values(), key=lambda item: item.score, reverse=True)
  return ranked[:max_results], stats


def load_top_relevant_from_db(conn: sqlite3.Connection, limit: int) -> list[RelevantJD]:
  rows = conn.execute(
    """
    SELECT url, COALESCE(title, ''), COALESCE(score, 0),
           COALESCE(matched_keywords_json, '[]'),
           COALESCE(role_hits_json, '[]'),
           COALESCE(snippet, '')
    FROM scraped_pages
    WHERE is_relevant = 1
    ORDER BY score DESC, last_seen_at DESC
    LIMIT ?
    """,
    (limit,),
  ).fetchall()

  out: list[RelevantJD] = []
  for url, title, score, matched_json, role_json, snippet in rows:
    try:
      matched = json.loads(matched_json) if matched_json else []
    except Exception:
      matched = []
    try:
      role_hits = json.loads(role_json) if role_json else []
    except Exception:
      role_hits = []
    out.append(
      RelevantJD(
        url=url,
        title=title,
        score=float(score or 0),
        matched_keywords=matched if isinstance(matched, list) else [],
        role_hits=role_hits if isinstance(role_hits, list) else [],
        domain=urlparse(url).netloc,
        snippet=snippet,
      )
    )
  return out


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Scrape and rank relevant job descriptions.")
  parser.add_argument("--seed-file", default="sources/seed_urls.txt")
  parser.add_argument("--keyword-file", default="config/relevance_keywords.json")
  parser.add_argument("--output", default="")
  parser.add_argument("--max-pages", type=int, default=250)
  parser.add_argument("--max-depth", type=int, default=2)
  parser.add_argument("--min-score", type=float, default=10.0)
  parser.add_argument("--max-results", type=int, default=200)
  parser.add_argument("--timeout", type=int, default=15)
  parser.add_argument("--sleep-ms", type=int, default=120)
  parser.add_argument("--provider", default="native", choices=["native", "firecrawl"])
  parser.add_argument(
    "--firecrawl-api-base",
    default=os.environ.get("FIRECRAWL_API_BASE", "https://api.firecrawl.dev/v2"),
  )
  parser.add_argument("--firecrawl-per-query-limit", type=int, default=8)
  parser.add_argument("--cache-db", default="outputs/jd_scrape_cache.sqlite")
  parser.add_argument(
    "--mode",
    default="resume",
    choices=["start", "resume"],
    help="resume=skip cached pages, start=reset cache then scrape from scratch",
  )
  parser.add_argument("--reset-cache", action="store_true", help="Delete cache DB before run.")
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  root = Path(__file__).resolve().parent
  seed_file = (root / args.seed_file).resolve()
  keyword_file = (root / args.keyword_file).resolve()
  cache_db = (root / args.cache_db).resolve()

  if not keyword_file.exists():
    print(f"Keyword config missing: {keyword_file}", file=sys.stderr)
    return 2

  reset_cache = args.reset_cache or args.mode == "start"
  if reset_cache and cache_db.exists():
    cache_db.unlink()

  conn = connect_db(cache_db)
  run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

  config = load_keyword_config(keyword_file)

  if args.provider == "firecrawl":
    firecrawl_api_key = os.environ.get("FIRECRAWL_API_KEY", "").strip()
    if not firecrawl_api_key:
      print("FIRECRAWL_API_KEY is required for --provider firecrawl.", file=sys.stderr)
      return 2
    seed_urls: list[str] = []
    append_event(conn, run_id, "firecrawl", "run_started")
    relevant, stats = run_scrape_firecrawl(
      conn=conn,
      run_id=run_id,
      config=config,
      api_key=firecrawl_api_key,
      api_base=args.firecrawl_api_base,
      per_query_limit=args.firecrawl_per_query_limit,
      timeout=args.timeout,
      min_score=args.min_score,
      max_results=args.max_results,
      sleep_ms=args.sleep_ms,
    )
  else:
    static_seed_urls = load_seed_urls(seed_file)
    seed_urls = build_native_seed_urls(static_seed_urls, config)
    if not seed_urls:
      print(f"No seed URLs found in {seed_file}", file=sys.stderr)
      return 2
    append_event(conn, run_id, "native", "run_started")
    relevant, stats = run_scrape_native(
      conn=conn,
      run_id=run_id,
      seed_urls=seed_urls,
      config=config,
      max_pages=args.max_pages,
      max_depth=args.max_depth,
      min_score=args.min_score,
      max_results=args.max_results,
      timeout=args.timeout,
      sleep_ms=args.sleep_ms,
    )

  cached_relevant = load_top_relevant_from_db(conn, args.max_results)
  append_event(conn, run_id, args.provider, "run_finished")

  now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
  output_path = (
    Path(args.output).resolve()
    if args.output
    else (root / "outputs" / f"jd_relevant_{now}.json").resolve()
  )
  output_path.parent.mkdir(parents=True, exist_ok=True)

  payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "run_id": run_id,
    "provider": args.provider,
    "mode": args.mode,
    "cache_db": str(cache_db),
    "seed_urls": seed_urls,
    "target_roles": config.get("target_roles", []),
    "stats": stats,
    "run_relevant_count": len(relevant),
    "cached_relevant_count": len(cached_relevant),
    "items": [asdict(item) for item in cached_relevant],
  }
  output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

  print(f"Saved {len(cached_relevant)} relevant JD pages to {output_path}")
  print(
    "Run stats: "
    f"attempted={stats['attempted']} "
    f"scraped_new={stats['scraped_new']} "
    f"skipped_url_cached={stats['skipped_url_cached']} "
    f"skipped_hash_cached={stats['skipped_hash_cached']} "
    f"errors={stats['errors']}"
  )
  if cached_relevant:
    top = cached_relevant[0]
    print(f"Top match: {top.title or '(no title)'} | score={top.score} | {top.url}")
  print(f"Cache DB: {cache_db}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
