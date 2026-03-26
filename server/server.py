#!/usr/bin/env python3
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from cleaner import cleaner
from database import db
from agent_runner import AgentRunner

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Curation App Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# ==================================================================
# Existing article ingestion routes (unchanged)
# ==================================================================

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


@app.get("/accounts")
async def get_accounts():
    return {"status": "ok", "data": db.get_accounts()}


@app.get("/articles")
async def get_articles(account_id: Optional[int] = None):
    if account_id:
        articles = db.get_articles_by_account(account_id)
    else:
        articles = db.get_all_articles()
    return {"status": "ok", "data": articles}


@app.delete("/articles/{article_id}")
async def delete_article(article_id: int):
    db.delete_article(article_id)
    return {"status": "ok", "message": "Article deleted"}


@app.post("/articles/{article_id}/read")
async def update_read_status(article_id: int, status: int = 1):
    db.update_read_status(article_id, status)
    return {"status": "ok"}


@app.post("/sync")
async def sync_articles():
    """Scan received_articles directory and sync with database."""
    count = 0
    for json_file in SAVE_DIR.glob("*.json"):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            if not db.get_article(data["url"]):
                account_id = None
                if data.get("biz"):
                    account_id = db.save_account(
                        biz=data["biz"],
                        name=data["account"],
                        avatar_url=data.get("avatar")
                    )
                md_path = json_file.with_suffix(".md")
                html_path = json_file.with_suffix(".html")
                db.save_article(
                    url=data["url"],
                    title=data["title"],
                    author=data["author"],
                    account=data["account"],
                    publish_time=data["date"],
                    html_path=str(html_path) if html_path.exists() else None,
                    markdown_path=str(md_path) if md_path.exists() else None,
                    account_id=account_id,
                    digest=data.get("digest"),
                    cover_url=data.get("cover_url"),
                    is_original=data.get("is_original", False)
                )
                count += 1
        except Exception as e:
            print(f"Error syncing {json_file.name}: {e}")
    return {"status": "ok", "message": f"Synced {count} new articles"}


@app.get("/check")
async def check_article(url: str):
    record = db.get_article(url)
    if record:
        markdown_content = ""
        md_path_str = record.get("markdown_path") or record.get("markdown_file")
        if md_path_str:
            md_path = Path(md_path_str)
            if md_path.exists():
                markdown_content = md_path.read_text(encoding="utf-8")
        html_filename = ""
        html_path_str = record.get("html_path") or record.get("html_file")
        if html_path_str:
            html_filename = Path(html_path_str).name
        return {
            "status": "cached",
            "message": f"Article found in cache: {record['title']}",
            "data": {**dict(record), "markdown": markdown_content,
                     "html_filename": html_filename}
        }
    return {"status": "not_found"}


