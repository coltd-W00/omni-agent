use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: String,
    pub session_id: String,
    pub run_number: i64,
    pub input: Option<String>,
    pub exit_code: Option<i64>,
    pub log_path: Option<String>,
    pub log_tail: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
}
