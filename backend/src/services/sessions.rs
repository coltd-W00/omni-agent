use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use sqlx::SqlitePool;
use tokio::io::AsyncBufReadExt;
use tokio::process::Child;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::agent::{self, AgentStrategy};
use crate::error::AppError;
use crate::models::comment::Comment;
use crate::models::session::{CancelSessionResponse, StartSessionResponse};
use crate::services::{runs, tasks};

fn resolve_log_path(task_id: &str, run_id: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".omni-agent")
        .join("logs")
        .join(task_id)
        .join(format!("{}.log", run_id))
}

pub async fn start_session(
    pool: &SqlitePool,
    subprocess_map: Arc<Mutex<HashMap<String, Child>>>,
    project_id: &str,
    task_id: &str,
) -> Result<StartSessionResponse, AppError> {
    // 1. Verify project exists first
    tasks::verify_project_exists(pool, project_id).await?;

    // 2. Transition task status Assigned → Running atomically
    let task = tasks::transition_to_running(pool, project_id, task_id).await?;
    let agent_name = task.agent.as_deref().ok_or_else(|| AppError::Conflict {
        code: "task_not_assigned",
        message: format!(
            "Cannot start session: task {} has no agent assigned",
            task_id
        ),
    })?;

    // 3. Resolve strategy
    let strategy = agent::strategy_for(agent_name)?;

    // 4. Prepare log path + create parent dirs
    let session_pk = Uuid::new_v4().to_string();
    let run_id = Uuid::new_v4().to_string();
    let log_path = resolve_log_path(task_id, &run_id);
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create log dir: {}", e)))?;
    }

    // 5. Build + spawn subprocess
    let mut command = strategy.spawn_command(&task, &log_path);
    let mut child: Child = match command.spawn() {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            tasks::revert_to_assigned(pool, task_id).await.ok();
            return Err(AppError::BadRequest {
                code: "agent_not_found",
                message: "Agent binary not found on PATH".to_string(),
            });
        }
        Err(e) => {
            tasks::revert_to_assigned(pool, task_id).await.ok();
            return Err(AppError::Internal(anyhow::anyhow!("spawn failed: {}", e)));
        }
    };

    // 6. Write task prompt to stdin (best-effort)
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let prompt = format!("{}\n\n{}", task.title, task.description);
        let _ = stdin.write_all(prompt.as_bytes()).await;
        let _ = stdin.shutdown().await;
    }

    // 7. Take stdout/stderr before inserting child into map
    let stdout = child.stdout.take().ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("Failed to capture stdout from subprocess"))
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("Failed to capture stderr from subprocess"))
    })?;

    // 8. Insert into subprocess_map (defensive collision check)
    let insert_result: Result<(), AppError> = async {
        let mut map = subprocess_map.lock().await;
        if map.contains_key(task_id) {
            return Err(AppError::Conflict {
                code: "session_already_active",
                message: format!("Task {} already has an active session", task_id),
            });
        }
        map.insert(task_id.to_string(), child);
        drop(map);

        // 9. INSERT session + run rows
        let now = Utc::now().to_rfc3339();
        let log_path_str = log_path.to_string_lossy().to_string();
        let mut tx = pool.begin().await?;
        sqlx::query(
            "INSERT INTO sessions (id, task_id, agent, session_id, status, created_at, last_active) \
             VALUES (?, ?, ?, NULL, 'running', ?, ?)",
        )
        .bind(&session_pk)
        .bind(task_id)
        .bind(agent_name)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at) \
             VALUES (?, ?, 1, NULL, NULL, ?, NULL, ?, NULL)",
        )
        .bind(&run_id)
        .bind(&session_pk)
        .bind(&log_path_str)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }
    .await;

    if let Err(e) = insert_result {
        // Rollback: remove child from map (and kill it), revert task status
        if let Some(mut c) = subprocess_map.lock().await.remove(task_id) {
            let _ = c.start_kill();
        }
        tasks::revert_to_assigned(pool, task_id).await.ok();
        return Err(e);
    }

    // 10. Spawn background streaming + session ID capture task
    let pool_clone = pool.clone();
    let strategy_clone = agent::strategy_for(agent_name).expect("strategy already validated");
    let session_pk_clone = session_pk.clone();
    let run_id_clone = run_id.clone();
    let log_path_clone = log_path.clone();
    let task_id_clone = task_id.to_string();
    let subprocess_map_clone = subprocess_map.clone();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let started_at_utc = Utc::now();

    tokio::spawn(async move {
        stream_and_capture(
            stdout,
            pool_clone,
            strategy_clone,
            session_pk_clone,
            run_id_clone,
            task_id_clone,
            log_path_clone,
            subprocess_map_clone,
            cwd,
            started_at_utc,
        )
        .await;
    });
    tokio::spawn(stream_stderr_to_log(stderr, log_path.clone()));

    let now = Utc::now().to_rfc3339();
    Ok(StartSessionResponse {
        session_pk,
        task_id: task_id.to_string(),
        session_id: None,
        session_id_missing: false,
        status: "running".to_string(),
        created_at: now,
    })
}

