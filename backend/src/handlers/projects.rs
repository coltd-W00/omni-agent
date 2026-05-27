use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;

use crate::{
    error::AppError,
    models::project::{CreateProjectRequest, Project, UpdateProjectRequest},
    services,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct DeleteProjectQuery {
    #[serde(default)]
    force: bool,
}

pub async fn list_projects(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Project>>, AppError> {
    let projects = services::projects::list_projects(&state.db).await?;
    Ok(Json(projects))
}

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<Project>), AppError> {
    let project = services::projects::create_project(&state.db, req).await?;
    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<DeleteProjectQuery>,
) -> Result<StatusCode, AppError> {
    if query.force {
        let task_ids = services::projects::list_project_task_ids(&state.db, &id).await?;
        let mut subprocess_map = state.subprocess_map.lock().await;
        for task_id in task_ids {
            if let Some(mut child) = subprocess_map.remove(&task_id) {
                let _ = child.start_kill();
            }
        }
    }
    services::projects::delete_project(&state.db, &id, query.force).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, AppError> {
    let project = services::projects::update_project(&state.db, &id, req).await?;
    Ok(Json(project))
}
