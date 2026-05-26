use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::{
    error::AppError,
    models::task::{AssignAgentRequest, CreateTaskRequest, Task, UpdateTaskRequest},
    services,
    state::AppState,
};

pub async fn list_tasks(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<String>,
) -> Result<Json<Vec<Task>>, AppError> {
    let tasks = services::tasks::list_tasks(&state.db, &project_id).await?;
    Ok(Json(tasks))
}

pub async fn get_task(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<Json<Task>, AppError> {
    let task = services::tasks::get_task(&state.db, &project_id, &task_id).await?;
    Ok(Json(task))
}

pub async fn create_task(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<String>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), AppError> {
    let task = services::tasks::create_task(&state.db, &project_id, req).await?;
    Ok((StatusCode::CREATED, Json(task)))
}

pub async fn update_task(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, AppError> {
    let task = services::tasks::update_task(&state.db, &project_id, &task_id, req).await?;
    Ok(Json(task))
}

pub async fn assign_agent(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
    Json(req): Json<AssignAgentRequest>,
) -> Result<Json<Task>, AppError> {
    let task = services::tasks::assign_agent_with_config(
        &state.db,
        &state.agent_config_path,
        &project_id,
        &task_id,
        req,
    )
    .await?;
    Ok(Json(task))
}

pub async fn delete_task(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    services::tasks::delete_task(&state.db, &project_id, &task_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
