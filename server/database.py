import os
import sqlite3
import logging
from datetime import date
from pathlib import Path
from typing import Optional, Dict, List
from dotenv import load_dotenv

# Load environment variables (critical for finding CURATION_DATA_DIR)
load_dotenv()
logger = logging.getLogger(__name__)

# DB is in CURATION_DATA_DIR (env var) or falls back to server/ for dev
_data_dir = os.environ.get("CURATION_DATA_DIR", str(Path(__file__).parent))
DB_PATH = Path(_data_dir) / "curation.db"


class ArticleDB:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or DB_PATH
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def _init_schema(self):
        c = self.conn.cursor()

        c.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES app_users(id),
                biz TEXT NOT NULL,
                name TEXT,
                wxid TEXT,
                avatar_url TEXT,
                description TEXT,
                account_type TEXT,
                gh_id TEXT,
                signature TEXT,
                publish_count INTEGER,
                masssend_count INTEGER,
                remain_money REAL,
                cost_money REAL,
                total_num INTEGER,
                subscription_type TEXT DEFAULT 'subscribed',
                subscribed_at TEXT,
                deleted_at TIMESTAMP,
                last_monitored_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(biz, user_id)
            )
        """)
        # Migrate old schema: if user_id column is missing, rebuild the table
        existing_cols = {row[1] for row in c.execute("PRAGMA table_info(accounts)")}
        if "user_id" not in existing_cols:
            c.execute("""
                CREATE TABLE accounts_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER REFERENCES app_users(id),
                    biz TEXT NOT NULL,
                    name TEXT,
                    wxid TEXT,
                    avatar_url TEXT,
                    description TEXT,
                    account_type TEXT,
                    subscription_type TEXT DEFAULT 'subscribed',
                    subscribed_at TEXT,
                    deleted_at TIMESTAMP,
                    last_monitored_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(biz, user_id)
                )
            """)
            c.execute("""
                INSERT INTO accounts_new
                    (id, user_id, biz, name, wxid, avatar_url, description,
                     account_type, subscription_type, subscribed_at,
                     deleted_at, last_monitored_at, created_at)
                SELECT id, NULL, biz, name, wxid, avatar_url, description,
                       account_type, subscription_type, subscribed_at,
                       deleted_at, last_monitored_at, created_at
                FROM accounts
            """)
            c.execute("DROP TABLE accounts")
            c.execute("ALTER TABLE accounts_new RENAME TO accounts")

        # Additional column migrations for accounts
        existing_cols = {row[1] for row in c.execute("PRAGMA table_info(accounts)")}
        for col, ddl in [
            ("gh_id",     "ALTER TABLE accounts ADD COLUMN gh_id TEXT"),
            ("signature", "ALTER TABLE accounts ADD COLUMN signature TEXT"),
            ("publish_count", "ALTER TABLE accounts ADD COLUMN publish_count INTEGER"),
            ("masssend_count", "ALTER TABLE accounts ADD COLUMN masssend_count INTEGER"),
            ("remain_money", "ALTER TABLE accounts ADD COLUMN remain_money REAL"),
            ("cost_money", "ALTER TABLE accounts ADD COLUMN cost_money REAL"),
            ("total_num", "ALTER TABLE accounts ADD COLUMN total_num INTEGER"),
        ]:
            if col not in existing_cols:
                c.execute(ddl)

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
                serving_run_id INTEGER,
                read_status INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                -- New fields for full preservation
                hashid TEXT,
                idx TEXT,
                source_url TEXT,
                ip_wording TEXT,
                item_show_type INTEGER,
                real_item_show_type INTEGER,
                msg_status INTEGER,
                msg_fail_reason TEXT,
                send_to_fans_num INTEGER,
                is_deleted INTEGER,
                types INTEGER,
                position INTEGER,
                pre_post_time TIMESTAMP,
                video_page_infos TEXT,
                picture_page_info_list TEXT,
                copyright_stat INTEGER,
                publish_timestamp INTEGER,
                user_name TEXT,
                alias TEXT,
                signature TEXT,
                create_time TEXT,

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

        c.execute("""
            CREATE TABLE IF NOT EXISTS analysis_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER UNIQUE NOT NULL REFERENCES articles(id),
                request_count INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending',
                run_id INTEGER REFERENCES analysis_runs(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        # Default settings
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_launch', 'true')")
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_concurrency', '2')")

        c.execute("""
            CREATE TABLE IF NOT EXISTS app_users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                authing_sub TEXT UNIQUE NOT NULL,
                email       TEXT UNIQUE,
                username    TEXT,
                role        TEXT NOT NULL DEFAULT 'user',
                is_active   BOOLEAN NOT NULL DEFAULT 1,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login  TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS invite_codes (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                code         TEXT UNIQUE NOT NULL,
                created_by   INTEGER REFERENCES app_users(id),
                last_used_by INTEGER REFERENCES app_users(id),
                last_used_at TIMESTAMP,
                expires_at   TIMESTAMP,
                max_uses     INTEGER,
                use_count    INTEGER NOT NULL DEFAULT 0,
                is_active    BOOLEAN NOT NULL DEFAULT 1,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migrate existing table: add new columns if they don't exist
        existing_cols = {row[1] for row in c.execute("PRAGMA table_info(invite_codes)")}
        for col, ddl in [
            ("max_uses",     "ALTER TABLE invite_codes ADD COLUMN max_uses INTEGER"),
            ("use_count",    "ALTER TABLE invite_codes ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0"),
            ("last_used_by", "ALTER TABLE invite_codes ADD COLUMN last_used_by INTEGER REFERENCES app_users(id)"),
            ("last_used_at", "ALTER TABLE invite_codes ADD COLUMN last_used_at TIMESTAMP"),
        ]:
            if col not in existing_cols:
                c.execute(ddl)

        c.execute("""
            CREATE TABLE IF NOT EXISTS app_config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        self._seed_admin_from_env()

        self.conn.commit()

    def _seed_admin_from_env(self):
        """Bootstrap/repair admin user (sub hardcoded, env vars optional for metadata)."""
        admin_sub = (os.environ.get("ADMIN_AUTHING_SUB") or "69c6267c2e8369d9bd4d037d").strip()

        admin_email = (os.environ.get("ADMIN_EMAIL") or "").strip() or None
        admin_username = (os.environ.get("ADMIN_USERNAME") or "").strip() or None
        c = self.conn.cursor()
        c.execute("SELECT id FROM app_users WHERE authing_sub = ?", (admin_sub,))
        row = c.fetchone()

        if row:
            c.execute("""
                UPDATE app_users
                SET role = 'admin',
                    is_active = 1
                WHERE authing_sub = ?
            """, (admin_sub,))
            return

        c.execute("""
            INSERT INTO app_users (authing_sub, email, username, role, is_active)
            VALUES (?, ?, ?, 'admin', 1)
        """, (admin_sub, admin_email, admin_username))

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------

    def get_accounts(self, user_id: int) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY name ASC",
                  (user_id,))
        return [dict(r) for r in c.fetchall()]

    def get_all_accounts_unfiltered(self) -> List[Dict]:
        """For internal use (scheduler, etc.) — returns all accounts regardless of owner."""
        c = self.conn.cursor()
        c.execute("SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY name ASC")
        return [dict(r) for r in c.fetchall()]

    def get_account_by_biz(self, biz: str, user_id: int) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM accounts WHERE biz = ? AND user_id = ? AND deleted_at IS NULL",
                  (biz, user_id))
        row = c.fetchone()
        return dict(row) if row else None

    def save_account(self, biz: str, name: str, user_id: int, wxid: str = None,
                     avatar_url: str = None, description: str = None,
                     account_type: str = None,
                     gh_id: str = None, signature: str = None,
                     publish_count: int = None, masssend_count: int = None,
                     remain_money: float = None, cost_money: float = None,
                     total_num: int = None,
                     subscription_type: str = "subscribed") -> int:
        # subscribed_at is set once when first becoming subscribed, never overwritten
        subscribed_at = date.today().isoformat() if subscription_type == "subscribed" else None
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO accounts (biz, user_id, name, wxid, avatar_url, description, account_type,
                                  gh_id, signature, publish_count, masssend_count, remain_money,
                                  cost_money, total_num, subscription_type, subscribed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(biz, user_id) DO UPDATE SET
                name = excluded.name,
                wxid = COALESCE(excluded.wxid, wxid),
                avatar_url = COALESCE(excluded.avatar_url, avatar_url),
                description = COALESCE(excluded.description, description),
                account_type = COALESCE(excluded.account_type, account_type),
                gh_id = COALESCE(excluded.gh_id, gh_id),
                signature = COALESCE(excluded.signature, signature),
                publish_count = COALESCE(excluded.publish_count, publish_count),
                masssend_count = COALESCE(excluded.masssend_count, masssend_count),
                remain_money = COALESCE(excluded.remain_money, remain_money),
                cost_money = COALESCE(excluded.cost_money, cost_money),
                total_num = COALESCE(excluded.total_num, total_num),
                subscription_type = excluded.subscription_type,
                subscribed_at = CASE
                    WHEN excluded.subscription_type = 'subscribed' AND subscribed_at IS NULL
                    THEN excluded.subscribed_at
                    ELSE subscribed_at
                END,
                deleted_at = NULL
        """, (biz, user_id, name, wxid, avatar_url, description, account_type,
              gh_id, signature, publish_count, masssend_count, remain_money,
              cost_money, total_num, subscription_type, subscribed_at))
        self.conn.commit()
        c.execute("SELECT id FROM accounts WHERE biz = ? AND user_id = ?", (biz, user_id))
        return c.fetchone()[0]

    # ------------------------------------------------------------------
    # Articles
    # ------------------------------------------------------------------

    def get_all_articles_unfiltered(self) -> List[Dict]:
        """For internal use (migration, etc.) — returns all articles regardless of owner."""
        c = self.conn.cursor()
        c.execute("SELECT * FROM articles ORDER BY publish_time DESC")
        return [dict(r) for r in c.fetchall()]

    def get_all_articles(self, user_id: int) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("""
            SELECT a.* FROM articles a
            JOIN accounts acc ON a.account_id = acc.id
            WHERE acc.user_id = ?
            ORDER BY a.publish_time DESC
        """, (user_id,))
        return [dict(r) for r in c.fetchall()]

    def get_articles_by_account(self, account_id: int, user_id: int = None) -> List[Dict]:
        c = self.conn.cursor()
        if user_id is not None:
            c.execute("""
                SELECT a.* FROM articles a
                JOIN accounts acc ON a.account_id = acc.id
                WHERE a.account_id = ? AND acc.user_id = ?
                ORDER BY a.publish_time DESC
            """, (account_id, user_id))
        else:
            c.execute("""
                SELECT * FROM articles WHERE account_id = ?
                ORDER BY publish_time DESC
            """, (account_id,))
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

    def update_markdown_path(self, article_id: int, markdown_path: str):
        c = self.conn.cursor()
        c.execute("UPDATE articles SET markdown_path = ? WHERE id = ?", (markdown_path, article_id))
        self.conn.commit()

    def update_html_path(self, article_id: int, html_path: str):
        c = self.conn.cursor()
        c.execute("UPDATE articles SET html_path = ? WHERE id = ?", (html_path, article_id))
        self.conn.commit()

    def save_article(self, url: str, title: str, author: str, account: str,
                     publish_time: str, markdown_path: str = None,
                     html_path: str = None, account_id: int = None,
                     digest: str = None, cover_url: str = None,
                     is_original: bool = False,
                     # New fields
                     hashid: str = None, idx: str = None, source_url: str = None,
                     ip_wording: str = None, item_show_type: int = None,
                     real_item_show_type: int = None, msg_status: int = None,
                     msg_fail_reason: str = None, send_to_fans_num: int = None,
                     is_deleted: int = None, types: int = None,
                     position: int = None, pre_post_time: str = None,
                     video_page_infos: str = None, picture_page_info_list: str = None,
                     copyright_stat: int = None, publish_timestamp: int = None,
                     user_name: str = None, alias: str = None, signature: str = None,
                     create_time: int = None):
        c = self.conn.cursor()
        
        # Migration for existing table columns if needed (one-time check per save is simpler than complex init logic)
        existing_cols = {row[1] for row in c.execute("PRAGMA table_info(articles)")}
        for col, ddl in [
            ("hashid", "ALTER TABLE articles ADD COLUMN hashid TEXT"),
            ("idx", "ALTER TABLE articles ADD COLUMN idx TEXT"),
            ("source_url", "ALTER TABLE articles ADD COLUMN source_url TEXT"),
            ("ip_wording", "ALTER TABLE articles ADD COLUMN ip_wording TEXT"),
            ("item_show_type", "ALTER TABLE articles ADD COLUMN item_show_type INTEGER"),
            ("real_item_show_type", "ALTER TABLE articles ADD COLUMN real_item_show_type INTEGER"),
            ("msg_status", "ALTER TABLE articles ADD COLUMN msg_status INTEGER"),
            ("msg_fail_reason", "ALTER TABLE articles ADD COLUMN msg_fail_reason TEXT"),
            ("send_to_fans_num", "ALTER TABLE articles ADD COLUMN send_to_fans_num INTEGER"),
            ("is_deleted", "ALTER TABLE articles ADD COLUMN is_deleted INTEGER"),
            ("types", "ALTER TABLE articles ADD COLUMN types INTEGER"),
            ("position", "ALTER TABLE articles ADD COLUMN position INTEGER"),
            ("pre_post_time", "ALTER TABLE articles ADD COLUMN pre_post_time TIMESTAMP"),
            ("video_page_infos", "ALTER TABLE articles ADD COLUMN video_page_infos TEXT"),
            ("picture_page_info_list", "ALTER TABLE articles ADD COLUMN picture_page_info_list TEXT"),
            ("copyright_stat", "ALTER TABLE articles ADD COLUMN copyright_stat INTEGER"),
            ("publish_timestamp", "ALTER TABLE articles ADD COLUMN publish_timestamp INTEGER"),
            ("user_name", "ALTER TABLE articles ADD COLUMN user_name TEXT"),
            ("alias", "ALTER TABLE articles ADD COLUMN alias TEXT"),
            ("signature", "ALTER TABLE articles ADD COLUMN signature TEXT"),
            ("create_time", "ALTER TABLE articles ADD COLUMN create_time TEXT"),
        ]:
            if col not in existing_cols:
                c.execute(ddl)

        c.execute("""
            INSERT OR REPLACE INTO articles
              (url, title, author, account, publish_time, html_path, markdown_path,
               account_id, digest, cover_url, is_original,
               hashid, idx, source_url, ip_wording, item_show_type, real_item_show_type,
               msg_status, msg_fail_reason, send_to_fans_num, is_deleted, types,
               position, pre_post_time, video_page_infos, picture_page_info_list,
               copyright_stat, publish_timestamp, user_name, alias, signature, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (url, title, author, account, publish_time, html_path, markdown_path,
              account_id, digest, cover_url, is_original,
              hashid, idx, source_url, ip_wording, item_show_type, real_item_show_type,
              msg_status, msg_fail_reason, send_to_fans_num, is_deleted, types,
              position, pre_post_time, video_page_infos, picture_page_info_list,
              copyright_stat, publish_timestamp, user_name, alias, signature, create_time))
        self.conn.commit()

    def delete_article(self, article_id: int):
        c = self.conn.cursor()
        c.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        self.conn.commit()

    def delete_account(self, account_id: int):
        c = self.conn.cursor()
        c.execute("UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (account_id,))
        self.conn.commit()

    def get_article_count_by_account(self, account_id: int) -> int:
        c = self.conn.cursor()
        c.execute("SELECT COUNT(*) FROM articles WHERE account_id = ?", (account_id,))
        return c.fetchone()[0]

    def update_account_last_monitored(self, account_id: int):
        c = self.conn.cursor()
        c.execute("UPDATE accounts SET last_monitored_at = CURRENT_TIMESTAMP WHERE id = ?",
                  (account_id,))
        self.conn.commit()

    def set_serving_run(self, article_id: int, run_id):
        c = self.conn.cursor()
        c.execute("UPDATE articles SET serving_run_id = ? WHERE id = ?", (run_id, article_id))
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


    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    def get_setting(self, key: str, default: str = None) -> Optional[str]:
        c = self.conn.cursor()
        c.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = c.fetchone()
        return row[0] if row else default

    def set_setting(self, key: str, value: str):
        c = self.conn.cursor()
        c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
        self.conn.commit()

    # ------------------------------------------------------------------
    # Analysis queue
    # ------------------------------------------------------------------

    def enqueue_analysis(self, article_id: int) -> Dict:
        """Insert or increment request_count for an article. Returns the queue entry."""
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO analysis_queue (article_id, request_count)
            VALUES (?, 1)
            ON CONFLICT(article_id) DO UPDATE SET
                request_count = request_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('pending', 'failed')
        """, (article_id,))
        self.conn.commit()
        c.execute("SELECT * FROM analysis_queue WHERE article_id = ?", (article_id,))
        return dict(c.fetchone())

    def get_queue_entry(self, article_id: int) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM analysis_queue WHERE article_id = ?", (article_id,))
        row = c.fetchone()
        return dict(row) if row else None

    def get_queue_all(self) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("""
            SELECT q.*, a.title as article_title
            FROM analysis_queue q
            JOIN articles a ON q.article_id = a.id
            ORDER BY q.request_count DESC, q.created_at ASC
        """)
        return [dict(r) for r in c.fetchall()]

    def get_pending_queue(self, limit: int = 10) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("""
            SELECT * FROM analysis_queue
            WHERE status = 'pending'
            ORDER BY request_count DESC, created_at ASC
            LIMIT ?
        """, (limit,))
        return [dict(r) for r in c.fetchall()]

    def update_queue_entry(self, article_id: int, status: str, run_id: int = None):
        c = self.conn.cursor()
        if run_id is not None:
            c.execute("""
                UPDATE analysis_queue SET status = ?, run_id = ?,
                    updated_at = CURRENT_TIMESTAMP WHERE article_id = ?
            """, (status, run_id, article_id))
        else:
            c.execute("""
                UPDATE analysis_queue SET status = ?,
                    updated_at = CURRENT_TIMESTAMP WHERE article_id = ?
            """, (status, article_id))
        self.conn.commit()


    # ------------------------------------------------------------------
    # App users
    # ------------------------------------------------------------------

    def get_user_by_sub(self, authing_sub: str) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM app_users WHERE authing_sub = ?", (authing_sub,))
        row = c.fetchone()
        return dict(row) if row else None

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM app_users WHERE id = ?", (user_id,))
        row = c.fetchone()
        return dict(row) if row else None

    def create_user(self, authing_sub: str, email: str = None,
                    username: str = None, role: str = "user") -> int:
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO app_users (authing_sub, email, username, role)
            VALUES (?, ?, ?, ?)
        """, (authing_sub, email, username, role))
        self.conn.commit()
        return c.lastrowid

    def update_user_last_login(self, user_id: int):
        c = self.conn.cursor()
        c.execute("UPDATE app_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user_id,))
        self.conn.commit()

    def update_user(self, user_id: int, role: str = None, is_active: bool = None):
        c = self.conn.cursor()
        if role is not None:
            c.execute("UPDATE app_users SET role = ? WHERE id = ?", (role, user_id))
        if is_active is not None:
            c.execute("UPDATE app_users SET is_active = ? WHERE id = ?", (is_active, user_id))
        self.conn.commit()

    def list_users(self) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM app_users ORDER BY created_at ASC")
        return [dict(r) for r in c.fetchall()]

    # ------------------------------------------------------------------
    # Invite codes
    # ------------------------------------------------------------------

    def get_invite_code(self, code: str) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM invite_codes WHERE code = ?", (code,))
        row = c.fetchone()
        return dict(row) if row else None

    def create_invite_code(self, code: str, created_by: int,
                           expires_at: str = None, max_uses: int = None):
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO invite_codes (code, created_by, expires_at, max_uses)
            VALUES (?, ?, ?, ?)
        """, (code, created_by, expires_at, max_uses))
        self.conn.commit()

    def use_invite_code(self, code: str, used_by: int):
        """Increment use_count; deactivate automatically if max_uses reached."""
        c = self.conn.cursor()
        c.execute("""
            UPDATE invite_codes
            SET use_count    = use_count + 1,
                last_used_by = ?,
                last_used_at = CURRENT_TIMESTAMP,
                is_active    = CASE
                    WHEN max_uses IS NOT NULL AND use_count + 1 >= max_uses THEN 0
                    ELSE is_active
                END
            WHERE code = ?
        """, (used_by, code))
        self.conn.commit()

    def deactivate_invite_code(self, code: str):
        c = self.conn.cursor()
        c.execute("UPDATE invite_codes SET is_active = 0 WHERE code = ?", (code,))
        self.conn.commit()

    def list_invite_codes(self) -> List[Dict]:
        c = self.conn.cursor()
        c.execute("""
            SELECT ic.*,
                   creator.email as creator_email,
                   last_user.email as last_used_by_email
            FROM invite_codes ic
            LEFT JOIN app_users creator  ON ic.created_by   = creator.id
            LEFT JOIN app_users last_user ON ic.last_used_by = last_user.id
            ORDER BY ic.created_at DESC
        """)
        return [dict(r) for r in c.fetchall()]

    # ------------------------------------------------------------------
    # App config
    # ------------------------------------------------------------------

    def get_app_config(self, key: str) -> Optional[str]:
        c = self.conn.cursor()
        c.execute("SELECT value FROM app_config WHERE key = ?", (key,))
        row = c.fetchone()
        return row[0] if row else None

    def set_app_config(self, key: str, value: str):
        c = self.conn.cursor()
        c.execute("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)", (key, value))
        self.conn.commit()


db = ArticleDB()
