use crate::db::{CacheDb, SyncQueueItem};
use std::collections::HashSet;

pub struct SyncClient {
    client: reqwest::Client,
}

impl SyncClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    /// Push pending local changes to the server.
    pub async fn push_sync_queue(
        &self,
        base_url: &str,
        items: &[SyncQueueItem],
        token: &str,
    ) -> Vec<(i64, Result<(), String>)> {
        let mut results = Vec::new();
        for item in items {
            let res = self.push_one(base_url, item, token).await;
            results.push((item.id, res));
        }
        results
    }

    async fn push_one(&self, base_url: &str, item: &SyncQueueItem, token: &str) -> Result<(), String> {
        let payload: serde_json::Value =
            serde_json::from_str(&item.payload).map_err(|e| e.to_string())?;

        match item.action.as_str() {
            "mark_read" => {
                let card_id = payload["card_id"].as_str().unwrap_or_default();
                let url = format!("{}/cards/{}/read", base_url, card_id);
                let resp = self
                    .client
                    .post(&url)
                    .bearer_auth(token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    return Err(format!("mark_read failed: {}", resp.status()));
                }
            }
            "mark_unread" => {
                let card_id = payload["card_id"].as_str().unwrap_or_default();
                let url = format!("{}/cards/{}/unread", base_url, card_id);
                let resp = self
                    .client
                    .post(&url)
                    .bearer_auth(token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    return Err(format!("mark_unread failed: {}", resp.status()));
                }
            }
            "add_favorite" => {
                let url = format!("{}/favorites", base_url);
                let resp = self
                    .client
                    .post(&url)
                    .bearer_auth(token)
                    .json(&payload)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    return Err(format!("add_favorite failed: {}", resp.status()));
                }
            }
            "remove_favorite" => {
                let item_type = payload["item_type"].as_str().unwrap_or_default();
                let item_id = payload["item_id"].as_str().unwrap_or_default();
                let url = format!("{}/favorites/{}/{}", base_url, item_type, item_id);
                let resp = self
                    .client
                    .delete(&url)
                    .bearer_auth(token)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                if !resp.status().is_success() {
                    return Err(format!("remove_favorite failed: {}", resp.status()));
                }
            }
            other => {
                return Err(format!("unknown sync action: {}", other));
            }
        }
        Ok(())
    }

    /// Pull remote changes since the given timestamp.
    /// Returns the response pages as (cards, articles, favorites, new_sync_ts).
    pub async fn pull_data(
        &self,
        base_url: &str,
        token: &str,
        since: Option<&str>,
    ) -> Result<PullResult, String> {
        let mut all_cards: Vec<serde_json::Value> = Vec::new();
        let mut all_articles: Vec<serde_json::Value> = Vec::new();
        let mut all_favorites: Vec<serde_json::Value> = Vec::new();
        let mut latest_ts: Option<String> = None;
        let mut cursor: Option<String> = None;

        loop {
            let url = format!("{}/sync", base_url);
            let mut params: Vec<(&str, String)> = vec![("limit", "500".to_string())];
            if let Some(s) = since {
                params.push(("since", s.to_string()));
            }
            if let Some(ref c) = cursor {
                params.push(("cursor", c.clone()));
            }

            let resp = self
                .client
                .get(&url)
                .query(&params)
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                return Err(format!("sync pull failed: {}", resp.status()));
            }

            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

            if let Some(cards) = body["cards"].as_array() {
                all_cards.extend(cards.iter().cloned());
            }
            if let Some(articles) = body["articles"].as_array() {
                all_articles.extend(articles.iter().cloned());
            }
            if let Some(favs) = body["favorites"].as_array() {
                all_favorites.extend(favs.iter().cloned());
            }
            if let Some(ts) = body["sync_ts"].as_str() {
                latest_ts = Some(ts.to_string());
            }

            if body["has_more"].as_bool().unwrap_or(false) {
                if let Some(c) = body["cursor"].as_i64() {
                    cursor = Some(c.to_string());
                } else if let Some(c) = body["cursor"].as_str() {
                    cursor = Some(c.to_string());
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        Ok(PullResult {
            cards: all_cards,
            articles: all_articles,
            favorites: all_favorites,
            sync_ts: latest_ts,
        })
    }
}

pub struct PullResult {
    pub cards: Vec<serde_json::Value>,
    pub articles: Vec<serde_json::Value>,
    pub favorites: Vec<serde_json::Value>,
    pub sync_ts: Option<String>,
}

/// High-level sync orchestration. Separated from SyncClient so the command
/// layer can call it while managing db mutex lifetimes properly.
pub fn apply_pull_result(
    db: &CacheDb,
    pull: &PullResult,
) -> Result<Vec<String>, String> {
    let mut changed: HashSet<String> = HashSet::new();

    if !pull.cards.is_empty() {
        db.upsert_cards(&pull.cards)?;
        changed.insert("cards".to_string());
    }
    if !pull.articles.is_empty() {
        db.upsert_articles(&pull.articles)?;
        changed.insert("articles".to_string());
    }
    if !pull.favorites.is_empty() {
        db.apply_favorites_sync(&pull.favorites)?;
        changed.insert("favorites".to_string());
    }
    if let Some(ref ts) = pull.sync_ts {
        db.set_sync_ts(ts)?;
    }

    Ok(changed.into_iter().collect())
}
