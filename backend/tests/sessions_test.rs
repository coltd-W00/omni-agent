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
use serial_test::serial;
use sqlx::{Row, SqlitePool};
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

/// Build a test app with full sessions route + return (Router, Arc<AppState>).
async fn build_sessions_app() -> (Router, Arc<AppState>) {
    let pool = SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();
    db::run_migrations(&pool).await.unwrap();

    let state = Arc::new(AppState {
        db: pool.clone(),
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
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/start",
            axum::routing::post(handlers::sessions::start_session),
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
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

fn mock_bin() -> String {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    format!("{}/tests/fixtures/mock-agent.sh", manifest)
}

/// Create project, task, and assign agent; returns (project_id, task_id).
async fn setup_assigned_task(app: &Router, agent: &str) -> (String, String) {
    // Create project
    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"name": "OmniAgent", "key": "OMNI"}).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let body = body_json(res.into_body()).await;
    let project_id = body["id"].as_str().unwrap().to_string();

    // Create task
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(
            r#"{"title":"Fix login","description":"Token broken"}"#,
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let body = body_json(res.into_body()).await;
    let task_id = body["id"].as_str().unwrap().to_string();

    // Assign agent
    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/assign",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"agent": agent, "role": "coder"}).to_string(),
        ))
        .unwrap();
    app.clone().oneshot(req).await.unwrap();

    (project_id, task_id)
}

async fn start_session(app: &Router, project_id: &str, task_id: &str) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/start",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;
    (status, body)
}

async fn drain_subprocesses(state: &Arc<AppState>) {
    let mut map = state.subprocess_map.lock().await;
    for (_, mut child) in map.drain() {
        let _ = child.start_kill();
    }
}

// ─── Happy path tests ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn start_session_claude_happy_path() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-home-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "test-uuid-aaa");
        std::env::set_var("MOCK_AGENT_DELAY_MS", "50");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK, "body: {}", body);

    assert!(body["sessionPk"].is_string());
    assert_eq!(body["taskId"], task_id);
    assert!(body["sessionId"].is_null());
    assert_eq!(body["sessionIdMissing"], false);
    assert_eq!(body["status"], "running");
    assert!(body["createdAt"].is_string());

    // Allow background task to capture session ID
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Verify task is now running
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "running");

    // Verify session in DB
    let session_pk = body["sessionPk"].as_str().unwrap();
    let session_row = sqlx::query("SELECT session_id, status, agent FROM sessions WHERE id = ?")
        .bind(session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(session_row.try_get::<String, _>("agent").unwrap(), "claude");
    assert_eq!(
        session_row.try_get::<String, _>("status").unwrap(),
        "running"
    );
    assert_eq!(
        session_row
            .try_get::<Option<String>, _>("session_id")
            .unwrap()
            .as_deref(),
        Some("test-uuid-aaa")
    );

    // Verify run row
    let run_row =
        sqlx::query("SELECT run_number, log_path, exit_code FROM runs WHERE session_id = ?")
            .bind(session_pk)
            .fetch_one(&state.db)
            .await
            .unwrap();
    assert_eq!(run_row.try_get::<i64, _>("run_number").unwrap(), 1);
    let log_path_opt = run_row.try_get::<Option<String>, _>("log_path").unwrap();
    assert!(log_path_opt.is_some());
    assert!(
        run_row
            .try_get::<Option<i64>, _>("exit_code")
            .unwrap()
            .is_none()
    );

    // Verify log file exists
    let log_path = log_path_opt.unwrap();
    assert!(
        std::path::Path::new(&log_path).exists(),
        "log file missing: {}",
        log_path
    );

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_DELAY_MS");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn start_session_codex_happy_path_via_stdout() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-codex-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CODEX_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "codex-test-uuid-bbb");
        std::env::set_var("MOCK_AGENT_DELAY_MS", "50");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "codex").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK);

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    let session_pk = body["sessionPk"].as_str().unwrap();
    let session_row = sqlx::query("SELECT session_id FROM sessions WHERE id = ?")
        .bind(session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        session_row
            .try_get::<Option<String>, _>("session_id")
            .unwrap()
            .as_deref(),
        Some("codex-test-uuid-bbb")
    );

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CODEX_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_DELAY_MS");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn start_session_codex_fallback_filesystem() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-codex-fb-{}", std::process::id()));
    let tmp_codex_sessions = tmp_home.join("codex-sessions");
    std::fs::create_dir_all(&tmp_codex_sessions).unwrap();
    std::fs::create_dir_all(&tmp_home).unwrap();

    // Create a session file with a UUID-ish name
    let fb_session_id = "fb-sess-uuid-fallback-test123";
    let session_file = tmp_codex_sessions.join(format!("{}.json", fb_session_id));
    std::fs::write(&session_file, "{}").unwrap();

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CODEX_BIN", mock_bin());
        // Mock produces no session_id (empty) so primary path fails
        std::env::set_var("MOCK_AGENT_NO_OUTPUT", "1");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
        std::env::set_var(
            "OMNI_AGENT_CODEX_SESSIONS_DIR",
            tmp_codex_sessions.to_str().unwrap(),
        );
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "codex").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK);

    // Wait >2s for fallback to fire
    tokio::time::sleep(tokio::time::Duration::from_millis(3000)).await;

    let session_pk = body["sessionPk"].as_str().unwrap();
    let session_row = sqlx::query("SELECT session_id FROM sessions WHERE id = ?")
        .bind(session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        session_row
            .try_get::<Option<String>, _>("session_id")
            .unwrap()
            .as_deref(),
        Some(fb_session_id)
    );

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CODEX_BIN");
        std::env::remove_var("MOCK_AGENT_NO_OUTPUT");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
        std::env::remove_var("OMNI_AGENT_CODEX_SESSIONS_DIR");
    }
}

