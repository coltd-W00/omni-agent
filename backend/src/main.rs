use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use axum::{Json, Router, extract::State, response::IntoResponse, routing::get};
use tokio::sync::Mutex;
use tracing::{debug, info};
use tracing_subscriber::EnvFilter;

use omni_agent_backend::{db, error::AppError, handlers, services, state::AppState};

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

    let state = Arc::new(state);
    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    info!("Server running on http://127.0.0.1:8080");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(state))
        .await?;

    Ok(())
}

async fn shutdown_signal(state: Arc<AppState>) {
    let ctrl_c = tokio::signal::ctrl_c();

    #[cfg(unix)]
    let sigterm = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let sigterm = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => { info!("Received SIGINT (Ctrl+C)"); }
        _ = sigterm => { info!("Received SIGTERM"); }
    }

    let flush_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        flush_running_tasks(state),
    )
    .await;

    match flush_result {
        Ok(Ok(())) => info!("Graceful shutdown: all tasks flushed"),
        Ok(Err(e)) => tracing::error!("Graceful shutdown flush error: {}", e),
        Err(_) => tracing::error!("Graceful shutdown: flush timed out after 5s, forcing exit"),
    }
}

async fn flush_running_tasks(state: Arc<AppState>) -> Result<(), anyhow::Error> {
    // Step 1: Kill all subprocesses
    let mut map = state.subprocess_map.lock().await;
    let task_ids: Vec<String> = map.keys().cloned().collect();
    for (_task_id, mut child) in map.drain() {
        tracing::info!(task_id = %_task_id, "Shutdown: killing subprocess");
        let _ = child.start_kill();
    }
    drop(map);

    let now = chrono::Utc::now().to_rfc3339();

    // Step 2: Flush tasks Running → Paused
    sqlx::query("UPDATE tasks SET status = 'Paused', updated_at = ? WHERE status = 'Running'")
        .bind(&now)
        .execute(&state.db)
        .await?;

    // Step 3: Flush sessions running → paused
    sqlx::query("UPDATE sessions SET status = 'paused', last_active = ? WHERE status = 'running'")
        .bind(&now)
        .execute(&state.db)
        .await?;

    // Step 4: Flush open runs → set ended_at, exit_code = -2
    sqlx::query("UPDATE runs SET exit_code = -2, ended_at = ? WHERE ended_at IS NULL")
        .bind(&now)
        .execute(&state.db)
        .await?;

    // Step 5: Best-effort log_tail update for affected runs
    let flushed_runs: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, log_path FROM runs WHERE exit_code = -2 AND log_path IS NOT NULL AND log_tail IS NULL",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (run_id, log_path) in &flushed_runs {
        let path = std::path::Path::new(log_path);
        if let Some(tail) = services::runs::read_log_tail(path, 100, 10_240).await {
            let _ = sqlx::query("UPDATE runs SET log_tail = ? WHERE id = ?")
                .bind(&tail)
                .bind(run_id)
                .execute(&state.db)
                .await;
        }
    }

    info!(
        flushed_count = task_ids.len(),
        "All running tasks flushed to Paused"
    );
    Ok(())
}
