#!/usr/bin/env python3
import json
import logging
import os
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

import asyncio
import re as _re
from bs4 import BeautifulSoup

from auth import verify_authing_token
from database import db
from agent_runner import AgentRunner
from utils import get_basic_info, get_post_history, get_article_detail
from routers.auth_router import router as auth_router
from routers.invite_router import router as invite_router
from routers.users_router import router as users_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Curation App Backend")

_UNPROTECTED_PREFIXES = ("/auth/", "/health")
_UNPROTECTED_PATHS = {"/health", "/auth/validate-invite", "/auth/register",
                      "/auth/login"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS":
            return await call_next(request)
        if path in _UNPROTECTED_PATHS or path.startswith("/auth/"):
            return await call_next(request)
        # WebSocket upgrade: let through (handler validates token via query param)
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Authorization header required"}, status_code=401)
        token = auth_header[7:]
        try:
            claims = await verify_authing_token(token)
            sub = claims.get("sub")
            user = db.get_user_by_sub(sub) if sub else None
            if not user or not user["is_active"]:
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
            request.state.user = user
        except HTTPException as e:
            return JSONResponse({"detail": e.detail}, status_code=e.status_code)

        return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "https://tauri.localhost",
        "http://localhost:1420",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)

app.include_router(auth_router, prefix="/auth")
app.include_router(invite_router, prefix="/invites")
app.include_router(users_router, prefix="/users")

# ------------------------------------------------------------------
# Paths (data dir is external — configured via CURATION_DATA_DIR)
# ------------------------------------------------------------------

_data_dir = Path(os.environ.get("CURATION_DATA_DIR",
                                str(Path(__file__).parent)))
_agent_repo = Path(os.environ.get("CURATION_AGENT_REPO", ""))

SAVE_DIR = _data_dir / "received_articles"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(SAVE_DIR)), name="static")

# AgentRunner (None if agent repo not configured)
runner: Optional[AgentRunner] = None
if _agent_repo.exists():
    runner = AgentRunner(agent_repo=_agent_repo, data_dir=_data_dir, db=db)
else:
    logging.warning("CURATION_AGENT_REPO not set or not found — analysis features disabled")


def _require_runner() -> AgentRunner:
    if runner is None:
        raise HTTPException(503, "Agent runner not configured (set CURATION_AGENT_REPO)")
    return runner


class ArticlePayload(BaseModel):
    title: str
    author: str
    account: str
    date: str
    url: str
    html: str
    biz: Optional[str] = None
    avatar: Optional[str] = None
    digest: Optional[str] = None
    cover_url: Optional[str] = None
    is_original: bool = False