// ─── Timeout test (slow, marked #[ignore]) ───────────────────────────────────

/// Slow test: waits 11s for capture timeout.
/// Run with: cargo test -- --ignored
#[tokio::test]
#[ignore]
#[serial]
async fn start_session_capture_timeout() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-timeout-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_NO_OUTPUT", "1");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "60");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK);

    // Wait >10s for timeout
    tokio::time::sleep(tokio::time::Duration::from_secs(11)).await;

    let session_pk = body["sessionPk"].as_str().unwrap();
    let session_row = sqlx::query("SELECT session_id FROM sessions WHERE id = ?")
        .bind(session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert!(
        session_row
            .try_get::<Option<String>, _>("session_id")
            .unwrap()
            .is_none(),
        "session_id should still be NULL after timeout"
    );

    // Task status is still Running
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "running");

    // Subprocess still registered in map
    assert!(state.subprocess_map.lock().await.contains_key(&task_id));

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_NO_OUTPUT");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

// ─── Error tests ─────────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn start_session_agent_not_found_returns_400() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-notfound-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", "/nonexistent/claude-binary-xyz");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "agent_not_found");
    assert!(body["message"].as_str().unwrap().contains("not found"));

    // No session/run rows inserted
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(count, 0);

    let run_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM runs r \
         JOIN sessions s ON r.session_id = s.id WHERE s.task_id = ?",
    )
    .bind(&task_id)
    .fetch_one(&state.db)
    .await
    .unwrap();
    assert_eq!(run_count, 0);

    // Task status reverted to Assigned
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "assigned");

    // Not in subprocess_map
    assert!(!state.subprocess_map.lock().await.contains_key(&task_id));

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
    }
}

#[tokio::test]
#[serial]
async fn start_session_task_in_draft_returns_409() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-draft-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let (app, _state) = build_sessions_app().await;

    // Create project + task but do NOT assign agent (stays Draft)
    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"name": "OmniAgent", "key": "OMNI"}).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let project_body = body_json(res.into_body()).await;
    let project_id = project_body["id"].as_str().unwrap().to_string();

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/projects/{}/tasks", project_id))
        .header("content-type", "application/json")
        .body(Body::from(r#"{"title":"Fix","description":"Desc"}"#))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    let task_id = task_body["id"].as_str().unwrap().to_string();

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "task_not_assigned");
    assert!(body["message"].as_str().unwrap().contains("draft"));

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
    }
}

