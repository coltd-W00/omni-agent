use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::project::{CreateProjectRequest, Project};

pub async fn list_projects(pool: &SqlitePool) -> Result<Vec<Project>, AppError> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT id, name, key, created_at, updated_at FROM projects ORDER BY created_at ASC",
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
    if name.is_empty() || name.len() > 80 {
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
        len >= 2
            && len <= 8
            && chars[0].is_ascii_uppercase()
            && chars[1..].iter().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    };
    if !key_valid {
        return Err(AppError::BadRequest {
            code: "invalid_project_key",
            message: "Project key must be uppercase letters and digits, 2–8 characters"
                .to_string(),
        });
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query(
        "INSERT INTO projects (id, name, key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&req.key)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => Ok(Project {
            id,
            name,
            key: req.key,
            created_at: now.clone(),
            updated_at: now,
        }),
        Err(sqlx::Error::Database(db_err))
            if db_err
                .message()
                .contains("UNIQUE constraint failed: projects.key") =>
        {
            Err(AppError::Conflict {
                code: "project_key_taken",
                message: "Project key already in use".to_string(),
            })
        }
        Err(e) => Err(AppError::Internal(anyhow::anyhow!(e))),
    }
}

pub async fn delete_project(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // Check project exists
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
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
        .fetch_one(pool)
        .await?;
    if task_count > 0 {
        return Err(AppError::Conflict {
            code: "project_has_tasks",
            message: "Cannot delete project with existing tasks".to_string(),
        });
    }

    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
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
            },
        )
        .await
        .unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_project_name"),
            _ => panic!("Expected BadRequest for long name"),
        }
    }

    #[tokio::test]
    async fn create_project_rejects_duplicate_key() {
        let pool = setup_pool().await;
        let req1 = CreateProjectRequest {
            name: "First".to_string(),
            key: "OMNI".to_string(),
        };
        create_project(&pool, req1).await.unwrap();

        let req2 = CreateProjectRequest {
            name: "Second".to_string(),
            key: "OMNI".to_string(),
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
            },
        )
        .await
        .unwrap();

        delete_project(&pool, &project.id).await.unwrap();

        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
                .bind(&project.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn delete_project_with_tasks_blocked() {
        let pool = setup_pool().await;
        let project = create_project(
            &pool,
            CreateProjectRequest {
                name: "Test".to_string(),
                key: "BLCK".to_string(),
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

        let err = delete_project(&pool, &project.id).await.unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "project_has_tasks"),
            _ => panic!("Expected Conflict"),
        }

        // Project still exists
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE id = ?")
                .bind(&project.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn delete_project_not_found() {
        let pool = setup_pool().await;
        let err = delete_project(&pool, "nonexistent-id").await.unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "project_not_found"),
            _ => panic!("Expected NotFound"),
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
