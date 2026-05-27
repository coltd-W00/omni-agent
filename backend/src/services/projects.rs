use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::project::{CreateProjectRequest, Project, UpdateProjectRequest};

pub async fn list_projects(pool: &SqlitePool) -> Result<Vec<Project>, AppError> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT id, name, key, workspace_path, created_at, updated_at FROM projects ORDER BY created_at ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(projects)
}

pub async fn create_project(
    pool: &SqlitePool,
    req: CreateProjectRequest,
) -> Result<Project, AppError> {
    // Validate name
    let name = req.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(AppError::BadRequest {
            code: "invalid_project_name",
            message: "Project name must be 1–80 characters".to_string(),
        });
    }

    // Validate key manually (avoid regex crate): ^[A-Z][A-Z0-9]{1,7}$
    let key = req.key.as_str();
    let key_valid = {
        let chars: Vec<char> = key.chars().collect();
        let len = chars.len();
        (2..=8).contains(&len)
            && chars[0].is_ascii_uppercase()
            && chars[1..]
                .iter()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    };
    if !key_valid {
        return Err(AppError::BadRequest {
            code: "invalid_project_key",
            message: "Project key must be uppercase letters and digits, 2–8 characters".to_string(),
        });
    }

    let workspace_path = validate_workspace_path(req.workspace_path.as_deref())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query(
        "INSERT INTO projects (id, name, key, workspace_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&req.key)
    .bind(&workspace_path)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => Ok(Project {
            id,
            name,
            key: req.key,
            workspace_path: Some(workspace_path),
            created_at: now.clone(),
            updated_at: now,
        }),
        Err(sqlx::Error::Database(db_err)) if is_unique_project_key_error(db_err.as_ref()) => {
            Err(AppError::Conflict {
                code: "project_key_taken",
                message: "Project key already in use".to_string(),
            })
        }
        Err(e) => Err(AppError::Internal(anyhow::anyhow!(e))),
    }
}

pub fn validate_workspace_path(value: Option<&str>) -> Result<String, AppError> {
    let workspace_path = value.map(str::trim).unwrap_or_default();
    if workspace_path.is_empty() {
        return Err(invalid_workspace_path());
    }

    let path = std::path::Path::new(workspace_path);
    if !path.is_absolute() {
        return Err(invalid_workspace_path());
    }

    let metadata = std::fs::metadata(path).map_err(|_| invalid_workspace_path())?;
    if !metadata.is_dir() {
        return Err(invalid_workspace_path());
    }

    std::fs::read_dir(path).map_err(|_| invalid_workspace_path())?;
    Ok(workspace_path.to_string())
}

pub async fn update_project(
    pool: &SqlitePool,
    id: &str,
    req: UpdateProjectRequest,
) -> Result<Project, AppError> {
    let name = validate_project_name(&req.name)?;
    let workspace_path = validate_workspace_path(req.workspace_path.as_deref())?;
    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query(
        "UPDATE projects SET name = ?, workspace_path = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&workspace_path)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} does not exist", id),
        });
    }

    get_project(pool, id).await
}

