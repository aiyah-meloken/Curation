import os
import sqlite3
from pathlib import Path
from typing import Optional, Dict, List

# DB is in CURATION_DATA_DIR (env var) or falls back to server/ for dev
_data_dir = os.environ.get("CURATION_DATA_DIR", str(Path(__file__).parent))
DB_PATH = Path(_data_dir) / "articles.db"


class ArticleDB:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or DB_PATH
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self._migrate()

    # ------------------------------------------------------------------
    # Schema / migrations
    # ------------------------------------------------------------------

    def _migrate(self):
        c = self.conn.cursor()

        c.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                biz TEXT UNIQUE NOT NULL,
                name TEXT,
                wxid TEXT,
                avatar_url TEXT,
                description TEXT,
                account_type TEXT,
                last_monitored_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                url TEXT UNIQUE NOT NULL,
                title TEXT,
                author TEXT,
                account TEXT,
                publish_time TIMESTAMP,
                digest TEXT,
                cover_url TEXT,
                is_original BOOLEAN,
                html_path TEXT,
                markdown_path TEXT,
                read_status INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id)
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS analysis_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL REFERENCES articles(id),

                agent_commit_hash TEXT NOT NULL,
                agent_commit_message TEXT,
                backend TEXT NOT NULL,

                workspace_path TEXT,

                deconstruct_status  TEXT DEFAULT 'pending',
                deconstruct_elapsed_s REAL,
                evaluate_status     TEXT DEFAULT 'pending',
                evaluate_elapsed_s  REAL,
                synthesize_status   TEXT DEFAULT 'pending',
                synthesize_elapsed_s REAL,
                write_status        TEXT DEFAULT 'pending',
                write_elapsed_s     REAL,

                overall_status TEXT DEFAULT 'pending',
                error_msg TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)

        # Migrate legacy articles columns
        c.execute("PRAGMA table_info(articles)")
        existing = {row["name"] for row in c.fetchall()}
        for col, typ in [
            ("account_id",  "INTEGER"),
            ("publish_time","TIMESTAMP"),
            ("digest",      "TEXT"),
            ("cover_url",   "TEXT"),
            ("is_original", "BOOLEAN"),
            ("read_status", "INTEGER DEFAULT 0"),
        ]:
            if col not in existing:
                c.execute(f"ALTER TABLE articles ADD COLUMN {col} {typ}")

        self.conn.commit()

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------

    def get_accounts(self) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM accounts ORDER BY name ASC")
        return [dict(r) for r in c.fetchall()]

    def save_account(self, biz: str, name: str, wxid: str = None,
                     avatar_url: str = None, description: str = None,
                     account_type: str = None) -> int:
        c = self.conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO accounts (biz, name, wxid, avatar_url, description, account_type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (biz, name, wxid, avatar_url, description, account_type))
        self.conn.commit()
        return c.lastrowid

    # ------------------------------------------------------------------
    # Articles
    # ------------------------------------------------------------------

    def get_all_articles(self) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM articles ORDER BY publish_time DESC")
        return [dict(r) for r in c.fetchall()]

    def get_articles_by_account(self, account_id: int) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM articles WHERE account_id = ? ORDER BY publish_time DESC",
                  (account_id,))
        return [dict(r) for r in c.fetchall()]

    def get_article(self, url: str) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM articles WHERE url = ?", (url,))
        row = c.fetchone()
        return dict(row) if row else None

    def get_article_by_id(self, article_id: int) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
        row = c.fetchone()
        return dict(row) if row else None

    def save_article(self, url: str, title: str, author: str, account: str,
                     publish_time: str, html_path: str, markdown_path: str,
                     account_id: int = None, digest: str = None,
                     cover_url: str = None, is_original: bool = False):
        c = self.conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO articles
              (url, title, author, account, publish_time, html_path, markdown_path,
               account_id, digest, cover_url, is_original)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (url, title, author, account, publish_time, html_path, markdown_path,
              account_id, digest, cover_url, is_original))
        self.conn.commit()

    def delete_article(self, article_id: int):
        c = self.conn.cursor()
        c.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        self.conn.commit()

    def update_read_status(self, article_id: int, status: int):
        c = self.conn.cursor()
        c.execute("UPDATE articles SET read_status = ? WHERE id = ?", (status, article_id))
        self.conn.commit()

    # ------------------------------------------------------------------
    # Analysis runs
    # ------------------------------------------------------------------

    def create_run(self, article_id: int, agent_commit_hash: str,
                   agent_commit_message: str, backend: str,
                   workspace_path: str) -> int:
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO analysis_runs
              (article_id, agent_commit_hash, agent_commit_message, backend, workspace_path)
            VALUES (?, ?, ?, ?, ?)
        """, (article_id, agent_commit_hash, agent_commit_message, backend, workspace_path))
        self.conn.commit()
        return c.lastrowid

    def get_run(self, run_id: int) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM analysis_runs WHERE id = ?", (run_id,))
        row = c.fetchone()
        return dict(row) if row else None

    def get_runs_for_article(self, article_id: int) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("""
            SELECT * FROM analysis_runs
            WHERE article_id = ?
            ORDER BY created_at DESC
        """, (article_id,))
        return [dict(r) for r in c.fetchall()]

    def update_stage(self, run_id: int, stage: str, status: str,
                     elapsed_s: float = None, error_msg: str = None):
        """Update a single stage's status and elapsed time."""
        c = self.conn.cursor()
        if elapsed_s is not None:
            c.execute(f"""
                UPDATE analysis_runs
                SET {stage}_status = ?, {stage}_elapsed_s = ?,
                    overall_status = 'running', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, elapsed_s, run_id))
        else:
            c.execute(f"""
                UPDATE analysis_runs
                SET {stage}_status = ?,
                    overall_status = 'running', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status, run_id))
        if error_msg:
            c.execute("UPDATE analysis_runs SET error_msg = ? WHERE id = ?",
                      (error_msg, run_id))
        self.conn.commit()

    def set_overall_status(self, run_id: int, status: str, error_msg: str = None):
        c = self.conn.cursor()
        c.execute("""
            UPDATE analysis_runs
            SET overall_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status, run_id))
        if error_msg:
            c.execute("UPDATE analysis_runs SET error_msg = ? WHERE id = ?",
                      (error_msg, run_id))
        self.conn.commit()


db = ArticleDB()
