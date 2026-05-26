use std::path::Path;

use crate::error::AppError;
use crate::models::task::{AssignAgentRequest, CreateTaskRequest, Task, UpdateTaskRequest};
use crate::services::agent_config;
use sqlx::{Connection, SqlitePool};
const VALID_AGENTS: &[&str] = &["codex", "claude"];
const VALID_ROLES: &[&str] = &["coder", "reviewer", "planner", "debugger", "refactorer"];

pub async fn list_tasks(pool: &SqlitePool, project_id: &str) -> Result<Vec<Task>, AppError> {
    // Verify project exists
    verify_project_exists(pool, project_id).await?;

    let tasks = sqlx::query_as::<_, Task>(
        "SELECT id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at \
         FROM tasks WHERE project_id = ? ORDER BY seq ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(tasks)
}

pub async fn get_task(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
) -> Result<Task, AppError> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at \
         FROM tasks WHERE id = ? AND project_id = ?",
    )
    .bind(task_id)
    .bind(project_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound {
        code: "task_not_found",
        message: format!("Task {} does not exist", task_id),
    })?;

    Ok(task)
}

pub async fn create_task(
    pool: &SqlitePool,
    project_id: &str,
    req: CreateTaskRequest,
) -> Result<Task, AppError> {
    validate_assignment(req.agent.as_deref(), req.role.as_deref())?;
    // Validate title
    let title = req.title.unwrap_or_default();
    let title = title.trim().to_string();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::BadRequest {
            code: "invalid_task_title",
            message: "Task title must be 1–200 characters".to_string(),
        });
    }

    // Validate description
    let description = req.description.unwrap_or_default();
    let description = description.trim().to_string();
    if description.is_empty() || description.chars().count() > 5000 {
        return Err(AppError::BadRequest {
            code: "invalid_task_description",
            message: "Task description must be 1–5000 characters".to_string(),
        });
    }

    let acceptance_criteria = req.acceptance_criteria.and_then(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let agent = req.agent.unwrap().trim().to_string();
    let role = req.role.unwrap().trim().to_string();

    if acceptance_criteria
        .as_ref()
        .map(|ac| ac.chars().count() > 5000)
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest {
            code: "invalid_task_acceptance_criteria",
            message: "Acceptance criteria must be at most 5000 characters".to_string(),
        });
    }

    // Race-safe seq + id generation in a single IMMEDIATE transaction
    // BEGIN IMMEDIATE acquires write lock upfront, preventing concurrent seq duplication.
    let now = chrono::Utc::now().to_rfc3339();
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin_with("BEGIN IMMEDIATE").await?;

    // Verify project exists + get key (inside transaction for consistency)
    let project_key = sqlx::query_scalar::<_, String>("SELECT key FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} does not exist", project_id),
        })?;

    let seq: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(&mut *tx)
            .await?;

    let task_id = if seq < 1000 {
        format!("{}-{:03}", project_key, seq)
    } else {
        format!("{}-{}", project_key, seq)
    };

    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?)",
    )
    .bind(&task_id)
    .bind(project_id)
    .bind(seq)
    .bind(&title)
    .bind(&description)
    .bind(&acceptance_criteria)
    .bind(&agent)
    .bind(&role)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Task {
        id: task_id,
        project_id: project_id.to_string(),
        seq,
        title,
        description,
        acceptance_criteria,
        agent: Some(agent),
        role: Some(role),
        status: "Assigned".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn create_task_with_config(
    pool: &SqlitePool,
    agent_config_path: &Path,
    project_id: &str,
    req: CreateTaskRequest,
) -> Result<Task, AppError> {
    if let Some(agent) = req.agent.as_deref() {
        agent_config::enabled_agent(agent_config_path, agent)?;
    }
    create_task(pool, project_id, req).await
}

fn validate_assignment(agent: Option<&str>, role: Option<&str>) -> Result<(), AppError> {
    let agent = agent.map(str::trim).unwrap_or_default();
    if agent.is_empty() {
        return Err(AppError::BadRequest {
            code: "invalid_agent",
            message: "Agent must be one of: codex, claude".to_string(),
        });
    }

    let role = role.map(str::trim).unwrap_or_default();
    if !VALID_ROLES.contains(&role) {
        return Err(AppError::BadRequest {
            code: "invalid_role",
            message: "Role must be one of: coder, reviewer, planner, debugger, refactorer"
                .to_string(),
        });
    }

    Ok(())
}

pub async fn update_task(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
    req: UpdateTaskRequest,
) -> Result<Task, AppError> {
    let existing = get_task(pool, project_id, task_id).await?;

    // Block edit on done/cancelled
    let status_lower = existing.status.to_lowercase();
    if status_lower == "done" || status_lower == "cancelled" {
        return Err(AppError::Conflict {
            code: "task_locked",
            message: format!("Cannot edit task in {} status", status_lower),
        });
    }

    // Merge fields
    let new_title = match req.title {
        None => existing.title.clone(),
        Some(None) => {
            return Err(AppError::BadRequest {
                code: "invalid_task_title",
                message: "Task title must be 1–200 characters".to_string(),
            });
        }
        Some(Some(s)) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() || trimmed.chars().count() > 200 {
                return Err(AppError::BadRequest {
                    code: "invalid_task_title",
                    message: "Task title must be 1–200 characters".to_string(),
                });
            }
            trimmed
        }
    };

    let new_description = match req.description {
        None => existing.description.clone(),
        Some(None) => {
            return Err(AppError::BadRequest {
                code: "invalid_task_description",
                message: "Task description must be 1–5000 characters".to_string(),
            });
        }
        Some(Some(s)) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() || trimmed.chars().count() > 5000 {
                return Err(AppError::BadRequest {
                    code: "invalid_task_description",
                    message: "Task description must be 1–5000 characters".to_string(),
                });
            }
            trimmed
        }
    };

    let new_ac: Option<String> = match req.acceptance_criteria {
        None => existing.acceptance_criteria.clone(),
        Some(None) => None,
        Some(Some(s)) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() {
                None
            } else if trimmed.chars().count() > 5000 {
                return Err(AppError::BadRequest {
                    code: "invalid_task_acceptance_criteria",
                    message: "Acceptance criteria must be at most 5000 characters".to_string(),
                });
            } else {
                Some(trimmed)
            }
        }
    };

    let now = chrono::Utc::now().to_rfc3339();

    // F4: Check rows_affected to guard against concurrent delete between GET and UPDATE.
    let result = sqlx::query(
        "UPDATE tasks SET title = ?, description = ?, acceptance_criteria = ?, updated_at = ? \
         WHERE id = ? AND project_id = ? AND status NOT IN ('Done', 'Cancelled')",
    )
    .bind(&new_title)
    .bind(&new_description)
    .bind(&new_ac)
    .bind(&now)
    .bind(task_id)
    .bind(project_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        // Task was concurrently deleted or status changed — re-fetch to get accurate error.
        return Err(get_task(pool, project_id, task_id).await.map_or_else(
            |e| e,
            |t| AppError::Conflict {
                code: "task_locked",
                message: format!("Cannot edit task in {} status", t.status.to_lowercase()),
            },
        ));
    }

    // Re-fetch from DB to return the authoritative post-update state.
    get_task(pool, project_id, task_id).await
}

