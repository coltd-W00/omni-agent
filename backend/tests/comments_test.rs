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

async fn build_comments_app() -> (Router, Arc<AppState>) {
    let pool = SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();
    db::run_migrations(&pool).await.unwrap();

    let state = Arc::new(AppState {
        db: pool,
        subprocess_map: Arc::new(Mutex::new(HashMap::new())),
        agent_config_path: std::env::temp_dir()
            .join(format!("omni-agent-test-{}.json", uuid::Uuid::new_v4())),
    });

    let api_router = Router::new()
        .route(
            "/projects",
            get(handlers::projects::list_projects).post(handlers::projects::create_project),
        )
        .route(
            "/projects/{project_id}/tasks",
            get(handlers::tasks::list_tasks).post(handlers::tasks::create_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}",
            get(handlers::tasks::get_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/comments",
            get(handlers::comments::list_comments).post(handlers::comments::add_comment),
        );

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(state.clone());

    (app, state)
}

async fn body_json(body: Body) -> Value {
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice(&bytes).unwrap()
}

async fn seed_project_task(pool: &SqlitePool) -> (String, String) {
    let now = "2026-05-25T10:00:00+00:00";
    let project_id = "proj-1".to_string();
    let task_id = "OMNI-001".to_string();

    sqlx::query(
        "INSERT INTO projects (id, key, name, created_at, updated_at) VALUES (?, 'OMNI', 'Omni', ?, ?)",
    )
    .bind(&project_id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
         VALUES (?, ?, 1, 'Task', 'Desc', 'Paused', ?, ?)",
    )
    .bind(&task_id)
    .bind(&project_id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .unwrap();

    (project_id, task_id)
}

async fn seed_comment(
    pool: &SqlitePool,
    id: &str,
    task_id: &str,
    content: &str,
    sent: i64,
    created_at: &str,
) {
    sqlx::query(
        "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(task_id)
    .bind(content)
    .bind(sent)
    .bind(created_at)
    .execute(pool)
    .await
    .unwrap();
}

async fn get_json(app: &Router, uri: String) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("GET")
        .uri(uri)
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;
    (status, body)
}

#[tokio::test]
async fn list_comments_returns_200_with_chronological_order() {
    let (app, state) = build_comments_app().await;
    let (project_id, task_id) = seed_project_task(&state.db).await;
    seed_comment(
        &state.db,
        "c2",
        &task_id,
        "Second",
        0,
        "2026-05-25T10:05:00+00:00",
    )
    .await;
    seed_comment(
        &state.db,
        "c1",
        &task_id,
        "First",
        1,
        "2026-05-25T10:00:00+00:00",
    )
    .await;
    seed_comment(
        &state.db,
        "c3",
        &task_id,
        "Third",
        1,
        "2026-05-25T10:10:00+00:00",
    )
    .await;

    let (status, body) = get_json(
        &app,
        format!("/api/projects/{project_id}/tasks/{task_id}/comments"),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "body: {body}");
    let items = body.as_array().unwrap();
    assert_eq!(items.len(), 3);
    assert_eq!(items[0]["id"], "c1");
    assert_eq!(items[1]["id"], "c2");
    assert_eq!(items[2]["id"], "c3");
    for key in ["id", "taskId", "content", "sent", "createdAt"] {
        assert!(items[0].get(key).is_some(), "missing key {key}: {body}");
    }
    assert!(items[0]["sent"].is_boolean());
    assert!(items[0].get("task_id").is_none());
}

#[tokio::test]
async fn list_comments_returns_empty_array_when_no_comments() {
    let (app, state) = build_comments_app().await;
    let (project_id, task_id) = seed_project_task(&state.db).await;

    let (status, body) = get_json(
        &app,
        format!("/api/projects/{project_id}/tasks/{task_id}/comments"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn list_comments_returns_404_when_project_not_found() {
    let (app, _) = build_comments_app().await;

    let (status, body) = get_json(
        &app,
        "/api/projects/missing/tasks/OMNI-001/comments".to_string(),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "project_not_found");
    assert_eq!(body["message"], "Project missing not found");
}

#[tokio::test]
async fn list_comments_returns_404_when_task_not_found() {
    let (app, state) = build_comments_app().await;
    let (project_id, _) = seed_project_task(&state.db).await;

    let (status, body) = get_json(
        &app,
        format!("/api/projects/{project_id}/tasks/OMNI-999/comments"),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "task_not_found");
    assert_eq!(body["message"], "Task OMNI-999 not found");
}

#[tokio::test]
async fn list_comments_returns_correct_sent_boolean_serialization() {
    let (app, state) = build_comments_app().await;
    let (project_id, task_id) = seed_project_task(&state.db).await;
    seed_comment(
        &state.db,
        "sent",
        &task_id,
        "Sent",
        1,
        "2026-05-25T10:00:00+00:00",
    )
    .await;
    seed_comment(
        &state.db,
        "pending",
        &task_id,
        "Pending",
        0,
        "2026-05-25T10:01:00+00:00",
    )
    .await;

    let (status, body) = get_json(
        &app,
        format!("/api/projects/{project_id}/tasks/{task_id}/comments"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = body.as_array().unwrap();
    assert_eq!(items[0]["sent"], Value::Bool(true));
    assert_eq!(items[1]["sent"], Value::Bool(false));
}

#[tokio::test]
async fn add_comment_still_works_after_route_refactor() {
    let (app, state) = build_comments_app().await;
    let (project_id, task_id) = seed_project_task(&state.db).await;
    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{project_id}/tasks/{task_id}/comments"
        ))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"content":"test"}"#))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::CREATED, "body: {body}");
    assert_eq!(body["content"], "test");
    assert_eq!(body["sent"], false);
}

#[tokio::test]
async fn list_comments_excludes_other_tasks() {
    let (app, state) = build_comments_app().await;
    let (project_id, task_id) = seed_project_task(&state.db).await;
    let now = "2026-05-25T10:00:00+00:00";
    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
         VALUES ('OMNI-002', ?, 2, 'Other', 'Desc', 'Paused', ?, ?)",
    )
    .bind(&project_id)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await
    .unwrap();
    seed_comment(
        &state.db,
        "c1",
        &task_id,
        "Task one",
        0,
        "2026-05-25T10:00:00+00:00",
    )
    .await;
    seed_comment(
        &state.db,
        "c2",
        "OMNI-002",
        "Task two",
        0,
        "2026-05-25T10:01:00+00:00",
    )
    .await;

    let (status, body) = get_json(
        &app,
        format!("/api/projects/{project_id}/tasks/{task_id}/comments"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = body.as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["content"], "Task one");
}
