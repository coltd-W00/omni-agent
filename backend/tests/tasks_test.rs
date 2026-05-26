use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use axum::{
    Json, Router,
    body::Body,
    http::{Request, StatusCode},
    response::IntoResponse,
    routing::get,
};
use serde_json::Value;
use sqlx::SqlitePool;
use tokio::sync::Mutex;
use tower::ServiceExt;

use omni_agent_backend::{db, error::AppError, handlers, state::AppState};

async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok"}))
}

async fn fallback_handler() -> impl IntoResponse {
    AppError::NotFound {
        code: "not_found",
        message: "Route not found".to_string(),
    }
}

async fn build_test_app_with_pool() -> (Router, SqlitePool) {
    let pool = SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();

    db::run_migrations(&pool).await.unwrap();

    let state = AppState {
        db: pool.clone(),
        subprocess_map: Arc::new(Mutex::new(HashMap::new())),
        agent_config_path: std::env::temp_dir()
            .join(format!("omni-agent-test-{}.json", uuid::Uuid::new_v4())),
    };

    let api_router = Router::new()
        .route(
            "/projects",
            get(handlers::projects::list_projects).post(handlers::projects::create_project),
        )
        .route(
            "/projects/{id}",
            axum::routing::delete(handlers::projects::delete_project),
        )
        .route(
            "/projects/{project_id}/tasks",
            get(handlers::tasks::list_tasks).post(handlers::tasks::create_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}",
            get(handlers::tasks::get_task)
                .put(handlers::tasks::update_task)
                .delete(handlers::tasks::delete_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/assign",
            axum::routing::post(handlers::tasks::assign_agent),
        );

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(Arc::new(state));

    (app, pool)
}

async fn build_test_app() -> Router {
    let (app, _) = build_test_app_with_pool().await;
    app
}

async fn body_json(body: Body) -> Value {
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

/// Creates a project and returns (app, project_id)
async fn setup_app_with_project(key: &str, name: &str) -> (Router, String) {
    let app = build_test_app().await;

    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"name": name, "key": key}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res.into_body()).await;
    let project_id = body["id"].as_str().unwrap().to_string();

    (app, project_id)
}

/// Creates a project and returns (app, pool, project_id) — pool for direct SQL inserts in tests.
async fn setup_app_with_project_and_pool(key: &str, name: &str) -> (Router, SqlitePool, String) {
    let (app, pool) = build_test_app_with_pool().await;

    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"name": name, "key": key}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res.into_body()).await;
    let project_id = body["id"].as_str().unwrap().to_string();

    (app, pool, project_id)
}

// ─── POST /api/projects/{id}/tasks ───────────────────────────────────────────

#[tokio::test]
async fn post_task_happy_path() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent Core").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"title":"Fix login redirect","description":"Token refresh broken"}"#,
        ))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = body_json(res.into_body()).await;
    assert_eq!(body["id"], "OMNI-001");
    assert_eq!(body["status"], "draft");
    assert_eq!(body["seq"], 1);
    assert!(body["agent"].is_null());
    assert!(body["role"].is_null());
    assert!(body["acceptanceCriteria"].is_null());
    assert!(!body["createdAt"].as_str().unwrap_or("").is_empty());
}

#[tokio::test]
async fn post_task_validates_title() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"","description":"desc"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "invalid_task_title");
}

#[tokio::test]
async fn post_task_validates_description() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"A title","description":""}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "invalid_task_description");
}

#[tokio::test]
async fn post_task_project_not_found() {
    let app = build_test_app().await;
    let fake_id = "00000000-0000-0000-0000-000000000000";

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", fake_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "project_not_found");
}

// ─── GET /api/projects/{id}/tasks ────────────────────────────────────────────

#[tokio::test]
async fn get_tasks_list_ordered() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    for i in 1..=3 {
        let req = Request::builder()
            .method("POST")
            .uri(format!("/api/projects/{}/tasks", project_id))
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({"title": format!("Task {}", i), "description": "Desc"})
                    .to_string(),
            ))
            .unwrap();
        app.clone().oneshot(req).await.unwrap();
    }

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    let tasks = body.as_array().unwrap();
    assert_eq!(tasks.len(), 3);
    assert_eq!(tasks[0]["seq"], 1);
    assert_eq!(tasks[1]["seq"], 2);
    assert_eq!(tasks[2]["seq"], 3);
}

#[tokio::test]
async fn get_tasks_empty() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body.as_array().unwrap().len(), 0);
}