pub async fn workspace_path_for_run(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<String, AppError> {
    let workspace_path =
        sqlx::query_scalar::<_, Option<String>>("SELECT workspace_path FROM projects WHERE id = ?")
            .bind(project_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound {
                code: "project_not_found",
                message: format!("Project {} does not exist", project_id),
            })?;

    let workspace_path = workspace_path.ok_or_else(|| AppError::Conflict {
        code: "project_workspace_missing",
        message: "Project workspace is missing".to_string(),
    })?;

    validate_workspace_path(Some(&workspace_path)).map_err(|_| AppError::Conflict {
        code: "project_workspace_missing",
        message: "Project workspace is missing or inaccessible".to_string(),
    })
}

pub async fn list_project_task_ids(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<Vec<String>, AppError> {
    let ids = sqlx::query_scalar::<_, String>("SELECT id FROM tasks WHERE project_id = ?")
        .bind(project_id)
        .fetch_all(pool)
        .await?;
    Ok(ids)
}

fn invalid_workspace_path() -> AppError {
    AppError::BadRequest {
        code: "invalid_workspace_path",
        message: "Workspace path must be an absolute existing readable directory".to_string(),
    }
}

pub async fn delete_project(pool: &SqlitePool, id: &str, force: bool) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    // Check project exists
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    if count == 0 {
        return Err(AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} does not exist", id),
        });
    }

    // Check for tasks
    let task_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE project_id = ?")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    if task_count > 0 && !force {
        return Err(AppError::Conflict {
            code: "project_has_tasks",
            message: "Cannot delete project with existing tasks".to_string(),
        });
    }

    if force {
        sqlx::query(
            "DELETE FROM runs WHERE session_id IN (SELECT id FROM sessions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?))",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "DELETE FROM sessions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM tasks WHERE project_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

fn validate_project_name(value: &str) -> Result<String, AppError> {
    let name = value.trim().to_string();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(AppError::BadRequest {
            code: "invalid_project_name",
            message: "Project name must be 1–80 characters".to_string(),
        });
    }
    Ok(name)
}

async fn get_project(pool: &SqlitePool, id: &str) -> Result<Project, AppError> {
    sqlx::query_as::<_, Project>(
        "SELECT id, name, key, workspace_path, created_at, updated_at FROM projects WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound {
        code: "project_not_found",
        message: format!("Project {} does not exist", id),
    })
}

