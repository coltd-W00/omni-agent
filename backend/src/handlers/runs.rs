use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};

use crate::error::AppError;
use crate::services;
use crate::state::AppState;

pub async fn list_runs(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let runs = services::runs::list_runs_for_task(&state.db, &project_id, &task_id).await?;
    Ok(Json(runs))
}

pub async fn get_run(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id, run_id)): Path<(String, String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let run = services::runs::get_run_by_id(&state.db, &project_id, &task_id, &run_id).await?;
    Ok(Json(run))
}