// ─── GET /api/projects/{id}/tasks/{taskId} ───────────────────────────────────

#[tokio::test]
async fn get_task_single() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"Fix login","description":"Desc"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["id"], "OMNI-001");
    assert_eq!(body["title"], "Fix login");
}

#[tokio::test]
async fn get_task_not_found() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/OMNI-999", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_not_found");
}

#[tokio::test]
async fn get_task_wrong_project() {
    let (app, omni_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    // Create task in OMNI
    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", omni_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    // Create another project ERP
    let erp_req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"ERP Project","key":"ERP"}"#))
        .unwrap();
    let erp_res = app.clone().oneshot(erp_req).await.unwrap();
    let erp_body = body_json(erp_res.into_body()).await;
    let erp_id = erp_body["id"].as_str().unwrap();

    // Access OMNI-001 through ERP project → 404
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", erp_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_not_found");
}

// ─── PUT /api/projects/{id}/tasks/{taskId} ───────────────────────────────────

#[tokio::test]
async fn put_task_partial_update() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"title":"Old Title","description":"Old Desc"}"#,
        ))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"New Title"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["title"], "New Title");
    assert_eq!(body["description"], "Old Desc"); // unchanged
}

#[tokio::test]
async fn put_task_locks_when_done() {
    // F8 fix: This test now correctly verifies PUT 409 when task status = Done,
    // using direct SQL insert to set up the test state (bypassing the service layer).
    let (app, pool, project_id) = setup_app_with_project_and_pool("OMNI", "OmniAgent").await;

    // Insert a Done task directly into DB to set up the test state
    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
         VALUES ('OMNI-001', ?, 1, 'T', 'D', 'Done', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
    )
    .bind(&project_id)
    .execute(&pool)
    .await
    .unwrap();

    // PUT should be blocked with 409 task_locked (Done status)
    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"New Title"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_locked");
    assert!(
        body["message"].as_str().unwrap().contains("done"),
        "message should mention 'done', got: {}",
        body["message"]
    );
}

// ─── POST /api/projects/{id}/tasks/{taskId}/assign ────────────────────────────

#[tokio::test]
async fn assign_agent_happy_path() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/OMNI-001/assign",
            project_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"agent":"claude","role":"coder"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["status"], "assigned");
    assert_eq!(body["agent"], "claude");
    assert_eq!(body["role"], "coder");
}

#[tokio::test]
async fn assign_agent_invalid_agent() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/OMNI-001/assign",
            project_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"agent":"gemini","role":"coder"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "invalid_agent");
}

#[tokio::test]
async fn assign_agent_when_running() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    // Create task then assign to get it to Assigned, then we need Running
    // For this integration test, let's test assign_agent when task is already Assigned
    // (since we can assign draft → assigned via API, then assigned is not draft/ready → not assignable)
    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    // First assign (Draft → Assigned)
    let assign_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/OMNI-001/assign",
            project_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"agent":"claude","role":"coder"}"#))
        .unwrap();
    app.clone().oneshot(assign_req).await.unwrap();

    // Second assign attempt (Assigned → not assignable)
    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/OMNI-001/assign",
            project_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"agent":"codex","role":"reviewer"}"#))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_not_assignable");
}

// ─── DELETE /api/projects/{id}/tasks/{taskId} ─────────────────────────────────

#[tokio::test]
async fn delete_task_draft() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn delete_task_non_draft_blocked() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let create_req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"T","description":"D"}"#))
        .unwrap();
    app.clone().oneshot(create_req).await.unwrap();

    // Assign → Assigned (not Draft)
    let assign_req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/OMNI-001/assign",
            project_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"agent":"claude","role":"coder"}"#))
        .unwrap();
    app.clone().oneshot(assign_req).await.unwrap();

    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/projects/{}/tasks/OMNI-001", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_not_deletable");
}

#[tokio::test]
async fn delete_task_not_found() {
    let (app, project_id) = setup_app_with_project("OMNI", "OmniAgent").await;

    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/projects/{}/tasks/OMNI-999", project_id))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["error"], "task_not_found");
}

// ─── Regression guards (AC-14) ───────────────────────────────────────────────

#[tokio::test]
async fn health_still_200_after_task_routes_mounted() {
    let app = build_test_app().await;

    let req = Request::builder()
        .method("GET")
        .uri("/health")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn projects_list_still_works() {
    let app = build_test_app().await;

    let req = Request::builder()
        .method("GET")
        .uri("/api/projects")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res.into_body()).await;
    assert!(body.is_array());
}