#[tokio::test]
#[serial]
async fn start_session_task_in_running_returns_session_already_active() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-running-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "test-uuid-running");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    // First call: success
    let (status, _) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK);
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // Second call: conflict
    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "session_already_active");

    // Only 1 session row in DB
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(count, 1);

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn start_session_task_in_paused_returns_task_not_assigned() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-home-paused-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    // Manually set to Paused
    sqlx::query("UPDATE tasks SET status = 'Paused' WHERE id = ?")
        .bind(&task_id)
        .execute(&state.db)
        .await
        .unwrap();

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "task_not_assigned");
    assert!(
        body["message"].as_str().unwrap().contains("resume"),
        "msg: {}",
        body["message"]
    );

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
    }
}

#[tokio::test]
#[serial]
async fn start_session_unknown_task_returns_404() {
    let (app, _state) = build_sessions_app().await;

    let req = Request::builder()
        .method("POST")
        .uri("/api/projects/proj-nonexistent/tasks/OMNI-999/sessions/start")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    // project doesn't exist → project_not_found
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "project_not_found");
}

#[tokio::test]
#[serial]
async fn start_session_unknown_project_returns_404() {
    let (app, _state) = build_sessions_app().await;

    let req = Request::builder()
        .method("POST")
        .uri("/api/projects/nonexistent-project-uuid/tasks/OMNI-001/sessions/start")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(
        body["error"] == "project_not_found" || body["error"] == "task_not_found",
        "body: {}",
        body
    );
}

#[tokio::test]
#[serial]
async fn start_session_health_route_still_works() {
    let (app, _state) = build_sessions_app().await;
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
#[serial]
async fn start_session_subprocess_registered_in_map() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-home-map-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "map-test-uuid");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, _) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK);
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    assert!(state.subprocess_map.lock().await.contains_key(&task_id));

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn start_session_double_click_idempotency() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-home-dbl-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "dbl-test-uuid");
        std::env::set_var("MOCK_AGENT_DELAY_MS", "200");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "10");
    }

    let (app, state) = build_sessions_app().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    // Send two requests concurrently
    let app1 = app.clone();
    let app2 = app.clone();
    let pid1 = project_id.clone();
    let pid2 = project_id.clone();
    let tid1 = task_id.clone();
    let tid2 = task_id.clone();

    let (res1, res2) = tokio::join!(
        async move {
            let req = Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/projects/{}/tasks/{}/sessions/start",
                    pid1, tid1
                ))
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .unwrap();
            let res = app1.oneshot(req).await.unwrap();
            (res.status(), body_json(res.into_body()).await)
        },
        async move {
            let req = Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/projects/{}/tasks/{}/sessions/start",
                    pid2, tid2
                ))
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .unwrap();
            let res = app2.oneshot(req).await.unwrap();
            (res.status(), body_json(res.into_body()).await)
        }
    );

    let statuses = [res1.0, res2.0];
    let ok_count = statuses.iter().filter(|&&s| s == StatusCode::OK).count();
    let conflict_count = statuses
        .iter()
        .filter(|&&s| s == StatusCode::CONFLICT)
        .count();

    assert_eq!(ok_count, 1, "Exactly one request should succeed");
    assert_eq!(conflict_count, 1, "Exactly one request should conflict");

    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    // Exactly 1 session row
    let session_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(session_count, 1);

    // Exactly 1 subprocess in map
    assert_eq!(state.subprocess_map.lock().await.len(), 1);

    drain_subprocesses(&state).await;
    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_DELAY_MS");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

// ─── Exit detection tests (Story 3.2) ────────────────────────────────────────

fn mock_fail_bin() -> String {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    format!("{}/tests/fixtures/mock-agent-fail.sh", manifest)
}