fn is_unique_project_key_error(db_err: &dyn sqlx::error::DatabaseError) -> bool {
    db_err.code().as_deref() == Some("2067")
        || db_err
            .constraint()
            .is_some_and(|constraint| constraint == "projects.key" || constraint == "key")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;

    async fn setup_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn create_project_inserts_row() {
        let pool = setup_pool().await;
        let req = CreateProjectRequest {
            name: "OmniAgent Core".to_string(),
            key: "OMNI".to_string(),
            workspace_path: Some("/tmp".to_string()),
        };
        let project = create_project(&pool, req).await.unwrap();
        assert_eq!(project.name, "OmniAgent Core");
        assert_eq!(project.key, "OMNI");
        assert!(!project.id.is_empty());
        assert!(!project.created_at.is_empty());
    }

    #[tokio::test]
    async fn create_project_rejects_invalid_key() {
        let pool = setup_pool().await;
        let invalid_keys = vec!["omni", "OMNI 1", "O", "OM-NI", "TOOLONG12", ""];
        for key in invalid_keys {
            let req = CreateProjectRequest {
                name: "Test".to_string(),
                key: key.to_string(),
                workspace_path: Some("/tmp".to_string()),
            };
            let err = create_project(&pool, req).await.unwrap_err();
            match err {
                AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_project_key"),
                _ => panic!("Expected BadRequest for key '{}'", key),
            }
        }
    }

    #[tokio::test]
    async fn create_project_rejects_invalid_name() {
        let pool = setup_pool().await;

        // Empty name
        let err = create_project(
            &pool,
            CreateProjectRequest {
                name: "".to_string(),
                key: "TEST".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_project_name"),
            _ => panic!("Expected BadRequest for empty name"),
        }

        // Name 81 chars
        let long_name = "a".repeat(81);
        let err = create_project(
            &pool,
            CreateProjectRequest {
                name: long_name,
                key: "TEST".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_project_name"),
            _ => panic!("Expected BadRequest for long name"),
        }

        // 80 Unicode scalar values must be accepted even when UTF-8 byte length is >80.
        let unicode_name = "ầ".repeat(80);
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: unicode_name.clone(),
                key: "UNICODE".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();
        assert_eq!(project.name, unicode_name);
    }

    #[tokio::test]
    async fn create_project_rejects_duplicate_key() {
        let pool = setup_pool().await;
        let req1 = CreateProjectRequest {
            name: "First".to_string(),
            key: "OMNI".to_string(),
            workspace_path: Some("/tmp".to_string()),
        };
        create_project(&pool, req1).await.unwrap();

        let req2 = CreateProjectRequest {
            name: "Second".to_string(),
            key: "OMNI".to_string(),
            workspace_path: Some("/tmp".to_string()),
        };
        let err = create_project(&pool, req2).await.unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "project_key_taken"),
            _ => panic!("Expected Conflict"),
        }
    }

    #[tokio::test]
    async fn delete_project_empty_succeeds() {
        let pool = setup_pool().await;
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: "Test".to_string(),
                key: "TEST".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();

        delete_project(&pool, &project.id, false).await.unwrap();

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
            .bind(&project.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn delete_project_with_tasks_blocked_without_force() {
        let pool = setup_pool().await;
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: "Test".to_string(),
                key: "BLCK".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();

        // Insert a dummy task
        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("task-1")
        .bind(&project.id)
        .bind(1i64)
        .bind("title")
        .bind("desc")
        .bind("Draft")
        .bind("2026-01-01T00:00:00Z")
        .bind("2026-01-01T00:00:00Z")
        .execute(&pool)
        .await
        .unwrap();

        let err = delete_project(&pool, &project.id, false).await.unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "project_has_tasks"),
            _ => panic!("Expected Conflict"),
        }

        // Project still exists
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
            .bind(&project.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn delete_project_not_found() {
        let pool = setup_pool().await;
        let err = delete_project(&pool, "nonexistent-id", false)
            .await
            .unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "project_not_found"),
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn update_project_changes_name_and_workspace_only() {
        let pool = setup_pool().await;
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: "Old".to_string(),
                key: "EDIT".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();

        let updated = update_project(
            &pool,
            &project.id,
            UpdateProjectRequest {
                name: "New Name".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();

        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.key, "EDIT");
        assert_eq!(updated.workspace_path.as_deref(), Some("/tmp"));
        assert_ne!(updated.updated_at, "");
    }

    #[tokio::test]
    async fn delete_project_with_tasks_force_deletes_related_rows() {
        let pool = setup_pool().await;
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: "Test".to_string(),
                key: "FORC".to_string(),
                workspace_path: Some("/tmp".to_string()),
            },
        )
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("FORC-001")
        .bind(&project.id)
        .bind(1i64)
        .bind("title")
        .bind("desc")
        .bind("Draft")
        .bind("2026-01-01T00:00:00Z")
        .bind("2026-01-01T00:00:00Z")
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO sessions (id, task_id, agent, status, created_at, last_active) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("session-1")
        .bind("FORC-001")
        .bind("codex")
        .bind("none")
        .bind("2026-01-01T00:00:00Z")
        .bind("2026-01-01T00:00:00Z")
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO runs (id, session_id, run_number, started_at) VALUES (?, ?, ?, ?)",
        )
        .bind("run-1")
        .bind("session-1")
        .bind(1i64)
        .bind("2026-01-01T00:00:00Z")
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind("comment-1")
        .bind("FORC-001")
        .bind("content")
        .bind(0i64)
        .bind("2026-01-01T00:00:00Z")
        .execute(&pool)
        .await
        .unwrap();

        delete_project(&pool, &project.id, true).await.unwrap();

        for table in ["projects", "tasks", "sessions", "runs", "comments"] {
            let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count, 0, "{table} should be empty");
        }
    }

    #[tokio::test]
    async fn list_projects_orders_by_created_at() {
        let pool = setup_pool().await;
        // Insert with explicit timestamps to ensure order
        let projects_data = vec![
            ("proj-1", "Alpha", "ALPH", "2026-01-01T00:00:00Z"),
            ("proj-2", "Beta", "BETA", "2026-01-02T00:00:00Z"),
            ("proj-3", "Gamma", "GAMM", "2026-01-03T00:00:00Z"),
        ];
        for (id, name, key, ts) in &projects_data {
            sqlx::query(
                "INSERT INTO projects (id, name, key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(id)
            .bind(name)
            .bind(key)
            .bind(ts)
            .bind(ts)
            .execute(&pool)
            .await
            .unwrap();
        }

        let result = list_projects(&pool).await.unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].key, "ALPH");
        assert_eq!(result[1].key, "BETA");
        assert_eq!(result[2].key, "GAMM");
    }
}
