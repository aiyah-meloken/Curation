"""
AgentRunner: manages git worktrees of curation-agent and executes pipeline stages.

Each analysis run maps to a row in analysis_runs. Stages are executed as subprocesses
inside the appropriate git worktree of curation-agent, so different agent versions run
in full isolation.

Progress events are pushed to asyncio Queues (one per run_id) so WebSocket endpoints
can stream live updates to the frontend.
"""

import asyncio
import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

STAGES = ["deconstruct", "evaluate", "synthesize", "write"]

# Worktrees are placed here; name = first 8 chars of commit hash
WORKTREE_BASE = Path(os.environ.get("CURATION_WORKTREE_DIR", "/tmp/curation-agent-worktrees"))


class AgentRunner:
    """
    Singleton-friendly runner. Instantiate once in server.py and share.

    Args:
        agent_repo: Path to the curation-agent git repo
        data_dir:   Path to curation-data (where analyses/ lives)
        db:         ArticleDB instance
    """

    def __init__(self, agent_repo: Path, data_dir: Path, db):
        self.agent_repo = Path(agent_repo)
        self.data_dir = Path(data_dir)
        self.analyses_dir = self.data_dir / "analyses"
        self.analyses_dir.mkdir(parents=True, exist_ok=True)
        WORKTREE_BASE.mkdir(parents=True, exist_ok=True)
        self.db = db
        # run_id → asyncio.Queue for progress events
        self._queues: dict[int, list[asyncio.Queue]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Worktree management
    # ------------------------------------------------------------------

    def get_worktree(self, commit_hash: str) -> Path:
        """Return path to a worktree checked out at commit_hash, creating if needed."""
        wt_path = WORKTREE_BASE / f"agent-{commit_hash[:8]}"
        if wt_path.exists():
            return wt_path
        logger.info(f"Creating worktree for {commit_hash[:8]} at {wt_path}")
        result = subprocess.run(
            ["git", "worktree", "add", str(wt_path), commit_hash],
            cwd=str(self.agent_repo),
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"git worktree add failed for {commit_hash}: {result.stderr}"
            )
        return wt_path

    def get_agent_versions(self, n: int = 20) -> list[dict]:
        """Return last n commits from the agent repo."""
        result = subprocess.run(
            ["git", "log", f"-{n}", "--pretty=format:%H\t%h\t%s\t%ai"],
            cwd=str(self.agent_repo),
            capture_output=True, text=True
        )
        versions = []
        for line in result.stdout.strip().splitlines():
            parts = line.split("\t", 3)
            if len(parts) == 4:
                versions.append({
                    "hash":       parts[0],
                    "short_hash": parts[1],
                    "message":    parts[2],
                    "date":       parts[3],
                })
        return versions

    def get_current_commit(self) -> dict:
        """Return HEAD commit info."""
        result = subprocess.run(
            ["git", "log", "-1", "--pretty=format:%H\t%h\t%s\t%ai"],
            cwd=str(self.agent_repo),
            capture_output=True, text=True
        )
        parts = result.stdout.strip().split("\t", 3)
        if len(parts) == 4:
            return {"hash": parts[0], "short_hash": parts[1],
                    "message": parts[2], "date": parts[3]}
        return {}

    # ------------------------------------------------------------------
    # Progress event broadcasting
    # ------------------------------------------------------------------

    def _subscribe(self, run_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._queues.setdefault(run_id, []).append(q)
        return q

    def _unsubscribe(self, run_id: int, q: asyncio.Queue):
        with self._lock:
            qs = self._queues.get(run_id, [])
            if q in qs:
                qs.remove(q)

    def _emit(self, run_id: int, event: dict):
        """Push event to all subscribers for this run. Thread-safe."""
        with self._lock:
            queues = list(self._queues.get(run_id, []))
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def subscribe_progress(self, run_id: int):
        """
        Async generator yielding progress dicts for a run.
        Yields until a terminal event (done/failed) is received.
        """
        q = self._subscribe(run_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    yield {"type": "heartbeat", "run_id": run_id}
                    continue
                yield event
                if event.get("type") in ("done", "failed"):
                    break
        finally:
            self._unsubscribe(run_id, q)

    # ------------------------------------------------------------------
    # Stage execution
    # ------------------------------------------------------------------

    def _run_stage_subprocess(self, run_id: int, stage: str,
                               worktree: Path, workspace: Path,
                               backend: str) -> tuple[bool, float]:
        """
        Run a single agent stage as a subprocess inside the worktree.
        Returns (success, elapsed_seconds).
        """
        self.db.update_stage(run_id, stage, "running")
        self._emit(run_id, {"type": "stage_start", "run_id": run_id,
                             "stage": stage})

        # Use uv run python if uv.lock present, else plain python
        python_cmd = "uv" if (worktree / "uv.lock").exists() else sys.executable
        cmd = (
            [python_cmd, "run", "python", "agent.py", "stage",
             "--stage", stage, "--workspace", str(workspace),
             "--backend", backend]
            if python_cmd == "uv"
            else [python_cmd, "agent.py", "stage",
                  "--stage", stage, "--workspace", str(workspace),
                  "--backend", backend]
        )

        env = os.environ.copy()
        env["CURATION_DATA_DIR"] = str(self.data_dir)

        t0 = time.time()
        result = subprocess.run(
            cmd, cwd=str(worktree),
            capture_output=False,   # let output stream to server logs
            env=env,
        )
        elapsed = time.time() - t0
        success = result.returncode == 0

        status = "done" if success else "failed"
        self.db.update_stage(run_id, stage, status, elapsed_s=elapsed)
        self._emit(run_id, {
            "type": "stage_end",
            "run_id": run_id,
            "stage": stage,
            "status": status,
            "elapsed_s": round(elapsed, 1),
        })
        return success, elapsed

    # ------------------------------------------------------------------
    # Public: run single stage (for re-trigger from admin UI)
    # ------------------------------------------------------------------

    def trigger_stage(self, run_id: int, stage: str):
        """
        Re-run a single stage for an existing run.
        Executes in a background thread (non-blocking).
        """
        def _run():
            run = self.db.get_run(run_id)
            if not run:
                logger.error(f"Run {run_id} not found")
                return
            worktree = self.get_worktree(run["agent_commit_hash"])
            workspace = Path(run["workspace_path"])
            self._run_stage_subprocess(
                run_id, stage, worktree, workspace, run["backend"]
            )

        t = threading.Thread(target=_run, daemon=True)
        t.start()

    # ------------------------------------------------------------------
    # Public: run full pipeline
    # ------------------------------------------------------------------

    def trigger_pipeline(self, run_id: int):
        """
        Run all 4 stages sequentially for a new run.
        Executes in a background thread (non-blocking).
        """
        def _run():
            run = self.db.get_run(run_id)
            if not run:
                logger.error(f"Run {run_id} not found")
                return

            try:
                worktree = self.get_worktree(run["agent_commit_hash"])
            except RuntimeError as e:
                logger.error(str(e))
                self.db.set_overall_status(run_id, "failed", str(e))
                self._emit(run_id, {"type": "failed", "run_id": run_id,
                                    "error": str(e)})
                return

            workspace = Path(run["workspace_path"])
            workspace.mkdir(parents=True, exist_ok=True)

            # Copy source.md from article's markdown_path
            article = self.db.get_article_by_id(run["article_id"])
            if article and article.get("markdown_path"):
                import shutil
                src = article["markdown_path"]
                if os.path.exists(src):
                    shutil.copy(src, workspace / "source.md")

            self.db.set_overall_status(run_id, "running")

            for stage in STAGES:
                success, _ = self._run_stage_subprocess(
                    run_id, stage, worktree, workspace, run["backend"]
                )
                if not success:
                    self.db.set_overall_status(run_id, "failed",
                                               f"{stage} stage failed")
                    self._emit(run_id, {"type": "failed", "run_id": run_id,
                                        "stage": stage})
                    return

            self.db.set_overall_status(run_id, "done")
            self._emit(run_id, {"type": "done", "run_id": run_id})

        t = threading.Thread(target=_run, daemon=True)
        t.start()

    # ------------------------------------------------------------------
    # Workspace file access (for admin UI FileViewer)
    # ------------------------------------------------------------------

    def list_workspace_files(self, run_id: int) -> list[str]:
        """Return a list of viewable file paths relative to the workspace."""
        run = self.db.get_run(run_id)
        if not run or not run.get("workspace_path"):
            return []
        workspace = Path(run["workspace_path"])
        files = []
        for name in ["tone_field.md", "delivery_plan.md", "final_output.md"]:
            if (workspace / name).exists():
                files.append(name)
        for sub in ["iogs", "evaluations"]:
            sub_dir = workspace / sub
            if sub_dir.is_dir():
                for f in sorted(sub_dir.iterdir()):
                    if f.suffix == ".md":
                        files.append(f"{sub}/{f.name}")
        return files

    def read_workspace_file(self, run_id: int, filepath: str) -> Optional[str]:
        """Read a file from a run's workspace. filepath is relative to workspace root."""
        run = self.db.get_run(run_id)
        if not run or not run.get("workspace_path"):
            return None
        # Prevent path traversal
        workspace = Path(run["workspace_path"]).resolve()
        target = (workspace / filepath).resolve()
        if not str(target).startswith(str(workspace)):
            return None
        if target.exists() and target.is_file():
            return target.read_text(encoding="utf-8")
        return None