fn format_stderr_line(line: &str) -> String {
    format!("[stderr] {}\n", line)
}

async fn stream_stderr_to_log(stderr: tokio::process::ChildStderr, log_path: PathBuf) {
    use tokio::io::{AsyncWriteExt, BufReader};

    if let Some(parent) = log_path.parent()
        && let Err(e) = tokio::fs::create_dir_all(parent).await
    {
        tracing::error!(?e, log_path = ?log_path, "stderr task: failed to create log directory");
        return;
    }

    let mut file = match tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .await
    {
        Ok(f) => f,
        Err(e) => {
            tracing::error!(?e, log_path = ?log_path, "stderr task: failed to open log file");
            return;
        }
    };

    let mut reader = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        let formatted = format_stderr_line(&line);
        if let Err(e) = file.write_all(formatted.as_bytes()).await {
            tracing::warn!(?e, "stderr task: write failed, continuing");
        }
    }

    if let Err(e) = file.flush().await {
        tracing::warn!(?e, "stderr task: flush failed");
    }
}

#[allow(clippy::too_many_arguments, clippy::collapsible_if)]
async fn stream_and_capture(
    stdout: tokio::process::ChildStdout,
    pool: SqlitePool,
    strategy: Box<dyn AgentStrategy>,
    session_pk: String,
    run_id: String,
    task_id: String,
    log_path: PathBuf,
    subprocess_map: Arc<Mutex<HashMap<String, Child>>>,
    cwd: PathBuf,
    started_at_utc: chrono::DateTime<Utc>,
) {
    use tokio::io::AsyncWriteExt;

    let log_file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .await;

    let mut log_file = match log_file {
        Ok(f) => Some(f),
        Err(e) => {
            tracing::error!(task_id = %task_id, "Failed to open log file: {}", e);
            None
        }
    };

    let mut lines = tokio::io::BufReader::new(stdout).lines();
    let mut captured = false;
    let mut capture_timed_out = false;
    let mut codex_fallback_done = false;

    let codex_fallback_sleep = tokio::time::sleep(Duration::from_secs(2));
    let capture_timeout_sleep = tokio::time::sleep(Duration::from_secs(10));
    tokio::pin!(codex_fallback_sleep);
    tokio::pin!(capture_timeout_sleep);

    loop {
        tokio::select! {
            biased;

            line_result = lines.next_line() => {
                match line_result {
                    Ok(Some(line)) => {
                        if let Some(ref mut f) = log_file {
                            let _ = f.write_all(format!("{}\n", line).as_bytes()).await;
                        }
                        if !captured && !capture_timed_out {
                            if let Some(sid) = strategy.parse_session_id_chunk(&line) {
                                let now = Utc::now().to_rfc3339();
                                match sqlx::query(
                                    "UPDATE sessions SET session_id = ?, last_active = ? WHERE id = ?",
                                )
                                .bind(&sid)
                                .bind(&now)
                                .bind(&session_pk)
                                .execute(&pool)
                                .await
                                {
                                    Ok(_) => { captured = true; }
                                    Err(e) => {
                                        tracing::error!(task_id = %task_id, "Failed to update session_id: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(e) => {
                        tracing::error!(task_id = %task_id, "Error reading stdout: {}", e);
                        break;
                    }
                }
            }

            _ = &mut codex_fallback_sleep, if !codex_fallback_done && !captured && strategy.name() == "codex" => {
                codex_fallback_done = true;
                if let Some(sid) = strategy.fallback_session_id_lookup(&cwd, started_at_utc) {
                    let now = Utc::now().to_rfc3339();
                    match sqlx::query(
                        "UPDATE sessions SET session_id = ?, last_active = ? WHERE id = ?",
                    )
                    .bind(&sid)
                    .bind(&now)
                    .bind(&session_pk)
                    .execute(&pool)
                    .await
                    {
                        Ok(_) => { captured = true; }
                        Err(e) => {
                            tracing::error!(task_id = %task_id, "Failed to update session_id (fallback): {}", e);
                        }
                    }
                } else {
                    tracing::warn!(task_id = %task_id, "Codex fallback filesystem scan found no session file");
                }
            }

            _ = &mut capture_timeout_sleep, if !capture_timed_out => {
                capture_timed_out = true;
                if !captured {
                    tracing::warn!(
                        task_id = %task_id,
                        "session_id not captured within 10s; subprocess continues, session.session_id stays NULL"
                    );
                }
            }
        }
    }

    // Flush log file before reading tail
    if let Some(ref mut f) = log_file {
        let _ = f.flush().await;
    }
    drop(log_file);

    complete_run_and_exit(
        &pool,
        &subprocess_map,
        &task_id,
        &session_pk,
        &run_id,
        &log_path,
    )
    .await;
}

pub async fn complete_run_and_exit(
    pool: &SqlitePool,
    subprocess_map: &Arc<Mutex<HashMap<String, Child>>>,
    task_id: &str,
    session_pk: &str,
    run_id: &str,
    log_path: &std::path::Path,
) {
    // Detect exit: remove child from subprocess_map and get exit code
    let exit_code = {
        let removed = subprocess_map.lock().await.remove(task_id);
        match removed {
            Some(mut child) => match child.wait().await {
                Ok(status) => status.code().unwrap_or(-1),
                Err(e) => {
                    tracing::error!(task_id = %task_id, "child.wait() error: {}", e);
                    -1
                }
            },
            None => {
                // Already removed by cancel or shutdown handler — check task status
                let status_result =
                    sqlx::query_scalar::<_, String>("SELECT status FROM tasks WHERE id = ?")
                        .bind(task_id)
                        .fetch_optional(pool)
                        .await;

                match status_result {
                    Ok(Some(ref s)) if s == "Cancelled" || s == "Paused" => {
                        tracing::warn!(
                            task_id = %task_id,
                            "Background task: subprocess removed (cancel/shutdown race), task already in terminal state {}; skipping DB updates",
                            s
                        );
                        return;
                    }
                    _ => {
                        tracing::warn!(
                            task_id = %task_id,
                            "Background task: subprocess not in map (race), proceeding with fallback exit_code=-1"
                        );
                        -1
                    }
                }
            }
        }
    };

    // Read log tail and update DB
    let log_tail = runs::read_log_tail(log_path, 100, 10_240).await;

    if let Err(e) = runs::complete_run(pool, run_id, exit_code, log_tail.as_deref()).await {
        tracing::error!(task_id = %task_id, "Failed to complete run: {}", e);
    }

    if let Err(e) = mark_session_paused(pool, session_pk).await {
        tracing::error!(task_id = %task_id, "Failed to mark session paused: {}", e);
    }

    if exit_code == 0 {
        if let Err(e) = tasks::transition_to_paused(pool, task_id).await {
            tracing::error!(task_id = %task_id, "Failed to transition task to Paused: {}", e);
        }
    } else if let Err(e) = tasks::transition_to_failed(pool, task_id).await {
        tracing::error!(task_id = %task_id, "Failed to transition task to Failed: {}", e);
    }
}

pub async fn stream_subprocess_stdout(
    stdout: tokio::process::ChildStdout,
    pool: SqlitePool,
    subprocess_map: Arc<Mutex<HashMap<String, Child>>>,
    task_id: String,
    session_pk: String,
    run_id: String,
    log_path: PathBuf,
) {
    use tokio::io::AsyncWriteExt;

    let log_file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .await;

    let mut log_file = match log_file {
        Ok(f) => Some(f),
        Err(e) => {
            tracing::error!(task_id = %task_id, "Failed to open log file: {}", e);
            None
        }
    };

    let mut lines = tokio::io::BufReader::new(stdout).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if let Some(ref mut f) = log_file {
                    let _ = f.write_all(format!("{}\n", line).as_bytes()).await;
                }
            }
            Ok(None) => break, // EOF
            Err(e) => {
                tracing::error!(task_id = %task_id, "Error reading stdout: {}", e);
                break;
            }
        }
    }

    // Flush log file before reading tail
    if let Some(ref mut f) = log_file {
        let _ = f.flush().await;
    }
    drop(log_file);

    complete_run_and_exit(
        &pool,
        &subprocess_map,
        &task_id,
        &session_pk,
        &run_id,
        &log_path,
    )
    .await;
}

pub struct ResumeOutcome {
    pub session_pk: String,
    pub task_id: String,
    pub session_id: String,
    pub run_id: String,
    pub run_number: i64,
    pub run_input: String, // "retry" hoặc comment text
    pub comment: Option<Comment>,
    pub started_at: String,
}

pub async fn resume_session(
    state: Arc<crate::state::AppState>,
    project_id: &str,
    task_id: &str,
    comment: Option<String>,
) -> Result<ResumeOutcome, AppError> {
    // 1. Validate comment empty-check (chỉ khi field được truyền)
    if comment
        .as_ref()
        .map(|s| s.trim().is_empty())
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest {
            code: "empty_comment",
            message: "Comment cannot be empty".to_string(),
        });
    }

    // 2. Load task + verify project/task exist
    let task = tasks::get_task(&state.db, project_id, task_id).await?;

    // 3. AC-4 / AC-5: check task status
    match task.status.as_str() {
        "Paused" | "Failed" => {} // OK to resume
        "Running" => {
            return Err(AppError::Conflict {
                code: "session_already_active",
                message:
                    "Cannot resume a running session. Cancel it first or wait for it to pause."
                        .to_string(),
            });
        }
        other => {
            return Err(AppError::BadRequest {
                code: "task_not_resumable",
                message: format!(
                    "Cannot resume a task in '{}' state — only paused or failed tasks can be resumed",
                    other.to_lowercase()
                ),
            });
        }
    }

    // 4. Load session row
    let session = sqlx::query_as::<_, (String, String, Option<String>, String)>(
        "SELECT id, agent, session_id, status FROM sessions WHERE task_id = ?",
    )
    .bind(task_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound {
        code: "session_not_found",
        message: format!("No session exists for task '{}'", task_id),
    })?;
    let (session_pk, agent, session_id_opt, _session_status) = session;

    // 5. AC-8: session_id null → 409
    let session_id_str = session_id_opt.ok_or_else(|| AppError::Conflict {
        code: "session_id_missing",
        message: "Cannot resume — session_id was not captured. Provide it manually first."
            .to_string(),
    })?;

    // 6. AC-4 secondary check: subprocess_map collision
    if state.subprocess_map.lock().await.contains_key(task_id) {
        return Err(AppError::Conflict {
            code: "session_already_active",
            message: "Cannot resume a running session. Cancel it first or wait for it to pause."
                .to_string(),
        });
    }

    // 7. Build resume command via strategy
    let strategy = crate::agent::strategy_for(&agent)?;
    let mut cmd = strategy.resume_command(&session_id_str, comment.as_deref());

    // 8. AC-10: Spawn TRƯỚC khi commit DB
    let mut child = cmd.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::BadRequest {
            code: "agent_not_found",
            message: "Agent binary not found on PATH".to_string(),
        },
        _ => AppError::Internal(anyhow::anyhow!("Failed to spawn agent subprocess: {}", e)),
    })?;

    // 9. Pipe stdin (best-effort)
    if let (Some(text), Some(mut stdin)) = (comment.as_deref(), child.stdin.take()) {
        use tokio::io::AsyncWriteExt;
        if let Err(e) = stdin.write_all(text.as_bytes()).await {
            tracing::warn!(error = %e, "failed to write comment to stdin");
        }
        if let Err(e) = stdin.write_all(b"\n").await {
            tracing::warn!(error = %e, "failed to write newline to stdin");
        }
        // stdin dropped here → close pipe
    }

    // 10. Take stdout/stderr TRƯỚC khi child vào map
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("subprocess stdout missing")))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("subprocess stderr missing")))?;

    // 11. Build log_path + ensure dir exists
    let run_id = Uuid::new_v4().to_string();
    let log_path = resolve_log_path(task_id, &run_id);
    if let Some(parent) = log_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let log_path_str = log_path.to_string_lossy().to_string();

    let now = Utc::now().to_rfc3339();
    let run_input_value: String = match comment.as_deref() {
        Some(text) => text.to_string(),
        None => "retry".to_string(),
    };

    // 12. Open tx (BEGIN IMMEDIATE)
    let mut tx = state.db.begin_with("BEGIN IMMEDIATE").await.map_err(|e| {
        let _ = child.start_kill();
        AppError::Internal(anyhow::anyhow!("Failed to begin tx: {}", e))
    })?;

    // 12a. AC-9: compute next run_number atomic
    let next_run_number = match sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(run_number), 0) + 1 FROM runs WHERE session_id = ?",
    )
    .bind(&session_pk)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(num) => num,
        Err(e) => {
            let _ = child.start_kill();
            return Err(AppError::Internal(anyhow::anyhow!(
                "Failed to select run_number: {}",
                e
            )));
        }
    };

    // 12b. Insert comment if any (sent = 1)
    let comment_row: Option<Comment> = match comment.as_deref() {
        Some(text) => {
            match crate::services::comments::insert_comment_in_tx(&mut tx, task_id, text, true)
                .await
            {
                Ok(c) => Some(c),
                Err(e) => {
                    let _ = child.start_kill();
                    return Err(e);
                }
            }
        }
        None => None,
    };

    // 12c. Insert run
    if let Err(e) = sqlx::query(
        "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at) \
         VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL)",
    )
    .bind(&run_id)
    .bind(&session_pk)
    .bind(next_run_number)
    .bind(&run_input_value)
    .bind(&log_path_str)
    .bind(&now)
    .execute(&mut *tx)
    .await {
        let _ = child.start_kill();
        return Err(AppError::Internal(anyhow::anyhow!("Failed to insert run: {}", e)));
    }

    // 12d. Update session status → running, last_active = now
    if let Err(e) =
        sqlx::query("UPDATE sessions SET status = 'running', last_active = ? WHERE id = ?")
            .bind(&now)
            .bind(&session_pk)
            .execute(&mut *tx)
            .await
    {
        let _ = child.start_kill();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Failed to update session: {}",
            e
        )));
    }

    // 12e. Update task status → Running (via services/tasks helper)
    if let Err(e) = tasks::transition_to_running_in_tx(&mut tx, task_id).await {
        // tx will rollback on drop. Kill child to clean up.
        let _ = child.start_kill();
        return Err(e);
    }

    // 12f. Commit
    if let Err(e) = tx.commit().await {
        let _ = child.start_kill();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Failed to commit resume tx: {}",
            e
        )));
    }

    // 13. Insert child vào subprocess_map
    state
        .subprocess_map
        .lock()
        .await
        .insert(task_id.to_string(), child);

    // 14. Spawn background streaming task
    let pool_clone = state.db.clone();
    let map_clone = state.subprocess_map.clone();
    let task_id_clone = task_id.to_string();
    let session_pk_clone = session_pk.clone();
    let run_id_clone = run_id.clone();
    let log_path_clone = log_path.clone();

    tokio::spawn(async move {
        stream_subprocess_stdout(
            stdout,
            pool_clone,
            map_clone,
            task_id_clone,
            session_pk_clone,
            run_id_clone,
            log_path_clone,
        )
        .await;
    });
    tokio::spawn(stream_stderr_to_log(stderr, log_path.clone()));

    Ok(ResumeOutcome {
        session_pk,
        task_id: task_id.to_string(),
        session_id: session_id_str,
        run_id,
        run_number: next_run_number,
        run_input: run_input_value,
        comment: comment_row,
        started_at: now,
    })
}

