use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::{
    error::AppError,
    models::project::{CreateProjectRequest, Project},
    services,
    state::AppState,
};

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
) -> Result<StatusCode, AppError> {
    services::projects::delete_project(&state.db, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}
