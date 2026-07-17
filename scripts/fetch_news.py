#!/usr/bin/env python3
"""
Recupere les flux RSS definis dans feeds.yaml, les classe par onglet/section,
et ecrit le resultat dans data/news.json.

Concu pour tourner dans une GitHub Action (cron), mais fonctionne aussi en local :
    python3 scripts/fetch_news.py
"""
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import feedparser
import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
FEEDS_FILE = ROOT / "feeds.yaml"
OUTPUT_FILE = ROOT / "data" / "news.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; BriefingQuotidienBot/1.0; "
        "+https://github.com/) DailyNewsBriefing/1.0"
    )
}
TIMEOUT = 15


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def normalize(text: str) -> str:
    return strip_accents(text or "").lower()


def clean_summary(raw_html: str, max_len: int = 220) -> str:
    text = re.sub(r"<[^>]+>", " ", raw_html or "")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0] + "…"
    return text


def parse_published(entry) -> datetime:
    for key in ("published", "updated", "created"):
        value = getattr(entry, key, None)
        if value:
            try:
                dt = parsedate_to_datetime(value)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except (TypeError, ValueError):
                pass
    for key in ("published_parsed", "updated_parsed"):
        struct = getattr(entry, key, None)
        if struct:
            try:
                return datetime(*struct[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass
    return datetime.now(timezone.utc)


def fetch_feed_entries(feed_url: str, source_name: str):
    """Telecharge et parse un flux. Renvoie [] en cas d'echec (on ne casse jamais le build)."""
    try:
        resp = requests.get(feed_url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
    except Exception as exc:  # noqa: BLE001 - on veut juste logguer et continuer
        print(f"  [!] echec {source_name} ({feed_url}): {exc}", file=sys.stderr)
        return []

    items = []
    for entry in parsed.entries:
        title = getattr(entry, "title", "").strip()
        link = getattr(entry, "link", "").strip()
        if not title or not link:
            continue
        summary_raw = getattr(entry, "summary", "") or getattr(entry, "description", "")
        items.append(
            {
                "title": title,
                "link": link,
                "source": source_name,
                "summary": clean_summary(summary_raw),
                "published": parse_published(entry).isoformat(),
            }
        )
    return items


def dedupe_sort_trim(items, max_items):
    seen_links = set()
    seen_titles = set()
    unique = []
    for item in items:
        key_title = normalize(item["title"])
        if item["link"] in seen_links or key_title in seen_titles:
            continue
        seen_links.add(item["link"])
        seen_titles.add(key_title)
        unique.append(item)
    unique.sort(key=lambda x: x["published"], reverse=True)
    return unique[:max_items]


def fetch_pool(pool_config, cache):
    """Recupere (avec cache) tous les articles d'un pool de flux partages."""
    pool_key = id(pool_config)
    if pool_key in cache:
        return cache[pool_key]
    all_items = []
    for feed in pool_config.get("feeds", []):
        print(f"    - pool: {feed['source']}")
        all_items.extend(fetch_feed_entries(feed["url"], feed["source"]))
    cache[pool_key] = all_items
    return all_items


def build_section(section_key, section_cfg, family_cfg, pool_cache):
    """family_cfg = le dict de la famille courante (ex: config['noemie']),
    qui contient a la fois les sections et les pools partages (cles finissant par _pool)."""
    label = section_cfg.get("label", section_key)
    max_items = section_cfg.get("max_items", 10)

    if "use_pool" in section_cfg:
        pool_name = section_cfg["use_pool"]
        parent = family_cfg.get(pool_name)
        if parent is None:
            print(f"  [!] pool introuvable: {pool_name}", file=sys.stderr)
            return {"label": label, "items": []}

        keywords = [normalize(k) for k in section_cfg.get("keywords", [])]
        pool_items = fetch_pool(parent, pool_cache)
        matched = []
        for item in pool_items:
            haystack = normalize(item["title"] + " " + item["summary"])
            if any(kw in haystack for kw in keywords):
                matched.append(item)
        return {"label": label, "items": dedupe_sort_trim(matched, max_items)}

    items = []
    for feed in section_cfg.get("feeds", []):
        print(f"    - {feed['source']}")
        items.extend(fetch_feed_entries(feed["url"], feed["source"]))
    return {"label": label, "items": dedupe_sort_trim(items, max_items)}


def main():
    config = yaml.safe_load(FEEDS_FILE.read_text(encoding="utf-8"))
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    for tab_key in ("sebastien", "noemie"):
        tab_cfg = config.get(tab_key, {})
        print(f"[{tab_key}]")
        pool_cache = {}
        tab_result = {}
        for section_key, section_cfg in tab_cfg.items():
            if section_key.endswith("_pool"):
                continue  # ce n'est pas une section affichee, juste un reservoir de flux
            print(f"  section: {section_key}")
            tab_result[section_key] = build_section(section_key, section_cfg, tab_cfg, pool_cache)
        result[tab_key] = tab_result

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nOK -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
