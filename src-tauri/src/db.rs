use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardRow {
    pub card_id: String,
    pub article_id: String,
    pub title: Option<String>,
    pub content_md: Option<String>,
    pub description: Option<String>,
    pub routing: Option<String>,
    pub article_date: Option<String>,
    pub account: Option<String>,
    pub author: Option<String>,
    pub url: Option<String>,
    pub read_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteRow {
    pub item_type: String,
    pub item_id: String,
    pub created_at: String,
    pub synced: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub card_id: String,
    pub title: Option<String>,
    pub article_id: String,
    pub account: Option<String>,
    pub article_date: Option<String>,
    pub highlight: String,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncQueueItem {
    pub id: i64,
    pub action: String,
    pub payload: String,
    pub created_at: String,
    pub retries: i32,
}

// ---------------------------------------------------------------------------
// CacheDb
// ---------------------------------------------------------------------------

pub struct CacheDb {
    conn: Mutex<Connection>,
}

impl CacheDb {
    /// Open an existing encrypted database.
    pub fn open(path: &PathBuf, hex_key: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        let pragma = format!("PRAGMA key = \"x'{}'\";", hex_key);
        conn.execute_batch(&pragma).map_err(|e| e.to_string())?;
        // Verify the key works
        conn.execute_batch("SELECT count(*) FROM sqlite_master;")
            .map_err(|e| format!("Failed to open encrypted DB (wrong key?): {}", e))?;
        Self::ensure_schema(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Create a fresh encrypted database (deletes existing file first).
    pub fn create(path: &PathBuf, hex_key: &str) -> Result<Self, String> {
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Self::open(path, hex_key)
    }

    /// Re-key the database with a new encryption key.
    pub fn rekey(&self, new_hex_key: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let pragma = format!("PRAGMA rekey = \"x'{}'\";", new_hex_key);
        conn.execute_batch(&pragma).map_err(|e| e.to_string())
    }

    fn ensure_schema(conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS cards (
                card_id TEXT PRIMARY KEY,
                article_id TEXT NOT NULL,
                title TEXT,
                content_md TEXT,
                description TEXT,
                routing TEXT,
                article_date TEXT,
                account TEXT,
                author TEXT,
                url TEXT,
                read_at TEXT,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS articles (
                article_id TEXT PRIMARY KEY,
                content_html TEXT,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS favorites (
                item_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                PRIMARY KEY (item_type, item_id)
            );
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                retries INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
                title, content_md, content=cards, content_rowid=rowid,
                tokenize='unicode61'
            );
            ",
        )
        .map_err(|e| e.to_string())
    }

    // -----------------------------------------------------------------------
    // CRUD
    // -----------------------------------------------------------------------

    pub fn get_inbox_cards(
        &self,
        account: Option<&str>,
        unread_only: bool,
    ) -> Result<Vec<CardRow>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut sql = String::from(
            "SELECT card_id, article_id, title, content_md, description, routing,
                    article_date, account, author, url, read_at, updated_at
             FROM cards WHERE routing IS NOT NULL",
        );
        if let Some(_) = account {
            sql.push_str(" AND account = ?1");
        }
        if unread_only {
            sql.push_str(" AND read_at IS NULL");
        }
        sql.push_str(" ORDER BY article_date DESC");

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows = if let Some(acct) = account {
            stmt.query_map([acct], |row| {
                Ok(CardRow {
                    card_id: row.get(0)?,
                    article_id: row.get(1)?,
                    title: row.get(2)?,
                    content_md: row.get(3)?,
                    description: row.get(4)?,
                    routing: row.get(5)?,
                    article_date: row.get(6)?,
                    account: row.get(7)?,
                    author: row.get(8)?,
                    url: row.get(9)?,
                    read_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
        } else {
            stmt.query_map([], |row| {
                Ok(CardRow {
                    card_id: row.get(0)?,
                    article_id: row.get(1)?,
                    title: row.get(2)?,
                    content_md: row.get(3)?,
                    description: row.get(4)?,
                    routing: row.get(5)?,
                    article_date: row.get(6)?,
                    account: row.get(7)?,
                    author: row.get(8)?,
                    url: row.get(9)?,
                    read_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
        };

        Ok(rows)
    }

    pub fn get_favorites(&self) -> Result<Vec<FavoriteRow>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT item_type, item_id, created_at, synced FROM favorites ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(FavoriteRow {
                    item_type: row.get(0)?,
                    item_id: row.get(1)?,
                    created_at: row.get(2)?,
                    synced: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn get_article_content(&self, article_id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT content_html FROM articles WHERE article_id = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map([article_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(html)) => Ok(Some(html)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    pub fn mark_read(&self, card_id: &str, read_at: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE cards SET read_at = ?1 WHERE card_id = ?2",
            rusqlite::params![read_at, card_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_queue (action, payload, created_at) VALUES ('mark_read', ?1, ?2)",
            rusqlite::params![
                serde_json::json!({"card_id": card_id}).to_string(),
                read_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_favorite(&self, item_type: &str, item_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO favorites (item_type, item_id, created_at, synced) VALUES (?1, ?2, ?3, 0)",
            rusqlite::params![item_type, item_id, now],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_queue (action, payload, created_at) VALUES ('add_favorite', ?1, ?2)",
            rusqlite::params![
                serde_json::json!({"item_type": item_type, "item_id": item_id}).to_string(),
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_favorite(&self, item_type: &str, item_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "DELETE FROM favorites WHERE item_type = ?1 AND item_id = ?2",
            rusqlite::params![item_type, item_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_queue (action, payload, created_at) VALUES ('remove_favorite', ?1, ?2)",
            rusqlite::params![
                serde_json::json!({"item_type": item_type, "item_id": item_id}).to_string(),
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn search_cards(&self, query: &str) -> Result<Vec<SearchResult>, String> {
        // Sanitize FTS5 query: escape special chars, wrap in double quotes for phrase match
        let sanitized = query.replace('"', "\"\"");
        let fts_query = format!("\"{}\"", sanitized);

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT c.card_id, c.title, c.article_id, c.account, c.article_date,
                        snippet(cards_fts, 1, '<mark>', '</mark>', '...', 32),
                        CASE WHEN fav.item_id IS NOT NULL THEN 1 ELSE 0 END as is_fav
                 FROM cards_fts f
                 JOIN cards c ON c.rowid = f.rowid
                 LEFT JOIN favorites fav ON fav.item_type = 'card' AND fav.item_id = c.card_id
                 WHERE cards_fts MATCH ?1
                 ORDER BY is_fav DESC, rank
                 LIMIT 50",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&fts_query], |row| {
                Ok(SearchResult {
                    card_id: row.get(0)?,
                    title: row.get(1)?,
                    article_id: row.get(2)?,
                    account: row.get(3)?,
                    article_date: row.get(4)?,
                    highlight: row.get(5)?,
                    is_favorite: row.get::<_, i32>(6)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    // -----------------------------------------------------------------------
    // Sync helpers
    // -----------------------------------------------------------------------

    pub fn upsert_cards(&self, cards: &[serde_json::Value]) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;
        let mut count = 0usize;
        for card in cards {
            let card_id = card["card_id"].as_str().unwrap_or_default();
            // Delete old FTS entry (get rowid first)
            if let Ok(rowid) = conn.query_row(
                "SELECT rowid FROM cards WHERE card_id = ?1",
                [card_id],
                |r| r.get::<_, i64>(0),
            ) {
                conn.execute(
                    "DELETE FROM cards_fts WHERE rowid = ?1",
                    rusqlite::params![rowid],
                )
                .ok();
            }
            conn.execute(
                "INSERT OR REPLACE INTO cards
                 (card_id, article_id, title, content_md, description, routing,
                  article_date, account, author, url, read_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                rusqlite::params![
                    card_id,
                    card["article_id"].as_str().unwrap_or_default(),
                    card["title"].as_str(),
                    card["content_md"].as_str(),
                    card["description"].as_str(),
                    card["routing"].as_str(),
                    card["article_date"].as_str(),
                    card["account"].as_str(),
                    card["author"].as_str(),
                    card["url"].as_str(),
                    card["read_at"].as_str(),
                    card["updated_at"].as_str().unwrap_or_default(),
                ],
            )
            .map_err(|e| e.to_string())?;
            // Insert new FTS entry
            if let Ok(rowid) = conn.query_row(
                "SELECT rowid FROM cards WHERE card_id = ?1",
                [card_id],
                |r| r.get::<_, i64>(0),
            ) {
                conn.execute(
                    "INSERT INTO cards_fts (rowid, title, content_md) VALUES (?1, ?2, ?3)",
                    rusqlite::params![
                        rowid,
                        card["title"].as_str().unwrap_or_default(),
                        card["content_md"].as_str().unwrap_or_default(),
                    ],
                )
                .ok();
            }
            count += 1;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(count)
    }

    pub fn upsert_articles(&self, articles: &[serde_json::Value]) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut count = 0usize;
        for article in articles {
            conn.execute(
                "INSERT OR REPLACE INTO articles (article_id, content_html, updated_at)
                 VALUES (?1, ?2, ?3)",
                rusqlite::params![
                    article["article_id"].as_str().unwrap_or_default(),
                    article["content_html"].as_str(),
                    article["updated_at"].as_str().unwrap_or_default(),
                ],
            )
            .map_err(|e| e.to_string())?;
            count += 1;
        }
        Ok(count)
    }

    pub fn apply_favorites_sync(&self, favorites: &[serde_json::Value]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        for fav in favorites {
            let item_type = fav["item_type"].as_str().unwrap_or_default();
            let item_id = fav["item_id"].as_str().unwrap_or_default();
            if fav["deleted"].as_bool().unwrap_or(false) {
                conn.execute(
                    "DELETE FROM favorites WHERE item_type = ?1 AND item_id = ?2",
                    rusqlite::params![item_type, item_id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let created_at = fav["created_at"].as_str().unwrap_or_default();
                conn.execute(
                    "INSERT OR REPLACE INTO favorites (item_type, item_id, created_at, synced)
                     VALUES (?1, ?2, ?3, 1)",
                    rusqlite::params![item_type, item_id, created_at],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub fn get_sync_ts(&self) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM sync_state WHERE key = 'last_sync_ts'")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(v)) => Ok(Some(v)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    pub fn set_sync_ts(&self, ts: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_sync_ts', ?1)",
            [ts],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_sync_queue(&self, limit: i32) -> Result<Vec<SyncQueueItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, action, payload, created_at, retries
                 FROM sync_queue WHERE retries < 5 ORDER BY id LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([limit], |row| {
                Ok(SyncQueueItem {
                    id: row.get(0)?,
                    action: row.get(1)?,
                    payload: row.get(2)?,
                    created_at: row.get(3)?,
                    retries: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn remove_sync_queue_item(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_queue WHERE id = ?1", [id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn increment_sync_queue_retries(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_queue SET retries = retries + 1 WHERE id = ?1",
            [id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
