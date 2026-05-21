use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use axum::{Json, Router, extract::State, response::IntoResponse, routing::get};
use tokio::sync::Mutex;
use tracing::{debug, info};
use tracing_subscriber::EnvFilter;

use omni_agent_backend::{db, error::AppError, handlers, state::AppState};

async fn health_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let db_closed = state.db.is_closed();
    let active_subprocesses = state.subprocess_count().await;

    debug!(
        db_closed,
        active_subprocesses, "Health check state snapshot"
    );

    Json(serde_json::json!({"status": "ok"}))
}

async fn fallback_handler() -> impl IntoResponse {
    AppError::NotFound {
        code: "not_found",
        message: "Route not found".to_string(),
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let db_dir = std::path::PathBuf::from(&home).join(".omni-agent");
    std::fs::create_dir_all(&db_dir)?;
    let db_url = format!("sqlite://{}/omni-agent.db", db_dir.display());

    let opts = sqlx::sqlite::SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(opts).await?;

    db::run_migrations(&pool).await?;
    info!("Database migrations applied");

    let state = AppState {
        db: pool,
        subprocess_map: Arc::new(Mutex::new(HashMap::new())),
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

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(Arc::new(state));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    info!("Server running on http://127.0.0.1:8080");
    axum::serve(listener, app).await?;

    Ok(())
}