async fn build_sessions_app_with_cancel() -> (Router, Arc<AppState>) {
    let pool = sqlx::SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();
    db::run_migrations(&pool).await.unwrap();

    let state = Arc::new(AppState {
        db: pool.clone(),
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
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/start",
            axum::routing::post(handlers::sessions::start_session),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/cancel",
            axum::routing::post(handlers::sessions::cancel_session),
        );

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(state.clone());

    (app, state)
}

async fn post_cancel(app: &Router, project_id: &str, task_id: &str) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/cancel",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;
    (status, body)
}

#[tokio::test]
#[serial]
async fn exit_code_0_transitions_task_to_paused() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-exit0-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "exit0-test-uuid");
        std::env::set_var("MOCK_AGENT_DELAY_MS", "50");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "0"); // exit immediately (code 0)
    }

    let (app, state) = build_sessions_app_with_cancel().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK, "body: {}", body);

    let session_pk = body["sessionPk"].as_str().unwrap().to_string();

    // Wait for subprocess to exit and background task to update DB
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;

    // Task should be Paused
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "paused", "task body: {}", task_body);

    // Session should be paused
    let session_row = sqlx::query("SELECT status FROM sessions WHERE id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        session_row.try_get::<String, _>("status").unwrap(),
        "paused"
    );

    // Run should have exit_code=0 and ended_at set
    let run_row = sqlx::query("SELECT exit_code, ended_at FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        run_row.try_get::<Option<i64>, _>("exit_code").unwrap(),
        Some(0)
    );
    assert!(
        run_row
            .try_get::<Option<String>, _>("ended_at")
            .unwrap()
            .is_some()
    );

    // Subprocess should be removed from map
    assert!(!state.subprocess_map.lock().await.contains_key(&task_id));

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_DELAY_MS");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn exit_code_nonzero_transitions_task_to_failed() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-exit1-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_fail_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "exit1-test-uuid");
        std::env::set_var("MOCK_AGENT_DELAY_MS", "50");
    }

    let (app, state) = build_sessions_app_with_cancel().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK, "body: {}", body);

    let session_pk = body["sessionPk"].as_str().unwrap().to_string();

    // Wait for subprocess to exit
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;

    // Task should be Failed
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "failed", "task body: {}", task_body);

    // Session should be paused (still resumable per spec)
    let session_row = sqlx::query("SELECT status FROM sessions WHERE id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        session_row.try_get::<String, _>("status").unwrap(),
        "paused"
    );

    // Run should have exit_code=1
    let run_row = sqlx::query("SELECT exit_code FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        run_row.try_get::<Option<i64>, _>("exit_code").unwrap(),
        Some(1)
    );

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_DELAY_MS");
    }
}

#[tokio::test]
#[serial]
async fn cancel_session_running_task_returns_200() {
    let tmp_home = std::env::temp_dir().join(format!("omni-test-cancel-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
        std::env::set_var("MOCK_AGENT_SESSION_ID", "cancel-test-uuid");
        std::env::set_var("MOCK_AGENT_SLEEP_SECS", "60"); // long-running
    }

    let (app, state) = build_sessions_app_with_cancel().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;

    let (status, body) = start_session(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::OK, "start body: {}", body);
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    let session_pk = body["sessionPk"].as_str().unwrap().to_string();

    // Cancel
    let (cancel_status, cancel_body) = post_cancel(&app, &project_id, &task_id).await;
    assert_eq!(
        cancel_status,
        StatusCode::OK,
        "cancel body: {}",
        cancel_body
    );
    assert_eq!(cancel_body["taskId"], task_id);
    assert_eq!(cancel_body["status"], "cancelled");
    assert!(
        cancel_body["message"]
            .as_str()
            .unwrap()
            .contains("cancelled")
    );

    // Task should be Cancelled
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/projects/{}/tasks/{}", project_id, task_id))
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let task_body = body_json(res.into_body()).await;
    assert_eq!(task_body["status"], "cancelled", "task body: {}", task_body);

    // Session should be closed
    let session_row = sqlx::query("SELECT status FROM sessions WHERE id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        session_row.try_get::<String, _>("status").unwrap(),
        "closed"
    );

    // Run should have exit_code=-1 and ended_at
    let run_row = sqlx::query("SELECT exit_code, ended_at FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(
        run_row.try_get::<Option<i64>, _>("exit_code").unwrap(),
        Some(-1)
    );
    assert!(
        run_row
            .try_get::<Option<String>, _>("ended_at")
            .unwrap()
            .is_some()
    );

    // Subprocess should be gone from map
    assert!(!state.subprocess_map.lock().await.contains_key(&task_id));

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
        std::env::remove_var("MOCK_AGENT_SESSION_ID");
        std::env::remove_var("MOCK_AGENT_SLEEP_SECS");
    }
}