pub async fn assign_agent(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
    req: AssignAgentRequest,
) -> Result<Task, AppError> {
    if !VALID_AGENTS.contains(&req.agent.as_str()) {
        return Err(AppError::BadRequest {
            code: "invalid_agent",
            message: "Agent must be one of: codex, claude".to_string(),
        });
    }
    assign_agent_validated(pool, project_id, task_id, req).await
}

pub async fn assign_agent_with_config(
    pool: &SqlitePool,
    agent_config_path: &Path,
    project_id: &str,
    task_id: &str,
    req: AssignAgentRequest,
) -> Result<Task, AppError> {
    agent_config::enabled_agent(agent_config_path, &req.agent)?;
    assign_agent_validated(pool, project_id, task_id, req).await
}

async fn assign_agent_validated(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
    req: AssignAgentRequest,
) -> Result<Task, AppError> {
    validate_assignment(Some(&req.agent), Some(&req.role))?;

    // F3 (TOCTOU): verify status is assignable before updating; use WHERE to guard against
    // concurrent status change. F4: check rows_affected and re-fetch from DB.
    let existing = get_task(pool, project_id, task_id).await?;

    let status_lower = existing.status.to_lowercase();
    if status_lower != "draft" && status_lower != "ready" && status_lower != "assigned" {
        return Err(AppError::Conflict {
            code: "task_not_assignable",
            message: format!("Cannot assign agent to task in {} status", status_lower),
        });
    }

    let now = chrono::Utc::now().to_rfc3339();

    // Atomic update: only succeeds if status is still Draft, Ready, or Assigned
    let result = sqlx::query(
        "UPDATE tasks SET agent = ?, role = ?, status = 'Assigned', updated_at = ? \
         WHERE id = ? AND project_id = ? AND status IN ('Draft', 'Ready', 'Assigned')",
    )
    .bind(&req.agent)
    .bind(&req.role)
    .bind(&now)
    .bind(task_id)
    .bind(project_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        // Task was concurrently deleted or status changed between GET and UPDATE.
        return Err(get_task(pool, project_id, task_id).await.map_or_else(
            |e| e,
            |t| AppError::Conflict {
                code: "task_not_assignable",
                message: format!(
                    "Cannot assign agent to task in {} status",
                    t.status.to_lowercase()
                ),
            },
        ));
    }

    // Re-fetch from DB to return the authoritative post-update state.
    get_task(pool, project_id, task_id).await
}

