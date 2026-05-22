use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::task::{AssignAgentRequest, CreateTaskRequest, Task, UpdateTaskRequest};

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

    // Validate acceptance_criteria (optional)
    let acceptance_criteria = req.acceptance_criteria.map(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    }).flatten();

    if let Some(ref ac) = acceptance_criteria {
        if ac.chars().count() > 5000 {
            return Err(AppError::BadRequest {
                code: "invalid_task_acceptance_criteria",
                message: "Acceptance criteria must be at most 5000 characters".to_string(),
            });
        }
    }

    // Verify project exists + get key
    let project_key = sqlx::query_scalar::<_, String>("SELECT key FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound {
            code: "project_not_found",
            message: format!("Project {} does not exist", project_id),
        })?;

    // Race-safe seq + id generation in a single transaction
    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;

    let seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE project_id = ?",
    )
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
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'Draft', ?, ?)",
    )
    .bind(&task_id)
    .bind(project_id)
    .bind(seq)
    .bind(&title)
    .bind(&description)
    .bind(&acceptance_criteria)
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
        agent: None,
        role: None,
        status: "Draft".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
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

    sqlx::query(
        "UPDATE tasks SET title = ?, description = ?, acceptance_criteria = ?, updated_at = ? \
         WHERE id = ? AND project_id = ?",
    )
    .bind(&new_title)
    .bind(&new_description)
    .bind(&new_ac)
    .bind(&now)
    .bind(task_id)
    .bind(project_id)
    .execute(pool)
    .await?;

    Ok(Task {
        id: existing.id,
        project_id: existing.project_id,
        seq: existing.seq,
        title: new_title,
        description: new_description,
        acceptance_criteria: new_ac,
        agent: existing.agent,
        role: existing.role,
        status: existing.status,
        created_at: existing.created_at,
        updated_at: now,
    })
}

pub async fn assign_agent(
    pool: &SqlitePool,
    project_id: &str,
    task_id: &str,
    req: AssignAgentRequest,
) -> Result<Task, AppError> {
    // Validate agent
    if !VALID_AGENTS.contains(&req.agent.as_str()) {
        return Err(AppError::BadRequest {
            code: "invalid_agent",
            message: "Agent must be one of: codex, claude".to_string(),
        });
    }

    // Validate role
    if !VALID_ROLES.contains(&req.role.as_str()) {
        return Err(AppError::BadRequest {
            code: "invalid_role",
            message: "Role must be one of: coder, reviewer, planner, debugger, refactorer"
                .to_string(),
        });
    }

    let existing = get_task(pool, project_id, task_id).await?;

    let status_lower = existing.status.to_lowercase();
    if status_lower != "draft" && status_lower != "ready" {
        return Err(AppError::Conflict {
            code: "task_not_assignable",
            message: format!(
                "Cannot assign agent to task in {} status",
                status_lower
            ),
        });
    }

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE tasks SET agent = ?, role = ?, status = 'Assigned', updated_at = ? \
         WHERE id = ? AND project_id = ?",
    )
    .bind(&req.agent)
    .bind(&req.role)
    .bind(&now)
    .bind(task_id)
    .bind(project_id)
    .execute(pool)
    .await?;

    Ok(Task {
        id: existing.id,
        project_id: existing.project_id,
        seq: existing.seq,
        title: existing.title,
        description: existing.description,
        acceptance_criteria: existing.acceptance_criteria,
        agent: Some(req.agent),
        role: Some(req.role),
        status: "Assigned".to_string(),
        created_at: existing.created_at,
        updated_at: now,
    })
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

    sqlx::query("DELETE FROM tasks WHERE id = ? AND project_id = ?")
        .bind(task_id)
        .bind(project_id)
        .execute(pool)
        .await?;

    Ok(())
}

