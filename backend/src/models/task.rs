use serde::{Deserialize, Deserializer, Serialize};
use sqlx::FromRow;

fn serialize_status_lowercase<S>(value: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_lowercase())
}

/// Double-option deserializer:
/// - Field absent → outer `None` (via `#[serde(default)]`)
/// - Field present with `null` → `Some(None)`
/// - Field present with `"string"` → `Some(Some("string"))`
fn deserialize_double_option<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub seq: i64,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: Option<String>,
    /// Stored as "claude" | "codex" | null
    pub agent: Option<String>,
    /// Stored as "coder" | "reviewer" | "planner" | "debugger" | "refactorer" | null
    pub role: Option<String>,
    /// DB stores PascalCase ("Draft"), serialized lowercase ("draft") to wire
    #[serde(serialize_with = "serialize_status_lowercase")]
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    /// None = field absent from body (treated as invalid — same as empty)
    pub title: Option<String>,
    pub description: Option<String>,
    pub acceptance_criteria: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateTaskRequest {
    /// None = field absent; Some(None) = explicit null (invalid for title/desc); Some(Some(s)) = value
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub title: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub description: Option<Option<String>>,
    /// acceptanceCriteria allows null to clear it
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub acceptance_criteria: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignAgentRequest {
    pub agent: String,
    pub role: String,
}