pub async fn mark_session_paused(pool: &SqlitePool, session_pk: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE sessions SET status = 'paused', last_active = ? WHERE id = ? AND status = 'running'",
    )
    .bind(&now)
    .bind(session_pk)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_session_closed(pool: &SqlitePool, session_pk: &str) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE sessions SET status = 'closed', last_active = ? WHERE id = ? AND status = 'running'",
    )
    .bind(&now)
    .bind(session_pk)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn cancel_session(
    pool: &SqlitePool,
    subprocess_map: Arc<Mutex<HashMap<String, Child>>>,
    project_id: &str,
    task_id: &str,
) -> Result<CancelSessionResponse, AppError> {
    // Verify task exists in project (404 if not found)
    tasks::get_task(pool, project_id, task_id).await?;

    // Atomic transition Running → Cancelled (409 if not Running)
    tasks::transition_to_cancelled(pool, task_id).await?;

    // Remove and kill subprocess
    let child_opt = subprocess_map.lock().await.remove(task_id);
    match child_opt {
        Some(mut child) => {
            let _ = child.start_kill();
        }
        None => {
            tracing::warn!(
                task_id = %task_id,
                "cancel_session: subprocess handle not found in map (already exited?)"
            );
        }
    }

    // Find active session and mark closed
    let session_pk: Option<String> = sqlx::query_scalar(
        "SELECT id FROM sessions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    if let Some(ref spk) = session_pk {
        mark_session_closed(pool, spk).await?;

        // Find active run and complete it with exit_code=-1
        let run_row: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT id, log_path FROM runs WHERE session_id = ? AND ended_at IS NULL \
             ORDER BY started_at DESC LIMIT 1",
        )
        .bind(spk)
        .fetch_optional(pool)
        .await?;

        if let Some((run_id, log_path)) = run_row {
            let log_tail = if let Some(ref lp) = log_path {
                runs::read_log_tail(std::path::Path::new(lp), 100, 10_240).await
            } else {
                None
            };
            runs::complete_run(pool, &run_id, -1, log_tail.as_deref()).await?;
        }
    }

    Ok(CancelSessionResponse {
        task_id: task_id.to_string(),
        status: "cancelled".to_string(),
        message: "Session cancelled and subprocess killed".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_log_path_uses_home_env() {
        unsafe {
            std::env::set_var("HOME", "/tmp/test-home");
        }
        let path = resolve_log_path("OMNI-001", "run-123");
        assert_eq!(
            path,
            PathBuf::from("/tmp/test-home/.omni-agent/logs/OMNI-001/run-123.log")
        );
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[test]
    fn resolve_log_path_fallback_tmp_when_no_home() {
        unsafe {
            std::env::remove_var("HOME");
        }
        let path = resolve_log_path("TASK-001", "run-abc");
        assert!(path.to_string_lossy().contains("TASK-001"));
        assert!(path.to_string_lossy().contains("run-abc.log"));
    }

    #[test]
    fn format_stderr_line_adds_prefix_and_newline() {
        assert_eq!(
            format_stderr_line("err msg"),
            "[stderr] err msg\n".to_string()
        );
    }
}
