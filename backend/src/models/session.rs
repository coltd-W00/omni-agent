use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub task_id: String,
    pub agent: String,
    pub session_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub last_active: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResponse {
    pub session_pk: String,
    pub task_id: String,
    pub session_id: Option<String>,
    pub session_id_missing: bool,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelSessionResponse {
    pub task_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct StartSessionRequest {}