pub async fn delete_task(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
) -> Result<(), AppError> {
    let existing = get_task(pool, project_id, task_id).await?;

    let status_lower = existing.status.to_lowercase();
    if status_lower != "draft" {
        return Err(AppError::Conflict {
            code: "task_not_deletable",
            message: format!(
                "Can only delete task in draft status; current status is {}",
                status_lower
            ),
        });
    }

    // F3/F5: Atomic delete — only succeeds if task is still in Draft status.
    // Check rows_affected to guard against concurrent status change or deletion.
    let result =
        sqlx::query("DELETE FROM tasks WHERE id = ? AND project_id = ? AND status = 'Draft'")
            .bind(task_id)
            .bind(project_id)
            .execute(pool)
            .await?;

    if result.rows_affected() == 0 {
        // Task was concurrently deleted or status changed between GET and DELETE.
        return Err(get_task(pool, project_id, task_id).await.map_or_else(
            |e| e,
            |t| AppError::Conflict {
                code: "task_not_deletable",
                message: format!(
                    "Can only delete task in draft status; current status is {}",
                    t.status.to_lowercase()
                ),
            },
        ));
    }

    Ok(())
}

// Helper: verify project exists
pub async fn verify_project_exists(pool: &SqlitePool, project_id: &str) -> Result<(), AppError> {
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_one(pool)
        .await?;

    if !exists {
        return Err(AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} does not exist", project_id),
        });
    }
    Ok(())
}

fn status_to_start_error(status: &str, task_id: &str) -> AppError {
    let status_lower = status.to_lowercase();
    match status_lower.as_str() {
        "running" => AppError::Conflict {
            code: "session_already_active",
            message: format!("Task {} already has an active session", task_id),
        },
        "paused" | "failed" => AppError::Conflict {
            code: "task_not_assigned",
            message: format!(
                "Cannot start session: task {} is in {} status (must be assigned; use /sessions/resume for paused/failed)",
                task_id, status_lower
            ),
        },
        _ => AppError::Conflict {
            code: "task_not_assigned",
            message: format!(
                "Cannot start session: task {} is in {} status (must be assigned)",
                task_id, status_lower
            ),
        },
    }
}

