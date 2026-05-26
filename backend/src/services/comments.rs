use crate::{error::AppError, models::comment::Comment};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub fn validate_content_non_empty(content: &Option<String>) -> Result<&str, AppError> {
    let s = content.as_deref().ok_or_else(|| AppError::BadRequest {
        code: "empty_comment",
        message: "Comment cannot be empty".to_string(),
    })?;
    if s.trim().is_empty() {
        return Err(AppError::BadRequest {
            code: "empty_comment",
            message: "Comment cannot be empty".to_string(),
        });
    }
    Ok(s)
}

pub async fn create_comment(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
    content: &str,
    sent: bool,
) -> Result<Comment, AppError> {
    // Verify task exists trong project (re-fetch để tránh stale)
    let exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM tasks WHERE id = ? AND project_id = ?")
            .bind(task_id)
            .bind(project_id)
            .fetch_optional(pool)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound {
            code: "task_not_found",
            message: format!("Task '{}' not found in project '{}'", task_id, project_id),
        });
    }

    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(task_id)
    .bind(content)
    .bind(if sent { 1_i64 } else { 0_i64 })
    .bind(&created_at)
    .execute(pool)
    .await?;

    Ok(Comment {
        id,
        task_id: task_id.to_string(),
        content: content.to_string(),
        sent: if sent { 1 } else { 0 },
        created_at,
    })
}

pub async fn list_comments_for_task(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
) -> Result<Vec<Comment>, AppError> {
    let project_exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_one(pool)
        .await?;
    if project_exists == 0 {
        return Err(AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} not found", project_id),
        });
    }

    let task_exists =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tasks WHERE id = ? AND project_id = ?")
            .bind(task_id)
            .bind(project_id)
            .fetch_one(pool)
            .await?;
    if task_exists == 0 {
        return Err(AppError::NotFound {
            code: "task_not_found",
            message: format!("Task {} not found", task_id),
        });
    }

    let rows = sqlx::query_as::<_, Comment>(
        "SELECT id, task_id, content, sent, created_at \
         FROM comments WHERE task_id = ? ORDER BY created_at ASC",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Helper variant cho dùng trong tx (resume flow) — không re-fetch task, không acquire pool.
pub async fn insert_comment_in_tx<'c>(
    tx: &mut sqlx::Transaction<'c, sqlx::Sqlite>,
    task_id: &str,
    content: &str,
    sent: bool,
) -> Result<Comment, AppError> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(task_id)
    .bind(content)
    .bind(if sent { 1_i64 } else { 0_i64 })
    .bind(&created_at)
    .execute(&mut **tx)
    .await?;
    Ok(Comment {
        id,
        task_id: task_id.to_string(),
        content: content.to_string(),
        sent: if sent { 1 } else { 0 },
        created_at,
    })
}