// Helper: verify project exists
async fn verify_project_exists(pool: &SqlitePool, project_id: &str) -> Result<(), AppError> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use crate::services::projects::create_project;
    use crate::models::project::CreateProjectRequest;

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
        }
    }

    #[tokio::test]
    async fn create_task_inserts_row() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "OmniAgent Core").await;

        let task = create_task(&pool, &project_id, valid_create_req("Fix login", "Token broken"))
            .await
            .unwrap();

        assert_eq!(task.id, "OMNI-001");
        assert_eq!(task.seq, 1);
        assert_eq!(task.status, "Draft");
        assert!(task.agent.is_none());
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
        };
        let err = create_task(&pool, &project_id, req_missing).await.unwrap_err();
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

        create_task(&pool, &project_id, valid_create_req("T1", "D1")).await.unwrap();
        create_task(&pool, &project_id, valid_create_req("T2", "D2")).await.unwrap();
        create_task(&pool, &project_id, valid_create_req("T3", "D3")).await.unwrap();

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
        create_task(&pool, &project_id, valid_create_req("My Task", "Desc")).await.unwrap();

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

        create_task(&pool, &omni_id, valid_create_req("Task", "Desc")).await.unwrap();

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
        create_task(&pool, &project_id, valid_create_req("Old Title", "Old Desc")).await.unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("New Title".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", req).await.unwrap();

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
        };
        create_task(&pool, &project_id, req).await.unwrap();

        let update_req = UpdateTaskRequest {
            title: None,
            description: None,
            acceptance_criteria: Some(None), // set to null
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", update_req).await.unwrap();
        assert!(updated.acceptance_criteria.is_none());
    }

    #[tokio::test]
    async fn update_task_set_ac_empty_string_normalizes_to_null() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

        let req = UpdateTaskRequest {
            title: None,
            description: None,
            acceptance_criteria: Some(Some("".to_string())),
        };
        let updated = update_task(&pool, &project_id, "OMNI-001", req).await.unwrap();
        assert!(updated.acceptance_criteria.is_none());
    }

    #[tokio::test]
    async fn update_task_rejects_empty_title() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

        let req = UpdateTaskRequest {
            title: Some(Some("".to_string())),
            description: None,
            acceptance_criteria: None,
        };
        let err = update_task(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
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
        let err = update_task(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
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
        let err = update_task(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
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
        let err = update_task(&pool, &project_id, "OMNI-999", req).await.unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }

    #[tokio::test]
    async fn assign_agent_happy_path() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "coder".to_string(),
        };
        let task = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap();
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
        let task = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap();
        assert_eq!(task.status, "Assigned");
    }

    #[tokio::test]
    async fn assign_agent_rejects_invalid_agent() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

        let req = AssignAgentRequest {
            agent: "gemini".to_string(),
            role: "coder".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_agent"),
            _ => panic!("expected BadRequest"),
        }
    }

    #[tokio::test]
    async fn assign_agent_rejects_invalid_role() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

        let req = AssignAgentRequest {
            agent: "claude".to_string(),
            role: "manager".to_string(),
        };
        let err = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
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
        let err = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
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
        let err = assign_agent(&pool, &project_id, "OMNI-001", req).await.unwrap_err();
        match err {
            AppError::Conflict { code, .. } => assert_eq!(code, "task_not_assignable"),
            _ => panic!("expected Conflict"),
        }
    }

    #[tokio::test]
    async fn delete_task_draft_succeeds() {
        let pool = setup_pool().await;
        let project_id = insert_test_project(&pool, "OMNI", "Test").await;
        create_task(&pool, &project_id, valid_create_req("T", "D")).await.unwrap();

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

        for status in &["Ready", "Assigned", "Done"] {
            // Insert task with given status
            let task_id = format!("OMNI-{}", status);
            sqlx::query(
                "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
                 VALUES (?, ?, 1, 'T', 'D', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
            .bind(&task_id)
            .bind(&project_id)
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
        let err = delete_task(&pool, &project_id, "OMNI-999").await.unwrap_err();
        match err {
            AppError::NotFound { code, .. } => assert_eq!(code, "task_not_found"),
            _ => panic!("expected NotFound"),
        }
    }
}