#[tokio::test]
#[serial]
async fn cancel_session_non_running_task_returns_409() {
    let tmp_home =
        std::env::temp_dir().join(format!("omni-test-cancel-409-{}", std::process::id()));
    std::fs::create_dir_all(&tmp_home).unwrap();
    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let (app, _state) = build_sessions_app_with_cancel().await;
    let (project_id, task_id) = setup_assigned_task(&app, "claude").await;
    // Task is Assigned, not Running

    let (status, body) = post_cancel(&app, &project_id, &task_id).await;
    assert_eq!(status, StatusCode::CONFLICT, "body: {}", body);
    assert_eq!(body["error"], "task_not_running");
    assert!(body["message"].as_str().unwrap().contains("cancel"));

    std::fs::remove_dir_all(&tmp_home).ok();
    unsafe {
        std::env::remove_var("HOME");
        std::env::remove_var("OMNI_AGENT_CLAUDE_BIN");
    }
}

#[tokio::test]
#[serial]
async fn flush_running_tasks_updates_db() {
    // Unit-style test for flush logic: set up a running task + session + run,
    // then run the flush SQL directly and verify DB state.
    let pool = sqlx::SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();
    db::run_migrations(&pool).await.unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO projects (id, key, name, created_at, updated_at) VALUES ('proj-1', 'TEST', 'Test', ?, ?)",
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) \
         VALUES ('TEST-001', 'proj-1', 1, 'T', 'D', 'Running', ?, ?)",
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let session_pk = "sess-flush-test";
    let run_id = "run-flush-test";
    sqlx::query(
        "INSERT INTO sessions (id, task_id, agent, session_id, status, created_at, last_active) \
         VALUES (?, 'TEST-001', 'claude', NULL, 'running', ?, ?)",
    )
    .bind(session_pk)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at) \
         VALUES (?, ?, 1, NULL, NULL, NULL, NULL, ?, NULL)",
    )
    .bind(run_id)
    .bind(session_pk)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    // Run flush SQL
    let flush_now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE tasks SET status = 'Paused', updated_at = ? WHERE status = 'Running'")
        .bind(&flush_now)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE sessions SET status = 'paused', last_active = ? WHERE status = 'running'")
        .bind(&flush_now)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE runs SET exit_code = -2, ended_at = ? WHERE ended_at IS NULL")
        .bind(&flush_now)
        .execute(&pool)
        .await
        .unwrap();

    // Verify
    let task_status: String = sqlx::query_scalar("SELECT status FROM tasks WHERE id = 'TEST-001'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(task_status, "Paused");

    let session_status: String = sqlx::query_scalar("SELECT status FROM sessions WHERE id = ?")
        .bind(session_pk)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(session_status, "paused");

    let run_exit_code: Option<i64> = sqlx::query_scalar("SELECT exit_code FROM runs WHERE id = ?")
        .bind(run_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(run_exit_code, Some(-2));

    let run_ended_at: Option<String> = sqlx::query_scalar("SELECT ended_at FROM runs WHERE id = ?")
        .bind(run_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(run_ended_at.is_some());
}

// ─── Resume Session & Comment Tracking tests (Story 3.3) ──────────────────────

async fn build_sessions_app_with_resume() -> (Router, Arc<AppState>) {
    let pool = SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();
    db::run_migrations(&pool).await.unwrap();

    let state = Arc::new(AppState {
        db: pool.clone(),
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
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/start",
            axum::routing::post(handlers::sessions::start_session),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/cancel",
            axum::routing::post(handlers::sessions::cancel_session),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/sessions/resume",
            axum::routing::post(handlers::sessions::resume_session),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/comments",
            axum::routing::post(handlers::comments::add_comment),
        );

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(state.clone());

    (app, state)
}

async fn setup_app_with_paused_task(
    agent: &str,
    session_id_value: Option<&str>,
    task_status: &str,
) -> (
    Router,
    SqlitePool,
    Arc<AppState>,
    String,
    String,
    String,
    std::path::PathBuf,
) {
    let (app, state) = build_sessions_app_with_resume().await;
    let pool = state.db.clone();

    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO projects (id, key, name, created_at, updated_at) VALUES ('proj-1', 'TEST', 'Test', ?, ?)",
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, title, description, agent, role, status, created_at, updated_at) \
         VALUES ('TEST-001', 'proj-1', 1, 'Fix login', 'Token broken', ?, 'coder', ?, ?, ?)",
    )
    .bind(agent)
    .bind(task_status)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let session_pk = "sess-uuid-aaa";
    sqlx::query(
        "INSERT INTO sessions (id, task_id, agent, session_id, status, created_at, last_active) \
         VALUES (?, 'TEST-001', ?, ?, ?, ?, ?)",
    )
    .bind(session_pk)
    .bind(agent)
    .bind(session_id_value)
    .bind(task_status.to_lowercase())
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at) \
         VALUES ('run-uuid-1', ?, 1, NULL, 0, NULL, NULL, ?, ?)",
    )
    .bind(session_pk)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let tmp_home = std::env::temp_dir().join(format!("omni-test-home-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp_home);

    (
        app,
        pool,
        state,
        "proj-1".to_string(),
        "TEST-001".to_string(),
        session_pk.to_string(),
        tmp_home,
    )
}

#[tokio::test]
#[serial]
async fn resume_session_happy_path_with_comment() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"comment": "Check edge case email"}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::OK, "body: {}", body);
    assert_eq!(body["sessionPk"], session_pk);
    assert_eq!(body["taskId"], task_id);
    assert_eq!(body["sessionId"], "cli-sess-uuid-aaa");
    assert_eq!(body["status"], "running");
    assert!(body["runId"].is_string());
    assert_eq!(body["runNumber"], 2);
    assert!(body["commentId"].is_string());
    assert_eq!(body["commentSent"], true);

    // Verify DB mutations
    let task_status: String = sqlx::query_scalar("SELECT status FROM tasks WHERE id = ?")
        .bind(&task_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(task_status, "Running");

    let sess_status: String = sqlx::query_scalar("SELECT status FROM sessions WHERE id = ?")
        .bind(&session_pk)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sess_status, "running");

    let run_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(run_count, 2);

    let run_input: String =
        sqlx::query_scalar("SELECT input FROM runs WHERE session_id = ? AND run_number = 2")
            .bind(&session_pk)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(run_input, "Check edge case email");

    let comment_sent: i64 = sqlx::query_scalar("SELECT sent FROM comments WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(comment_sent, 1);

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_happy_path_no_comment() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::OK, "body: {}", body);
    assert_eq!(body["runNumber"], 2);
    assert!(body["commentId"].is_null());
    assert!(body["commentSent"].is_null());

    let run_input: String =
        sqlx::query_scalar("SELECT input FROM runs WHERE session_id = ? AND run_number = 2")
            .bind(&session_pk)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(run_input, "retry");

    let comment_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM comments WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(comment_count, 0);

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_happy_path_body_null() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::OK, "body: {}", body);
    assert_eq!(body["runNumber"], 2);
    assert!(body["commentId"].is_null());
    assert!(body["commentSent"].is_null());

    let run_input: String =
        sqlx::query_scalar("SELECT input FROM runs WHERE session_id = ? AND run_number = 2")
            .bind(&session_pk)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(run_input, "retry");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_empty_comment_returns_400() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"comment": "   "}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "empty_comment");

    // Verify no DB changes
    let run_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(run_count, 1);

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_already_running_returns_409() {
    let (app, _pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Running").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    // Insert dummy child to subprocess map
    let child = tokio::process::Command::new("sleep")
        .arg("10")
        .spawn()
        .unwrap();
    state
        .subprocess_map
        .lock()
        .await
        .insert(task_id.clone(), child);

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "session_already_active");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_done_task_returns_400() {
    let (app, _pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Done").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "task_not_resumable");
    assert!(body["message"].as_str().unwrap().contains("done"));

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_session_id_missing_returns_409() {
    let (app, _pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", None, "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "session_id_missing");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_rollback_when_agent_not_found() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", "/nonexistent/path/to/claude");
    }

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"comment": "Rollback test"}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "agent_not_found");

    // Verify DB remains unchanged
    let run_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM runs WHERE session_id = ?")
        .bind(&session_pk)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(run_count, 1);

    let task_status: String = sqlx::query_scalar("SELECT status FROM tasks WHERE id = ?")
        .bind(&task_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(task_status, "Paused");

    let comment_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM comments WHERE task_id = ?")
        .bind(&task_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(comment_count, 0);

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn resume_session_pending_comments_not_flushed() {
    let (app, pool, state, project_id, task_id, session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    unsafe {
        std::env::set_var("HOME", tmp_home.to_str().unwrap());
        std::env::set_var("OMNI_AGENT_CLAUDE_BIN", mock_bin());
    }

    // Insert pending comment row
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES ('c1', ?, 'pending comment', 0, ?)",
    )
    .bind(&task_id)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/sessions/resume",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::OK, "body: {}", body);
    assert_eq!(body["runNumber"], 2);

    // Verify pending comment is STILL pending (sent = 0)
    let pending_sent: i64 = sqlx::query_scalar("SELECT sent FROM comments WHERE id = 'c1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(pending_sent, 0);

    let run_input: String =
        sqlx::query_scalar("SELECT input FROM runs WHERE session_id = ? AND run_number = 2")
            .bind(&session_pk)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(run_input, "retry");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn add_comment_happy_path() {
    let (app, pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/comments",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"content": "  New Pending Comment  "}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::CREATED, "body: {}", body);
    assert!(body["id"].is_string());
    assert_eq!(body["taskId"], task_id);
    assert_eq!(body["content"], "  New Pending Comment  "); // Whitespace preserved
    assert_eq!(body["sent"], false);
    assert!(body["createdAt"].is_string());

    // Verify DB
    let db_sent: i64 = sqlx::query_scalar("SELECT sent FROM comments WHERE id = ?")
        .bind(body["id"].as_str().unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(db_sent, 0);

    let db_content: String = sqlx::query_scalar("SELECT content FROM comments WHERE id = ?")
        .bind(body["id"].as_str().unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(db_content, "  New Pending Comment  ");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn add_comment_empty_returns_400() {
    let (app, pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Paused").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/comments",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"content": "   "}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "empty_comment");

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM comments")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}

#[tokio::test]
#[serial]
async fn add_comment_done_task_returns_409() {
    let (app, _pool, state, project_id, task_id, _session_pk, tmp_home) =
        setup_app_with_paused_task("claude", Some("cli-sess-uuid-aaa"), "Done").await;

    let req = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/projects/{}/tasks/{}/comments",
            project_id, task_id
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::json!({"content": "valid instruction"}).to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let body = body_json(res.into_body()).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "task_terminal");

    drain_subprocesses(&state).await;
    let _ = std::fs::remove_dir_all(&tmp_home);
}
