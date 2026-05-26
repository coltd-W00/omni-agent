use std::path::Path;

use sqlx::SqlitePool;

use crate::error::AppError;

/// Read last `max_lines` lines from log file, capped at `max_bytes`.
pub async fn read_log_tail(log_path: &Path, max_lines: usize, max_bytes: usize) -> Option<String> {
    let content = tokio::fs::read_to_string(log_path).await.ok()?;
    let lines: Vec<&str> = content.lines().collect();
    let tail_lines = &lines[lines.len().saturating_sub(max_lines)..];
    let tail = tail_lines.join("\n");
    if tail.len() > max_bytes {
        Some(tail[tail.len() - max_bytes..].to_string())
    } else {
        Some(tail)
    }
}

pub async fn complete_run(
    pool: &SqlitePool,
    run_id: &str,
    exit_code: i32,
    log_tail: Option<&str>,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE runs SET exit_code = ?, ended_at = ?, log_tail = ? WHERE id = ? AND ended_at IS NULL",
    )
    .bind(exit_code)
    .bind(&now)
    .bind(log_tail)
    .bind(run_id)
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp_log(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("omni-runs-test");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[tokio::test]
    async fn read_log_tail_returns_last_lines() {
        let path = tmp_log("tail_150.log");
        let mut f = std::fs::File::create(&path).unwrap();
        for i in 1..=150 {
            writeln!(f, "line {}", i).unwrap();
        }
        let tail = read_log_tail(&path, 100, 10_240).await.unwrap();
        let lines: Vec<&str> = tail.lines().collect();
        assert_eq!(lines.len(), 100);
        assert_eq!(lines[0], "line 51");
        assert_eq!(lines[99], "line 150");
    }

    #[tokio::test]
    async fn read_log_tail_caps_at_max_bytes() {
        let path = tmp_log("tail_bigline.log");
        let mut f = std::fs::File::create(&path).unwrap();
        let long_line = "x".repeat(20_480);
        writeln!(f, "{}", long_line).unwrap();
        let tail = read_log_tail(&path, 100, 10_240).await.unwrap();
        assert!(tail.len() <= 10_240);
    }

    #[tokio::test]
    async fn read_log_tail_returns_none_for_missing_file() {
        let result = read_log_tail(Path::new("/nonexistent/path/to/log.log"), 100, 10_240).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn read_log_tail_fewer_lines_than_max() {
        let path = tmp_log("tail_10.log");
        let mut f = std::fs::File::create(&path).unwrap();
        for i in 1..=10 {
            writeln!(f, "line {}", i).unwrap();
        }
        let tail = read_log_tail(&path, 100, 10_240).await.unwrap();
        let lines: Vec<&str> = tail.lines().collect();
        assert_eq!(lines.len(), 10);
    }
}
