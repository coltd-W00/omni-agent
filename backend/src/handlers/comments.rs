use crate::{
    error::AppError,
    models::comment::{Comment, CreateCommentRequest},
    services,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use std::sync::Arc;

pub async fn add_comment(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<(StatusCode, Json<Comment>), AppError> {
    let content = services::comments::validate_content_non_empty(&req.content)?;

    // Verify task không ở terminal state
    let task = services::tasks::get_task(&state.db, &project_id, &task_id).await?;
    if task.status == "Done" || task.status == "Cancelled" {
        return Err(AppError::Conflict {
            code: "task_terminal",
            message: format!(
                "Cannot add comment to a task in '{}' state",
                task.status.to_lowercase()
            ),
        });
    }

    let comment = services::comments::create_comment(
        &state.db,
        &project_id,
        &task_id,
        content,
        false, // sent = 0 (pending)
    )
    .await?;
    Ok((StatusCode::CREATED, Json(comment)))
}

pub async fn list_comments(
    State(state): State<Arc<AppState>>,
    Path((project_id, task_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let comments =
        services::comments::list_comments_for_task(&state.db, &project_id, &task_id).await?;
    Ok(Json(comments))
}