@app.post("/process")
async def process_article(article: ArticlePayload):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean_title = "".join(x for x in article.title
                          if x.isalnum() or x in " -_").strip()[:50]
    filename_base = f"{ts}_{clean_title}"

    print(f"\n[{ts}] Processing: {article.title}")

    clean_html = article.html
    if "<head>" in clean_html:
        clean_html = clean_html.replace(
            "<head>", '<head><meta name="referrer" content="no-referrer">', 1)
    else:
        clean_html = (f'<html><head><meta name="referrer" content="no-referrer">'
                      f'</head><body>{clean_html}</body></html>')

    clean_html = clean_html.replace('data-src="', 'src="')

    style_injection = """
    <style>
        body {
            background: #f8fafc;
            display: flex;
            justify-content: center;
            padding: 40px 20px;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .article-container {
            background: white;
            max-width: 720px;
            width: 100%;
            padding: 40px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1);
            border-radius: 12px;
            line-height: 1.8;
            color: #1e293b;
        }
        img { max-width: 100% !important; height: auto !important; border-radius: 8px; margin: 16px 0; }
        iframe { max-width: 100% !important; }
    </style>
    """
    if "</head>" in clean_html:
        clean_html = clean_html.replace("</head>", f"{style_injection}</head>", 1)
    elif "<body>" in clean_html:
        clean_html = clean_html.replace("<body>", f"<body>{style_injection}", 1)
    else:
        clean_html = f"{style_injection}{clean_html}"

    if "<body>" in clean_html:
        clean_html = clean_html.replace(
            "<body>", '<body><div class="article-container">', 1)
        clean_html = clean_html.replace("</body>", '</div></body>', 1)
    else:
        clean_html = f'<div class="article-container">{clean_html}</div>'

    html_file = SAVE_DIR / f"{filename_base}.html"
    html_file.write_text(clean_html, encoding="utf-8")

    msg = ""
    markdown_content = ""
    md_file = None

    try:
        markdown_body = cleaner.clean(article.html)
        header = f"# {article.title}\n\n"
        if article.account:
            header += f"**公众号**: {article.account}\n"
        if article.author:
            header += f"**作者**: {article.author}\n"
        if article.date:
            header += f"**日期**: {article.date}\n"
        header += f"**原文**: {article.url}\n\n---\n\n"
        markdown_content = header + markdown_body

        md_file = SAVE_DIR / f"{filename_base}.md"
        md_file.write_text(markdown_content, encoding="utf-8")
        msg = f"Successfully processed and cleaned: {article.title}"
        print(f"  ✅ Saved Markdown: {md_file.name}")

        account_id = None
        if article.biz:
            account_id = db.save_account(
                biz=article.biz, name=article.account,
                avatar_url=article.avatar)

        db.save_article(
            url=article.url, title=article.title, author=article.author,
            account=article.account, publish_time=article.date,
            html_path=str(html_file),
            markdown_path=str(md_file),
            account_id=account_id, digest=article.digest,
            cover_url=article.cover_url, is_original=article.is_original)
    except Exception as e:
        markdown_content = f"Error during cleaning: {e}"
        md_file = None
        msg = f"Processed article but cleaning failed: {e}"
        print(f"  ⚠️ Cleaning failed: {e}")

    meta_file = SAVE_DIR / f"{filename_base}.json"
    meta = {
        "title": article.title, "author": article.author,
        "account": article.account, "date": article.date,
        "url": article.url,
        "html_file": str(html_file),
        "markdown_file": str(md_file) if md_file else None,
        "html_length": len(article.html),
        "markdown_length": len(markdown_content),
        "received_at": ts,
    }
    meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2),
                         encoding="utf-8")

    return {
        "status": "ok", "message": msg, "url": article.url,
        "html_filename": html_file.name,
        "markdown_preview": markdown_content[:500] + "...",
        "files": {
            "html": str(html_file),
            "markdown": str(md_file) if md_file else None,
            "meta": str(meta_file),
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


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


@app.get("/articles/{article_id}/content")
async def get_article_content(article_id: int):
    """
    Returns the content to display for an article.
    If a serving_run_id is set, returns that run's final_output.md.
    Otherwise falls back to the raw markdown file.
    Also returns serving_run_id as a version token for change detection.
    """
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
            pass  # runner not configured, fall through to raw

    md_path = article.get("markdown_path")
    if md_path and Path(md_path).exists():
        content = Path(md_path).read_text(encoding="utf-8")
        return {"serving_run_id": None, "source": "raw", "content": content}

    return {"serving_run_id": None, "source": "empty", "content": ""}


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

    # Create workspace path
    workspace = r.analyses_dir / str(0)  # temp, updated after insert
    run_id = db.create_run(
        article_id=article_id,
        agent_commit_hash=commit_hash,
        agent_commit_message=commit_msg,
        backend=req.backend,
        workspace_path="",   # set after we have the id
    )
    workspace = r.analyses_dir / str(run_id)
    db.update_stage(run_id, "deconstruct", "pending")  # triggers updated_at + sets workspace
    # Update workspace_path
    import sqlite3 as _sqlite3
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
async def run_progress_ws(websocket: WebSocket, run_id: int):
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
