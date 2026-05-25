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