@app.post("/process")
async def process_article(payload: ArticlePayload, request: Request):
    """
    Handle articles sent from Tauri browser extraction.
    Will attempt to enrich with API data if possible.
    """
    user_id = request.state.user["id"]
    url = payload.url
    detail = None
    
    # Try to fetch full-fidelity data from API first
    try:
        detail = await get_article_detail(url, mode="2")
    except Exception as e:
        logging.warning(f"API fetch failed in /process (falling back to DOM): {e}")

    # Use API data if available, otherwise use payload data
    title = (detail.get("title") if detail else None) or payload.title
    author = (detail.get("author") if detail else None) or payload.author
    account_name = (detail.get("nick_name") if detail else None) or payload.account
    content = (detail.get("content") if detail else None) or ""
    biz = (detail.get("biz") if detail else None) or payload.biz or ""
    publish_time = (detail.get("pubtime") if detail else None) or payload.date
    digest = (detail.get("desc") if detail else None) or payload.digest
    cover_url = (detail.get("mp_head_img") if detail else None) or payload.cover_url
    is_original = (detail.get("copyright_stat", 0) == 1 if detail else False) or payload.is_original

    # Ensure account exists
    account_id = None
    if biz:
        existing_acc = db.get_account_by_biz(biz, user_id)
        if not existing_acc:
            try:
                acc_info = await get_basic_info(account_name)
                account_id = db.save_account(
                    biz=biz, name=acc_info["name"], user_id=user_id,
                    avatar_url=acc_info.get("avatar", "") or cover_url,
                    description=acc_info.get("desc", ""),
                    account_type=acc_info.get("type", ""),
                    gh_id=acc_info.get("gh_id") or acc_info.get("wxid"),
                    signature=acc_info.get("signature"),
                )
            except Exception:
                account_id = db.save_account(biz=biz, name=account_name, user_id=user_id, avatar_url=cover_url)
        else:
            account_id = existing_acc["id"]

    # Save local files
    short_id = _extract_short_id(url)
    art_dir = SAVE_DIR / short_id
    art_dir.mkdir(parents=True, exist_ok=True)
    
    # Markdown
    header = (f"# {title}\n\n**公众号**: {account_name}\n"
              f"**作者**: {author or account_name}\n"
              f"**原文**: {url}\n\n---\n\n")
    md_file = art_dir / "article.md"
    # Use API content if we have it, else we might not have decent content from DOM (Tauri payload.html is RAW HTML)
    # But Tauri's cleaner is usually on the server side.
    # Actually, the NEW server doesn't have the 'cleaner' module yet?
    # No, I don't see it in imports.
    # Wait, the old server had 'from cleaner import cleaner'.
    # If the new server doesn't have it, we MUST rely on the API for Markdown.
    
    if detail and detail.get("content"):
        md_file.write_text(header + detail["content"], encoding="utf-8")
    else:
        # Fallback: if no API, we just write the header.
        # (We could add the 'cleaner' here if it exists in the new repo)
        md_file.write_text(header + "(No markdown content available via API)", encoding="utf-8")

    # HTML
    html_content = (detail.get("content_multi_text") if detail else None) or payload.html
    html_file = None
    if html_content:
        # Simple cleanup
        html_content = html_content.replace('data-src="', 'src="').replace("data-src='", "src='")
        html_file = art_dir / "article.html"
        html_file.write_text(f"<div class='rich-text-content'>{html_content}</div>", encoding="utf-8")

    # Meta.json (100% preservation)
    meta_payload = {**(detail or {}), **payload.model_dump()}
    # Exclude large fields
    meta_to_save = {k: v for k, v in meta_payload.items() if k not in ("content", "content_multi_text", "html")}
    full_meta = {
        **meta_to_save,
        "short_id": short_id,
        "markdown_file": str(md_file),
        "html_file": str(html_file) if html_file else None,
        "received_at": datetime.now().strftime("%Y%m%d_%H%M%S"),
    }
    (art_dir / "meta.json").write_text(json.dumps(full_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # DB Save
    db.save_article(
        url=url, title=title, author=author, account=account_name,
        publish_time=publish_time, markdown_path=str(md_file),
        html_path=str(html_file) if html_file else None,
        account_id=account_id, cover_url=cover_url,
        digest=digest, is_original=is_original,
        # API Enrichment
        hashid=detail.get("hashid") if detail else None,
        idx=detail.get("idx") if detail else None,
        ip_wording=detail.get("ip_wording") if detail else None,
        publish_timestamp=detail.get("post_time") if detail else None,
        user_name=detail.get("user_name") if detail else None,
        alias=detail.get("alias") if detail else None,
        # ... and so on
    )
    
    return {"status": "ok", "message": "Article processed with high fidelity", "id": short_id}


@app.get("/accounts")
async def get_accounts(request: Request):
    user_id = request.state.user["id"]
    accounts = db.get_accounts(user_id)
    for acc in accounts:
        acc["article_count"] = db.get_article_count_by_account(acc["id"])
    return {"status": "ok", "data": accounts}


class SubscribeRequest(BaseModel):
    name: str   # account name to search via dajiala API


@app.post("/accounts/subscribe")
async def subscribe_account(req: SubscribeRequest, request: Request):
    user_id = request.state.user["id"]
    try:
        info = await get_basic_info(req.name)
    except Exception as e:
        raise HTTPException(400, f"查询公众号失败: {e}")

    biz = info["biz"]
    existing = db.get_account_by_biz(biz, user_id)
    is_new = not existing or existing.get("subscription_type") != "subscribed"

    account_id = db.save_account(
        biz=biz,
        name=info["name"],
        user_id=user_id,
        avatar_url=info.get("avatar", ""),
        description=info.get("desc", ""),
        account_type=info.get("type", ""),
        subscription_type="subscribed",
    )

    if is_new:
        asyncio.create_task(
            _sync_account_articles(account_id, biz, info["name"],
                                   since_date=date.today().isoformat())
        )

    return {"status": "ok", "account_id": account_id, "data": dict(info)}


@app.delete("/accounts/{account_id}")
async def delete_account(account_id: int, request: Request):
    user_id = request.state.user["id"]
    acc = next((a for a in db.get_accounts(user_id) if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    db.delete_account(account_id)
    return {"status": "ok"}


async def _sync_account_articles(account_id: int, biz: str, account_name: str,
                                  since_date: str = None) -> int:
    """Fetch and store article metadata for an account since a given date.
    Content is NOT fetched — lazy-loaded when user opens the article.
    Returns count of new articles added."""
    if since_date is None:
        since_date = date.today().isoformat()

    try:
        history = await get_post_history(biz=biz, page=1)
    except Exception as e:
        logging.warning(f"获取文章列表失败 ({account_name}): {e}")
        return 0

    # Capture and preserve account-level metadata from the history response
    mp_wxid = history.get("mp_wxid")
    mp_ghid = history.get("mp_ghid")
    head_img = history.get("head_img")
    mp_nickname = history.get("mp_nickname")

    # Update account meta if we have new info (need user_id for the update)
    acc_row = db.conn.execute("SELECT user_id FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if acc_row:
        db.save_account(
            biz=biz, name=mp_nickname or account_name, user_id=acc_row[0],
            wxid=mp_wxid, gh_id=mp_ghid, avatar_url=head_img,
            publish_count=history.get("publish_count"),
            masssend_count=history.get("masssend_count"),
            remain_money=history.get("remain_money"),
            cost_money=history.get("cost_money"),
            total_num=history.get("total_num")
        )

    articles_raw = history.get("data", [])
    new_count = 0

    for art_meta in articles_raw:
        url = art_meta.get("url", "")
        if not url or db.get_article(url):
            continue

        post_time_str = art_meta.get("post_time_str", "")
        title = art_meta.get("title", "")
        cover_url = art_meta.get("cover_url", "")
        digest = art_meta.get("digest", "")
        is_orig = art_meta.get("original", 0) == 1

        db.save_article(
            url=url, title=title, author="", account=account_name,
            publish_time=post_time_str, markdown_path=None,
            account_id=account_id, digest=digest,
            cover_url=cover_url, is_original=is_orig,
            # All available fields from history list entry
            position=art_meta.get("position"),
            publish_timestamp=art_meta.get("post_time"),
            item_show_type=art_meta.get("item_show_type"),
            pre_post_time=str(art_meta.get("pre_post_time")) if art_meta.get("pre_post_time") else None,
            msg_status=art_meta.get("msg_status"),
            msg_fail_reason=art_meta.get("msg_fail_reason"),
            send_to_fans_num=art_meta.get("send_to_fans_num"),
            is_deleted=art_meta.get("is_deleted"),
            types=art_meta.get("types"),
            copyright_stat=art_meta.get("original")
        )

        # Save FULL metadata to json even if content is not yet fetched
        short_id = _extract_short_id(url)
        art_dir = SAVE_DIR / short_id
        art_dir.mkdir(parents=True, exist_ok=True)
        meta_payload = {
            **art_meta,
            "short_id": short_id,
            "account_name": account_name,
            "account_id": account_id,
            "biz": biz,
            "received_at": datetime.now().strftime("%Y%m%d_%H%M%S")
        }
        (art_dir / "meta.json").write_text(json.dumps(meta_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        new_count += 1

    db.update_account_last_monitored(account_id)
    return new_count


@app.post("/accounts/{account_id}/sync")
async def sync_account(account_id: int, request: Request):
    user_id = request.state.user["id"]
    accounts = db.get_accounts(user_id)
    acc = next((a for a in accounts if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    new_count = await _sync_account_articles(account_id, acc["biz"], acc["name"])
    return {"status": "ok", "new_count": new_count}


@app.post("/accounts/sync-all")
async def sync_all_accounts(request: Request):
    user_id = request.state.user["id"]
    accounts = db.get_accounts(user_id)
    total = 0
    for acc in accounts:
        try:
            total += await _sync_account_articles(acc["id"], acc["biz"], acc["name"])
        except Exception:
            pass
    return {"status": "ok", "new_count": total}


@app.get("/articles")
async def get_articles(request: Request, account_id: Optional[int] = None):
    user_id = request.state.user["id"]
    if account_id:
        articles = db.get_articles_by_account(account_id, user_id=user_id)
    else:
        articles = db.get_all_articles(user_id)
    return {"status": "ok", "data": articles}


@app.delete("/articles/{article_id}")
async def delete_article(article_id: int):
    db.delete_article(article_id)
    return {"status": "ok", "message": "Article deleted"}


@app.post("/articles/{article_id}/read")
async def update_read_status(article_id: int, status: int = 1):
    db.update_read_status(article_id, status)
    return {"status": "ok"}


class AddArticleRequest(BaseModel):
    url: str
    subscribe: bool = False


@app.post("/articles/add")
async def add_article(req: AddArticleRequest, request: Request):
    """Add a single article by URL, auto-detecting or creating the account."""
    user_id = request.state.user["id"]
    if db.get_article(req.url):
        return {"status": "ok", "new": False}

    try:
        detail = await get_article_detail(req.url, mode="2")
    except Exception as e:
        raise HTTPException(400, f"获取文章失败: {e}")

    biz = detail.get("biz", "")
    if not biz:
        raise HTTPException(400, "无法获取公众号 biz，链接可能无效")

    title = detail.get("title", "")
    author = detail.get("author", "")
    content = detail.get("content", "")
    cover_url = detail.get("mp_head_img", "")
    publish_time = detail.get("pubtime", "")
    account_name = detail.get("nick_name", "")
    is_original = detail.get("copyright_stat", 0) == 1
    digest = detail.get("desc", "")

    existing_acc = db.get_account_by_biz(biz, user_id)
    is_new_account = not existing_acc

    if is_new_account:
        # First time tracking this account — fetch full info from API
        try:
            acc_info = await get_basic_info(account_name)
            save_kwargs = dict(
                biz=biz, name=acc_info["name"], user_id=user_id,
                avatar_url=acc_info.get("avatar", "") or cover_url,
                description=acc_info.get("desc", ""),
                account_type=acc_info.get("type", ""),
                gh_id=acc_info.get("gh_id") or acc_info.get("wxid"),
                signature=acc_info.get("signature"),
            )
        except Exception:
            save_kwargs = dict(biz=biz, name=account_name, user_id=user_id, avatar_url=cover_url)
    else:
        save_kwargs = dict(biz=biz, name=account_name, user_id=user_id, avatar_url=cover_url)

    if existing_acc and existing_acc["subscription_type"] == "subscribed":
        sub_type = "subscribed"
    else:
        sub_type = "subscribed" if req.subscribe else "temporary"

    account_id = db.save_account(**save_kwargs, subscription_type=sub_type)

    if is_new_account and req.subscribe:
        asyncio.create_task(
            _sync_account_articles(account_id, biz, account_name,
                                   since_date=date.today().isoformat())
        )

    short_id = _extract_short_id(req.url)
    art_dir = SAVE_DIR / short_id
    art_dir.mkdir(parents=True, exist_ok=True)
    header = (f"# {title}\n\n**公众号**: {account_name}\n"
              f"**作者**: {author or account_name}\n"
              f"**原文**: {req.url}\n\n---\n\n")
    md_file = art_dir / "article.md"
    md_file.write_text(header + content, encoding="utf-8")

    # Save HTML (rich text) if available
    html_content = detail.get("content_multi_text", "")
    html_file = None
    if html_content:
        html_content = html_content.replace('data-src="', 'src="').replace("data-src='", "src='")
        html_content = _re.sub(r'<img\b', '<img referrerpolicy="no-referrer"', html_content, flags=_re.IGNORECASE)
        html_content = _adapt_color_styles(html_content)
        html_file = art_dir / "article.html"
        html_file.write_text(f"<div class='rich-text-content'>{html_content}</div>", encoding="utf-8")

    # Combine original detail with local info for the full meta.json
    # Exclude large content fields from JSON as they are saved separately
    meta_to_save = {k: v for k, v in detail.items() if k not in ("content", "content_multi_text", "html")}
    full_meta = {
        **meta_to_save,
        "short_id": short_id,
        "markdown_file": str(md_file),
        "html_file": str(html_file) if html_file else None,
        "received_at": datetime.now().strftime("%Y%m%d_%H%M%S"),
    }
    (art_dir / "meta.json").write_text(json.dumps(full_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    db.save_article(
        url=req.url, title=title, author=author, account=account_name,
        publish_time=publish_time, markdown_path=str(md_file),
        html_path=str(html_file) if html_file else None,
        account_id=account_id, cover_url=cover_url,
        digest=digest, is_original=is_original,
        # Preserve all other fields
        hashid=detail.get("hashid"),
        idx=detail.get("idx"),
        source_url=detail.get("source_url"),
        ip_wording=detail.get("ip_wording"),
        item_show_type=detail.get("item_show_type"),
        real_item_show_type=detail.get("real_item_show_type"),
        video_page_infos=json.dumps(detail.get("video_page_infos", [])),
        picture_page_info_list=json.dumps(detail.get("picture_page_info_list", [])),
        copyright_stat=detail.get("copyright_stat"),
        publish_timestamp=detail.get("post_time"),
        user_name=detail.get("user_name"),
        alias=detail.get("alias"),
        signature=detail.get("signature"),
        create_time=detail.get("create_time"),
    )
    return {"status": "ok", "new": True}


def _extract_short_id(url: str) -> str:
    """Extract the short ID from a WeChat article URL like /s/{id}."""
    import re
    m = re.search(r"/s/([A-Za-z0-9_\-]+)", url)
    if m:
        return m.group(1)
    # fallback: timestamp-based
    return datetime.now().strftime("%Y%m%d_%H%M%S")


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _scheduled_sync_loop():
    """Every 12 hours, pull today's article metadata for all subscribed accounts."""
    while True:
        await asyncio.sleep(12 * 60 * 60)
        today = date.today().isoformat()
        accounts = db.get_all_accounts_unfiltered()
        for acc in accounts:
            if acc.get("subscription_type") == "subscribed":
                try:
                    await _sync_account_articles(acc["id"], acc["biz"], acc["name"],
                                                 since_date=today)
                except Exception as e:
                    logging.warning(f"Scheduled sync failed for {acc['name']}: {e}")


_MIGRATION_FLAG = _data_dir / ".html_color_stripped_v1"

async def _migrate_strip_cached_html():
    """One-time migration: strip inline color styles from all cached HTML files."""
    if _MIGRATION_FLAG.exists():
        return
    articles = db.get_all_articles_unfiltered()
    count = 0
    for art in articles:
        html_path = art.get("html_path")
        if not html_path:
            continue
        p = Path(html_path)
        if not p.exists():
            continue
        try:
            original = p.read_text(encoding="utf-8")
            cleaned = _adapt_color_styles(original)
            if cleaned != original:
                p.write_text(cleaned, encoding="utf-8")
                count += 1
        except Exception as e:
            logging.warning(f"Color-strip migration failed for {html_path}: {e}")
    _MIGRATION_FLAG.touch()
    logging.info(f"Color-strip migration complete: updated {count} cached HTML files")


@app.on_event("startup")
async def startup():
    asyncio.create_task(_scheduled_sync_loop())
    asyncio.create_task(_queue_monitor_loop())
    asyncio.create_task(_try_process_queue())
    asyncio.create_task(_migrate_strip_cached_html())


# ==================================================================
# Analysis management routes (new)
# ==================================================================

class AnalyzeRequest(BaseModel):
    agent_commit_hash: Optional[str] = None   # None = HEAD
    backend: str = "claude"


class ServingRunRequest(BaseModel):
    run_id: Optional[int] = None   # None = clear serving run


@app.patch("/articles/{article_id}/serving-run")
async def set_serving_run(article_id: int, req: ServingRunRequest):
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    db.set_serving_run(article_id, req.run_id)
    return {"status": "ok"}


@app.get("/articles/{article_id}/raw")
async def get_article_raw(article_id: int):
    """Returns the raw content (HTML preferred, fallback to MD), lazy-fetching from API if not cached."""
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    
    # Try HTML first for rich text
    html_path = article.get("html_path")
    if html_path and Path(html_path).exists():
        return {
            "content": Path(html_path).read_text(encoding="utf-8"),
            "format": "html"
        }
        
    # Fallback to Markdown
    md_path = article.get("markdown_path")
    if md_path and Path(md_path).exists():
        return {
            "content": Path(md_path).read_text(encoding="utf-8"),
            "format": "markdown"
        }

    try:
        content, html_content = await _fetch_and_cache_content(article)
        return {
            "content": html_content or content,
            "format": "html" if html_content else "markdown"
        }
    except Exception as e:
        raise HTTPException(500, f"拉取文章内容失败: {e}")


def _parse_rgb(value: str):
    """Parse a CSS color string to (r, g, b) as 0-255 ints, or None if unparseable."""
    value = value.strip().lower()
    m = _re.match(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', value)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    m = _re.match(r'#([0-9a-f]{3,8})', value)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = h[0]*2 + h[1]*2 + h[2]*2
        if len(h) >= 6:
            return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    named = {"white": (255, 255, 255), "black": (0, 0, 0), "#fff": (255, 255, 255)}
    return named.get(value)


def _luminance(r: int, g: int, b: int) -> float:
    """Relative luminance per WCAG 2.1 (0 = black, 1 = white)."""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def _adapt_color_styles(html: str) -> str:
    """Smart dark-mode adaptation for WeChat HTML inline styles.

    - color: drop only near-black text (lum < 0.12) — keeps blues, reds, whites
    - background-color / background: drop only near-white fills (lum > 0.85)
    - background with url() is always kept (background-image)
    - all other CSS properties are untouched
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(style=True):
        declarations = tag["style"].split(";")
        kept = []
        for decl in declarations:
            decl = decl.strip()
            if not decl or ":" not in decl:
                if decl:
                    kept.append(decl)
                continue
            prop, _, val = decl.partition(":")
            prop = prop.strip().lower()
            val = val.strip()

            if prop == "color":
                rgb = _parse_rgb(val)
                if rgb and _luminance(*rgb) < 0.12:
                    pass  # near-black text designed for light bg → drop
                else:
                    kept.append(decl)  # intentional color (blue, red, white…) → keep

            elif prop in ("background-color", "background"):
                if "url(" in val:
                    kept.append(decl)  # background-image → always keep
                else:
                    rgb = _parse_rgb(val)
                    if rgb and _luminance(*rgb) > 0.85:
                        pass  # near-white fill → drop
                    else:
                        kept.append(decl)  # dark/colored background → keep

            else:
                kept.append(decl)

        if kept:
            tag["style"] = "; ".join(kept)
        else:
            del tag["style"]
    return str(soup)


async def _fetch_and_cache_content(article: dict):
    """Lazy-fetch article content from API and cache to disk. Returns (markdown, html)."""
    url = article.get("url", "")
    # Use mode="2" to get both plain text and rich text potentially
    detail = await get_article_detail(url, mode="2")
    
    title = article.get("title", "") or detail.get("title", "")
    author = detail.get("author", "") or article.get("author", "")
    account_name = article.get("account", "") or detail.get("nick_name", "")
    content = detail.get("content", "")
    # Dajiala also provides article_html via another endpoint if needed, 
    # but article_detail mode="2" often has what we need in content_multi_text
    html_content = detail.get("content_multi_text", "")

    short_id = _extract_short_id(url)
    art_dir = SAVE_DIR / short_id
    art_dir.mkdir(parents=True, exist_ok=True)
    
    header = (f"# {title}\n\n**公众号**: {account_name}\n"
              f"**作者**: {author or account_name}\n"
              f"**原文**: {url}\n\n---\n\n")
    
    md_file = art_dir / "article.md"
    md_file.write_text(header + content, encoding="utf-8")
    
    html_file = art_dir / "article.html"
    if html_content:
        # Replace WeChat lazy-load data-src with src so images actually load
        html_content = html_content.replace('data-src="', 'src="')
        html_content = html_content.replace("data-src='", "src='")
        # Add referrerpolicy="no-referrer" to all img tags
        html_content = _re.sub(
            r'<img\b',
            '<img referrerpolicy="no-referrer"',
            html_content,
            flags=_re.IGNORECASE,
        )
        # Strip inline color styles so dark theme renders correctly
        html_content = _adapt_color_styles(html_content)
        if not html_content.strip().startswith("<html"):
            wrapped_html = f"<div class='rich-text-content'>{html_content}</div>"
        else:
            wrapped_html = html_content
        html_file.write_text(wrapped_html, encoding="utf-8")
        db.update_html_path(article["id"], str(html_file))
    
    db.update_markdown_path(article["id"], str(md_file))

    # Also update DB metadata and meta.json with the full detailed response
    db.save_article(
        url=url, title=title, author=author, account=account_name,
        publish_time=article.get("publish_time") or detail.get("pubtime"),
        markdown_path=str(md_file),
        html_path=str(html_file) if html_content else article.get("html_path"),
        account_id=article.get("account_id"),
        digest=detail.get("desc") or article.get("digest"),
        cover_url=detail.get("mp_head_img") or article.get("cover_url"),
        is_original=detail.get("copyright_stat", 0) == 1,
        # Preserve all other fields
        hashid=detail.get("hashid"),
        idx=detail.get("idx"),
        source_url=detail.get("source_url"),
        ip_wording=detail.get("ip_wording"),
        item_show_type=detail.get("item_show_type"),
        real_item_show_type=detail.get("real_item_show_type"),
        video_page_infos=json.dumps(detail.get("video_page_infos", [])),
        picture_page_info_list=json.dumps(detail.get("picture_page_info_list", [])),
        copyright_stat=detail.get("copyright_stat"),
        publish_timestamp=detail.get("post_time"),
        user_name=detail.get("user_name"),
        alias=detail.get("alias"),
        signature=detail.get("signature"),
        create_time=detail.get("create_time"),
    )
    
    # Exclude large content fields from JSON as they are saved separately
    meta_to_save = {k: v for k, v in detail.items() if k not in ("content", "content_multi_text", "html")}
    full_meta = {
        **meta_to_save,
        "short_id": short_id,
        "markdown_file": str(md_file),
        "html_file": str(html_file) if html_content else None,
        "received_at": datetime.now().strftime("%Y%m%d_%H%M%S"),
    }
    (art_dir / "meta.json").write_text(json.dumps(full_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return header + content, html_content


@app.get("/articles/{article_id}/content")
async def get_article_content(article_id: int):
    """Returns content to display. Lazy-fetches from API if not cached."""
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")

    serving_run_id = article.get("serving_run_id")

    if serving_run_id:
        try:
            r = _require_runner()
            content = r.read_workspace_file(serving_run_id, "final_output.md")
            if content:
                return {"serving_run_id": serving_run_id, "source": "analysis",
                        "content": content}
        except HTTPException:
            pass

    md_path = article.get("markdown_path")
    if md_path and Path(md_path).exists():
        return {"serving_run_id": None, "source": "raw",
                "content": Path(md_path).read_text(encoding="utf-8")}

    # No cache — fetch from API
    try:
        content = await _fetch_and_cache_content(article)
    except Exception as e:
        raise HTTPException(500, f"拉取文章内容失败: {e}")
    return {"serving_run_id": None, "source": "raw", "content": content}


async def _start_analysis_run(article_id: int, backend: str = "claude") -> int:
    """Create a DB run record, set workspace, launch pipeline. Returns run_id."""
    r = _require_runner()
    article = db.get_article_by_id(article_id)
    info = r.get_current_commit()
    commit_hash = info.get("hash", "HEAD")
    commit_msg = info.get("message", "")
    short_id = _extract_short_id(article.get("url", ""))
    run_id = db.create_run(
        article_id=article_id,
        agent_commit_hash=commit_hash,
        agent_commit_message=commit_msg,
        backend=backend,
        workspace_path="",
    )
    workspace_name = f"{short_id}-{run_id}" if short_id else str(run_id)
    workspace = r.analyses_dir / workspace_name
    db.conn.execute("UPDATE analysis_runs SET workspace_path = ? WHERE id = ?",
                    (str(workspace), run_id))
    db.conn.commit()
    r.trigger_pipeline(run_id)
    return run_id


async def _try_process_queue():
    """Start pending queue items if auto_launch and concurrency allow."""
    if runner is None:
        return
    if db.get_setting("auto_launch", "true") != "true":
        return
    max_concurrency = int(db.get_setting("max_concurrency", "2"))
    all_entries = db.get_queue_all()
    running_count = sum(1 for e in all_entries if e["status"] == "running")
    slots = max_concurrency - running_count
    if slots <= 0:
        return
    pending = db.get_pending_queue(limit=slots)
    for entry in pending:
        article = db.get_article_by_id(entry["article_id"])
        if not article:
            continue
        # Ensure content is cached before analysis
        md_path = article.get("markdown_path")
        if not md_path or not Path(md_path).exists():
            try:
                await _fetch_and_cache_content(article)
                article = db.get_article_by_id(entry["article_id"])
            except Exception as e:
                logging.warning(f"Failed to cache content for article {entry['article_id']}: {e}")
                db.update_queue_entry(entry["article_id"], "failed")
                continue
        try:
            run_id = await _start_analysis_run(entry["article_id"])
            db.update_queue_entry(entry["article_id"], "running", run_id=run_id)
        except Exception as e:
            logging.warning(f"Failed to start analysis run for article {entry['article_id']}: {e}")
            db.update_queue_entry(entry["article_id"], "failed")


async def _queue_monitor_loop():
    """Check running queue entries for completion every 10s, then try to process more."""
    while True:
        await asyncio.sleep(10)
        all_entries = db.get_queue_all()
        for entry in all_entries:
            if entry["status"] != "running" or not entry.get("run_id"):
                continue
            run = db.get_run(entry["run_id"])
            if not run:
                continue
            if run["overall_status"] == "done":
                db.set_serving_run(entry["article_id"], entry["run_id"])
                db.update_queue_entry(entry["article_id"], "done")
                await _try_process_queue()
            elif run["overall_status"] == "failed":
                db.update_queue_entry(entry["article_id"], "failed")
                await _try_process_queue()


@app.post("/articles/{article_id}/request-analysis")
async def request_analysis(article_id: int):
    """Enqueue article for AI analysis (or increment request count). Returns current status."""
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")

    entry = db.get_queue_entry(article_id)
    # Already done or running — just return current status
    if entry and entry["status"] in ("done", "running"):
        return {"analysis_status": entry["status"], "run_id": entry.get("run_id")}

    entry = db.enqueue_analysis(article_id)
    asyncio.create_task(_try_process_queue())
    return {"analysis_status": entry["status"], "run_id": entry.get("run_id")}


@app.get("/articles/{article_id}/analysis-status")
async def get_analysis_status(article_id: int):
    entry = db.get_queue_entry(article_id)
    if not entry:
        return {"analysis_status": "none"}
    return {"analysis_status": entry["status"], "run_id": entry.get("run_id")}


@app.get("/queue")
async def get_queue():
    return {"status": "ok", "data": db.get_queue_all()}


class StrategyUpdate(BaseModel):
    auto_launch: Optional[bool] = None
    max_concurrency: Optional[int] = None


@app.get("/strategy")
async def get_strategy():
    return {
        "status": "ok",
        "data": {
            "auto_launch": db.get_setting("auto_launch", "true") == "true",
            "max_concurrency": int(db.get_setting("max_concurrency", "2")),
        }
    }


@app.patch("/strategy")
async def update_strategy(req: StrategyUpdate):
    if req.auto_launch is not None:
        db.set_setting("auto_launch", "true" if req.auto_launch else "false")
        if req.auto_launch:
            asyncio.create_task(_try_process_queue())
    if req.max_concurrency is not None:
        db.set_setting("max_concurrency", str(max(1, req.max_concurrency)))
        asyncio.create_task(_try_process_queue())
    return {
        "status": "ok",
        "data": {
            "auto_launch": db.get_setting("auto_launch", "true") == "true",
            "max_concurrency": int(db.get_setting("max_concurrency", "2")),
        }
    }


@app.post("/articles/{article_id}/analyze")
async def trigger_analysis(article_id: int, req: AnalyzeRequest):
    r = _require_runner()
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")

    # Resolve commit hash
    commit_hash = req.agent_commit_hash
    commit_msg = ""
    if not commit_hash:
        info = r.get_current_commit()
        commit_hash = info.get("hash", "HEAD")
        commit_msg = info.get("message", "")
    else:
        # Find commit message from version list
        for v in r.get_agent_versions(100):
            if v["hash"].startswith(commit_hash) or v["short_hash"] == commit_hash:
                commit_hash = v["hash"]
                commit_msg = v["message"]
                break

    # Derive short_id for workspace naming
    short_id = _extract_short_id(article.get("url", "") if article else "")

    run_id = db.create_run(
        article_id=article_id,
        agent_commit_hash=commit_hash,
        agent_commit_message=commit_msg,
        backend=req.backend,
        workspace_path="",   # set after we have the id
    )
    workspace_name = f"{short_id}-{run_id}" if short_id else str(run_id)
    workspace = r.analyses_dir / workspace_name
    db.update_stage(run_id, "deconstruct", "pending")
    db.conn.execute("UPDATE analysis_runs SET workspace_path = ? WHERE id = ?",
                    (str(workspace), run_id))
    db.conn.commit()

    r.trigger_pipeline(run_id)
    return {"status": "ok", "run_id": run_id}


@app.post("/runs/{run_id}/stage/{stage}")
async def retrigger_stage(run_id: int, stage: str):
    r = _require_runner()
    valid = {"deconstruct", "evaluate", "synthesize", "write"}
    if stage not in valid:
        raise HTTPException(400, f"stage must be one of: {sorted(valid)}")
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    r.trigger_stage(run_id, stage)
    return {"status": "ok", "run_id": run_id, "stage": stage}


@app.get("/articles/{article_id}/runs")
async def get_article_runs(article_id: int):
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(404, "Article not found")
    runs = db.get_runs_for_article(article_id)
    return {"status": "ok", "data": runs}


@app.get("/runs/{run_id}")
async def get_run(run_id: int):
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return {"status": "ok", "data": run}


@app.get("/runs/{run_id}/files")
async def list_run_files(run_id: int):
    r = _require_runner()
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return {"status": "ok", "data": r.list_workspace_files(run_id)}


@app.get("/runs/{run_id}/files/{filepath:path}")
async def get_run_file(run_id: int, filepath: str):
    r = _require_runner()
    content = r.read_workspace_file(run_id, filepath)
    if content is None:
        raise HTTPException(404, f"File '{filepath}' not found in run {run_id}")
    return {"status": "ok", "filepath": filepath, "content": content}


@app.websocket("/runs/{run_id}/progress")
async def run_progress_ws(websocket: WebSocket, run_id: int, token: Optional[str] = None):
    # Validate token before accepting
    if token:
        try:
            claims = await verify_authing_token(token)
            sub = claims.get("sub")
            user = db.get_user_by_sub(sub) if sub else None
            if not user or not user["is_active"]:
                await websocket.close(code=4001)
                return
        except Exception:
            await websocket.close(code=4001)
            return
    r = _require_runner()
    await websocket.accept()
    # Send current state immediately
    run = db.get_run(run_id)
    if run:
        await websocket.send_json({"type": "snapshot", "run_id": run_id, "data": run})
    try:
        async for event in r.subscribe_progress(run_id):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass


# ==================================================================
# Agent version routes
# ==================================================================

@app.get("/agent/versions")
async def get_agent_versions(n: int = 20):
    r = _require_runner()
    return {"status": "ok", "data": r.get_agent_versions(n)}


@app.get("/agent/versions/current")
async def get_current_version():
    r = _require_runner()
    return {"status": "ok", "data": r.get_current_commit()}


if __name__ == "__main__":
    print(f"Backend started.")
    print(f"  Data dir:   {_data_dir}")
    print(f"  Agent repo: {_agent_repo}")
    uvicorn.run(app, host="0.0.0.0", port=8889)