pub async fn transition_to_running(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
) -> Result<Task, AppError> {
    use sqlx::Connection;

    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin_with("BEGIN IMMEDIATE").await?;

    // 1. SELECT task
    let task = sqlx::query_as::<_, Task>(
        "SELECT id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at \
         FROM tasks WHERE id = ? AND project_id = ?",
    )
    .bind(task_id)
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound {
        code: "task_not_found",
        message: format!("Task {} does not exist", task_id),
    })?;

    // 2. Fast-path: reject non-Assigned statuses before agent check
    if task.status != "Assigned" {
        return Err(status_to_start_error(&task.status, task_id));
    }

    // 3. Verify agent is set
    if task.agent.is_none() {
        return Err(AppError::Conflict {
            code: "task_not_assigned",
            message: format!(
                "Cannot start session: task {} has no agent assigned",
                task_id
            ),
        });
    }

    // 4. Atomic UPDATE Assigned → Running
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE tasks SET status = 'Running', updated_at = ? WHERE id = ? AND project_id = ? AND status = 'Assigned'",
    )
    .bind(&now)
    .bind(task_id)
    .bind(project_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        // Re-fetch to get current status
        let current = sqlx::query_as::<_, Task>(
            "SELECT id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at \
             FROM tasks WHERE id = ? AND project_id = ?",
        )
        .bind(task_id)
        .bind(project_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound {
            code: "task_not_found",
            message: format!("Task {} does not exist", task_id),
        })?;
        // tx auto-rollbacks on drop
        return Err(status_to_start_error(&current.status, task_id));
    }

    tx.commit().await?;

    // Re-fetch updated task
    get_task(pool, project_id, task_id).await
}

pub async fn transition_to_paused(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = sqlx::query(
        "UPDATE tasks SET status = 'Paused', updated_at = ? WHERE id = ? AND status = 'Running'",
    )
    .bind(&now)
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();
    if rows == 0 {
        tracing::warn!(
            task_id,
            "transition_to_paused: task not in Running state, skipping"
        );
    }
    Ok(())
}

pub async fn transition_to_failed(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = sqlx::query(
        "UPDATE tasks SET status = 'Failed', updated_at = ? WHERE id = ? AND status = 'Running'",
    )
    .bind(&now)
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();
    if rows == 0 {
        tracing::warn!(
            task_id,
            "transition_to_failed: task not in Running state, skipping"
        );
    }
    Ok(())
}

pub async fn transition_to_cancelled(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = sqlx::query(
        "UPDATE tasks SET status = 'Cancelled', updated_at = ? WHERE id = ? AND status = 'Running'",
    )
    .bind(&now)
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();
    if rows == 0 {
        return Err(AppError::Conflict {
            code: "task_not_running",
            message: "Can only cancel a running task".to_string(),
        });
    }
    Ok(())
}

pub async fn revert_to_assigned(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE tasks SET status = 'Assigned', updated_at = ? WHERE id = ? AND status = 'Running'",
    )
    .bind(&now)
    .bind(task_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        tracing::warn!(
            task_id = %task_id,
            "revert_to_assigned: task not in Running state (race or already reverted)"
        );
    }
    Ok(())
}

