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
use tower::ServiceExt; // for `oneshot`

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

async fn build_test_app() -> Router {
    let pool = SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true),
    )
    .await
    .unwrap();

    db::run_migrations(&pool).await.unwrap();

    let state = AppState {
        db: pool,
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
        );

    Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(Arc::new(state))
}

async fn body_json(body: Body) -> Value {
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

#[tokio::test]
async fn post_projects_happy_path() {
    let app = build_test_app().await;
    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"OmniAgent Core","key":"OMNI"}"#))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let json = body_json(response.into_body()).await;
    assert!(!json["id"].as_str().unwrap_or("").is_empty());
    assert_eq!(json["name"], "OmniAgent Core");
    assert_eq!(json["key"], "OMNI");
    assert!(!json["createdAt"].as_str().unwrap_or("").is_empty());
    assert!(!json["updatedAt"].as_str().unwrap_or("").is_empty());
}

#[tokio::test]
async fn post_projects_duplicate_key() {
    let app = build_test_app().await;

    // First create
    let req1 = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"First","key":"OMNI"}"#))
        .unwrap();
    app.clone().oneshot(req1).await.unwrap();

    // Duplicate
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"Second","key":"OMNI"}"#))
        .unwrap();

    let response = app.oneshot(req2).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let json = body_json(response.into_body()).await;
    assert_eq!(json["error"], "project_key_taken");
}

#[tokio::test]
async fn post_projects_invalid_key() {
    let app = build_test_app().await;
    let req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"Test","key":"bad-key"}"#))
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let json = body_json(response.into_body()).await;
    assert_eq!(json["error"], "invalid_project_key");
}

#[tokio::test]
async fn delete_project_empty_succeeds() {
    let app = build_test_app().await;

    // Create project first
    let create_req = Request::builder()
        .method("POST")
        .uri("/api/projects")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"name":"Test","key":"TSTS"}"#))
        .unwrap();
    let create_resp = app.clone().oneshot(create_req).await.unwrap();
    let json = body_json(create_resp.into_body()).await;
    let id = json["id"].as_str().unwrap().to_string();

    // Delete
    let delete_req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/projects/{}", id))
        .body(Body::empty())
        .unwrap();
    let response = app.oneshot(delete_req).await.unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn delete_project_not_found() {
    let app = build_test_app().await;
    let req = Request::builder()
        .method("DELETE")
        .uri("/api/projects/nonexistent-id-12345")
        .body(Body::empty())
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let json = body_json(response.into_body()).await;
    assert_eq!(json["error"], "project_not_found");
}

#[tokio::test]
async fn health_still_200_after_api_mount() {
    let app = build_test_app().await;
    let req = Request::builder()
        .uri("/health")
        .body(Body::empty())
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn unknown_route_returns_404_with_error_envelope() {
    let app = build_test_app().await;
    let req = Request::builder()
        .uri("/unknown-route")
        .body(Body::empty())
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let json = body_json(response.into_body()).await;
    assert_eq!(json["error"], "not_found");
}
