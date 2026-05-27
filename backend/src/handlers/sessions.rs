use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};

use crate::error::AppError;
use crate::models::session::StartSessionResponse;
use crate::services::sessions;
use crate::state::AppState;

pub async fn start_session(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<Json<StartSessionResponse>, AppError> {
    let resp = sessions::start_session(
        &state.db,
        state.subprocess_map.clone(),
        &state.agent_config_path,
        &project_id,
        &task_id,
    )
    .await?;
    Ok(Json(resp))
}

pub async fn cancel_session(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let resp = sessions::cancel_session(
        &state.db,
        state.subprocess_map.clone(),
        &project_id,
        &task_id,
    )
    .await?;
    Ok(Json(resp))
}

pub async fn complete_session(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let resp = sessions::complete_session(
        &state.db,
        state.subprocess_map.clone(),
        &project_id,
        &task_id,
    )
    .await?;
    Ok(Json(resp))
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ResumeSessionRequest {
    pub comment: Option<String>,
}

pub async fn resume_session(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
    body: Option<Json<ResumeSessionRequest>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let comment = body.map(|Json(b)| b.comment).unwrap_or(None);

    let outcome = sessions::resume_session(state.clone(), &project_id, &task_id, comment).await?;

    let response = serde_json::json!({
        "sessionPk": outcome.session_pk,
        "taskId": outcome.task_id,
        "sessionId": outcome.session_id,
        "status": "running",
        "runId": outcome.run_id,
        "runNumber": outcome.run_number,
        "runInput": outcome.run_input,
        "commentId": outcome.comment.as_ref().map(|c| c.id.clone()),
        "commentSent": outcome.comment.as_ref().map(|_| true),
        "startedAt": outcome.started_at,
    });
    Ok(Json(response))
}