pub async fn transition_to_running_in_tx<'c>(
    tx: &mut sqlx::Transaction<'c, sqlx::Sqlite>,
    task_id: &str,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE tasks SET status = 'Running', updated_at = ? WHERE id = ? AND status IN ('Paused','Failed')",
    )
    .bind(&now)
    .bind(task_id)
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::Conflict {
            code: "task_status_changed",
            message: format!("Task '{}' is no longer in Paused/Failed state", task_id),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::models::project::CreateProjectRequest;
    use crate::services::projects::create_project;

    async fn setup_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    async fn insert_test_project(pool: &SqlitePool, key: &str, name: &str) -> String {
        let project = create_project(
            pool,
            CreateProjectRequest {
                key: key.to_string(),
                workspace_path: Some("/tmp".to_string()),
                name: name.to_string(),
            },
        )
        .await
        .unwrap();
        project.id
    }

    fn valid_create_req(title: &str, description: &str) -> CreateTaskRequest {
        CreateTaskRequest {
            title: Some(title.to_string()),
            description: Some(description.to_string()),
            acceptance_criteria: None,
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        }
    }

    #[tokio::test]
    async fn create_task_inserts_row() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "OmniAgent Core").await;

        let task = create_task(
            &pool,
            &project_id,
            valid_create_req("Fix login", "Token broken"),
        )
        .await
        .unwrap();

        assert_eq!(task.id, "OMNI-001");
        assert_eq!(task.seq, 1);
        assert_eq!(task.status, "Assigned");
        assert_eq!(task.agent.as_deref(), Some("claude"));
        assert!(!task.created_at.is_empty());
    }

    #[tokio::test]
    async fn create_task_auto_increments_seq_per_project() {
        let pool = setup_pool().await;
        let omni_id = insert_test_project(&pool, "OMNI", "OmniAgent").await;
        let erp_id = insert_test_project(&pool, "ERP", "ERP Project").await;

        let t1 = create_task(&pool, &omni_id, valid_create_req("Task 1", "Desc 1"))
            .await
            .unwrap();
        let t2 = create_task(&pool, &omni_id, valid_create_req("Task 2", "Desc 2"))
            .await
            .unwrap();
        let t3 = create_task(&pool, &erp_id, valid_create_req("ERP Task 1", "ERP Desc"))
            .await
            .unwrap();

        assert_eq!(t1.id, "OMNI-001");
        assert_eq!(t1.seq, 1);
        assert_eq!(t2.id, "OMNI-002");
        assert_eq!(t2.seq, 2);
        assert_eq!(t3.id, "ERP-001");
        assert_eq!(t3.seq, 1);
    }

    #[tokio::test]
    async fn create_task_zero_pads_under_1000() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        // Insert seq=999 directly
        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-999', ?, 999, 'Task 999', 'Desc', 'Draft', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        // Creating new task should be OMNI-1000 (no padding)
        let t = create_task(&pool, &project_id, valid_create_req("Task 1000", "Desc"))
            .await
            .unwrap();
        assert_eq!(t.id, "OMNI-1000");
        assert_eq!(t.seq, 1000);
    }

    #[tokio::test]
    async fn create_task_rejects_empty_title() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        for title in &["", "   ", "  "] {
            let req = CreateTaskRequest {
                title: Some(title.to_string()),
                description: Some("desc".to_string()),
                acceptance_criteria: None,
                agent: Some("claude".to_string()),
                role: Some("coder".to_string()),
            };
            let err = create_task(&pool, &project_id, req).await.unwrap_err();
            match err {
                AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_title"),
                _ => panic!("expected BadRequest"),
            }
        }

        // Missing title (None)
        let req_missing = CreateTaskRequest {
            title: None,
            description: Some("desc".to_string()),
            acceptance_criteria: None,
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        let err = create_task(&pool, &project_id, req_missing)
            .await
            .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_title"),
            _ => panic!("expected BadRequest for missing title"),
        }
    }

    #[tokio::test]
    async fn create_task_rejects_long_title() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let long_title = "a".repeat(201);
        let req = CreateTaskRequest {
            title: Some(long_title),
            description: Some("desc".to_string()),
            acceptance_criteria: None,
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        let err = create_task(&pool, &project_id, req).await.unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_title"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn create_task_rejects_empty_description() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        for desc in &["", "   "] {
            let req = CreateTaskRequest {
                title: Some("title".to_string()),
                description: Some(desc.to_string()),
                acceptance_criteria: None,
                agent: Some("claude".to_string()),
                role: Some("coder".to_string()),
            };
            let err = create_task(&pool, &project_id, req).await.unwrap_err();
            match err {
                AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_description"),
                _ => panic!("expected BadRequest"),
            }
        }
    }

    #[tokio::test]
    async fn create_task_rejects_long_description() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let long_desc = "a".repeat(5001);
        let req = CreateTaskRequest {
            title: Some("title".to_string()),
            description: Some(long_desc),
            acceptance_criteria: None,
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        let err = create_task(&pool, &project_id, req).await.unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_description"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn create_task_rejects_long_acceptance_criteria() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let long_ac = "a".repeat(5001);
        let req = CreateTaskRequest {
            title: Some("title".to_string()),
            description: Some("desc".to_string()),
            acceptance_criteria: Some(long_ac),
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        let err = create_task(&pool, &project_id, req).await.unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => {
                assert_eq!(code, "invalid_task_acceptance_criteria")
            }
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn create_task_normalizes_empty_ac_to_null() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let req = CreateTaskRequest {
            title: Some("title".to_string()),
            description: Some("desc".to_string()),
            acceptance_criteria: Some("".to_string()),
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        let task = create_task(&pool, &project_id, req).await.unwrap();
        assert!(task.acceptance_criteria.is_none());
    }

    #[tokio::test]
    async fn create_task_project_not_found() {
        let pool = setup_pool().await;
        let err = create_task(
            &pool,
            "00000000-0000-0000-0000-000000000000",
            valid_create_req("title", "desc"),
        )
        .await
        .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "project_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn list_tasks_orders_by_seq() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        create_task(&pool, &project_id, valid_create_req("T1", "D1"))
            .await
            .unwrap();
        create_task(&pool, &project_id, valid_create_req("T2", "D2"))
            .await
            .unwrap();
        create_task(&pool, &project_id, valid_create_req("T3", "D3"))
            .await
            .unwrap();

        let tasks = list_tasks(&pool, &project_id).await.unwrap();
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].seq, 1);
        assert_eq!(tasks[1].seq, 2);
        assert_eq!(tasks[2].seq, 3);
    }

    #[tokio::test]
    async fn list_tasks_returns_empty_for_new_project() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let tasks = list_tasks(&pool, &project_id).await.unwrap();
        assert!(tasks.is_empty());
    }

    #[tokio::test]
    async fn list_tasks_project_not_found() {
        let pool = setup_pool().await;
        let err = list_tasks(&pool, "00000000-0000-0000-0000-000000000000")
            .await
            .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "project_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn get_task_returns_existing() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("My Task", "Desc"))
            .await
            .unwrap();

        let task = get_task(&pool, &project_id, "OMNI-001").await.unwrap();
        assert_eq!(task.title, "My Task");
        assert_eq!(task.id, "OMNI-001");
    }

    #[tokio::test]
    async fn get_task_not_found() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let err = get_task(&pool, &project_id, "OMNI-999").await.unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn get_task_wrong_project_returns_404() {
        let pool = setup_pool().await;
        let omni_id = insert_test_project(&pool, "OMNI", "OmniAgent").await;
        let erp_id = insert_test_project(&pool, "ERP", "ERP").await;

        create_task(&pool, &omni_id, valid_create_req("Task", "Desc"))
            .await
            .unwrap();

        // Try to access OMNI-001 via ERP project
        let err = get_task(&pool, &erp_id, "OMNI-001").await.unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn update_task_partial_title_only() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(
            &pool,
            &project_id,
            valid_create_req("Old Title", "Old Desc"),
        )
        .await
        .unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("New Title".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap();

        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.description, "Old Desc"); // unchanged
    }

    #[tokio::test]
    async fn update_task_set_ac_to_null() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let req = CreateTaskRequest {
            title: Some("T".to_string()),
            description: Some("D".to_string()),
            acceptance_criteria: Some("Some AC".to_string()),
            agent: Some("claude".to_string()),
            role: Some("coder".to_string()),
        };
        create_task(&pool, &project_id, req).await.unwrap();

        let update_req = UpdateTaskRequest {
            title: None,
            description: None,
            acceptance_criteria: Some(None), // set to null
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", update_req)
            .await
            .unwrap();
        assert!(updated.acceptance_criteria.is_none());
    }

    #[tokio::test]
    async fn update_task_set_ac_empty_string_normalizes_to_null() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET status = 'Draft' WHERE id = 'OMNI-001'")
            .execute(&pool)
            .await
            .unwrap();

        let req = UpdateTaskRequest {
            title: None,
            description: None,
            acceptance_criteria: Some(Some("".to_string())),
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap();
        assert!(updated.acceptance_criteria.is_none());
    }

    #[tokio::test]
    async fn update_task_rejects_empty_title() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let err = update_task(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_task_title"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn update_task_rejects_when_done() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-001', ?, 1, 'Title', 'Desc', 'Done', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("New".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let err = update_task(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, message } => {
                assert_eq!(code, "task_locked");
                assert!(message.contains("done"));
            }
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn update_task_rejects_when_cancelled() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-001', ?, 1, 'Title', 'Desc', 'Cancelled', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("New".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let err = update_task(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, message } => {
                assert_eq!(code, "task_locked");
                assert!(message.contains("cancelled"));
            }
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn update_task_task_not_found() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let req = UpdateTaskRequest::default();
        let err = update_task(&pool, &project_id, "OMNI-999", req)
            .await
            .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn assign_agent_happy_path() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "coder".to_string(),
        };
        let task = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap();
        assert_eq!(task.status, "Assigned");
        assert_eq!(task.agent.as_deref(), Some("claude"));
        assert_eq!(task.role.as_deref(), Some("coder"));
    }

    #[tokio::test]
    async fn assign_agent_from_ready() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-001', ?, 1, 'T', 'D', 'Ready', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        let req = AssignAgentRequest {
            agent: "codex".to_string(),
            role: "reviewer".to_string(),
        };
        let task = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap();
        assert_eq!(task.status, "Assigned");
    }

    #[tokio::test]
    async fn assign_agent_rejects_invalid_agent() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();

        let req = AssignAgentRequest {
            agent: "gemini".to_string(),
            role: "coder".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_agent"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn assign_agent_rejects_invalid_role() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "manager".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_role"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn assign_agent_rejects_when_running() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-001', ?, 1, 'T', 'D', 'Running', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "coder".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assignable"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn assign_agent_rejects_when_done() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
             VALUES ('OMNI-001', ?, 1, 'T', 'D', 'Done', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .bind(&project_id)
        .execute(&pool)
        .await
        .unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "coder".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assignable"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn delete_task_draft_succeeds() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET status = 'Draft' WHERE id = 'OMNI-001'")
            .execute(&pool)
            .await
            .unwrap();

        delete_task(&pool, &project_id, "OMNI-001").await.unwrap();

        let err = get_task(&pool, &project_id, "OMNI-001").await.unwrap_err();
        match err {
            AppError::NotFound { .. } => {}
            _ => panic!("expected NotFound after delete"),
        }
    }

    #[tokio::test]
    async fn delete_task_rejects_non_draft() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;

        for (i, status) in ["Ready", "Assigned", "Done"].iter().enumerate() {
            // Use distinct seq per task to satisfy UNIQUE(project_id, seq) constraint
            let seq = (i + 1) as i64;
            let task_id = format!("OMNI-{}", status);
            sqlx::query(
                "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
                 VALUES (?, ?, ?, 'T', 'D', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
            .bind(&task_id)
            .bind(&project_id)
            .bind(seq)
            .bind(status)
            .execute(&pool)
            .await
            .unwrap();

            let err = delete_task(&pool, &project_id, &task_id).await.unwrap_err();
            match err {
                AppError::Conflict { code, .. } => assert_eq!(code, "task_not_deletable"),
                _ => panic!("expected Conflict for status {}", status),
            }

            // Verify row still exists
            get_task(&pool, &project_id, &task_id).await.unwrap();
        }
    }

    #[tokio::test]
    async fn delete_task_not_found() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let err = delete_task(&pool, &project_id, "OMNI-999")
            .await
            .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    // --- transition_to_running tests ---

    async fn setup_assigned_task(pool: &SqlitePool) -> (String, String) {
        let project_id = insert_test_project(pool, "OMNI", "Test").await;
        let task = create_task(pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        assign_agent(
            pool,
            &project_id,
            &task.id,
            crate::models::task::AssignAgentRequest {
                agent: "claude".to_string(),
                role: "coder".to_string(),
            },
        )
        .await
        .unwrap();
        (project_id, task.id)
    }

    #[tokio::test]
    async fn transition_to_running_assigned_to_running_success() {
        let pool = setup_pool().await;
        let (project_id, task_id) = setup_assigned_task(&pool).await;
        let task = transition_to_running(&pool, &project_id, &task_id)
            .await
            .unwrap();
        assert_eq!(task.status, "Running");
    }

    #[tokio::test]
    async fn transition_to_running_draft_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET status = 'Draft' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, message } => {
                assert_eq!(code, "task_not_assigned");
                assert!(message.contains("draft"), "msg: {}", message);
            }
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_ready_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET status = 'Ready' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assigned"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_running_returns_session_already_active() {
        let pool = setup_pool().await;
        let (project_id, task_id) = setup_assigned_task(&pool).await;
        transition_to_running(&pool, &project_id, &task_id)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task_id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "session_already_active"),
            _ => panic!("expected Conflict session_already_active"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_paused_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET agent = 'claude', status = 'Paused' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, message } => {
                assert_eq!(code, "task_not_assigned");
                assert!(
                    message.contains("resume"),
                    "msg should mention resume: {}",
                    message
                );
            }
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_failed_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET agent = 'claude', status = 'Failed' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, message } => {
                assert_eq!(code, "task_not_assigned");
                assert!(
                    message.contains("resume"),
                    "msg should mention resume: {}",
                    message
                );
            }
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_done_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET agent = 'claude', status = 'Done' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assigned"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_cancelled_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET agent = 'claude', status = 'Cancelled' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assigned"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_unknown_task_returns_not_found() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let err = transition_to_running(&pool, &project_id, "OMNI-999")
            .await
            .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn transition_to_running_no_agent_returns_task_not_assigned() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        // Force status=Assigned but agent=NULL (defensive test)
        sqlx::query("UPDATE tasks SET status = 'Assigned', agent = NULL WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        let err = transition_to_running(&pool, &project_id, &task.id)
            .await
            .unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assigned"),
            _ => panic!("expected Conflict for null agent"),
        }
    }

    #[tokio::test]
    async fn revert_to_assigned_running_to_assigned_success() {
        let pool = setup_pool().await;
        let (project_id, task_id) = setup_assigned_task(&pool).await;
        transition_to_running(&pool, &project_id, &task_id)
            .await
            .unwrap();
        revert_to_assigned(&pool, &task_id).await.unwrap();
        let task = get_task(&pool, &project_id, &task_id).await.unwrap();
        assert_eq!(task.status, "Assigned");
    }

    #[tokio::test]
    async fn revert_to_assigned_not_running_is_noop() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        let task = create_task(&pool, &project_id, valid_create_req("Fix", "Desc"))
            .await
            .unwrap();
        sqlx::query("UPDATE tasks SET agent = 'claude', status = 'Paused' WHERE id = ?")
            .bind(&task.id)
            .execute(&pool)
            .await
            .unwrap();
        // Should succeed without error and not change status
        revert_to_assigned(&pool, &task.id).await.unwrap();
        let updated = get_task(&pool, &project_id, &task.id).await.unwrap();
        assert_eq!(updated.status, "Paused");
    }
}
