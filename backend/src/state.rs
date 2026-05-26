use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub subprocess_map: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
    pub agent_config_path: PathBuf,
}

impl AppState {
    pub async fn subprocess_count(&self) -> usize {
        self.subprocess_map.lock().await.len()
    }
}
