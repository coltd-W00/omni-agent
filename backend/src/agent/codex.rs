use chrono::{DateTime, Utc};
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

use super::AgentStrategy;
use crate::models::task::Task;

#[derive(Debug, Default)]
pub struct CodexStrategy {
    pub binary: Option<String>,
}

impl CodexStrategy {
    fn binary(&self) -> String {
        self.binary
            .clone()
            .or_else(|| std::env::var("OMNI_AGENT_CODEX_BIN").ok())
            .unwrap_or_else(|| "codex".to_string())
    }
}

impl AgentStrategy for CodexStrategy {
    fn name(&self) -> &'static str {
        "codex"
    }

    fn spawn_command(&self, _task: &Task, _log_path: &Path, workspace_path: &Path) -> Command {
        let mut cmd = Command::new(self.binary());
        cmd.current_dir(workspace_path);
        cmd.kill_on_drop(true);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }

    fn resume_command(&self, session_id: &str, comment: Option<&str>) -> Command {
        let mut cmd = Command::new(self.binary());
        cmd.arg("resume").arg(session_id);
        cmd.kill_on_drop(true);
        if comment.is_some() {
            cmd.stdin(Stdio::piped());
        } else {
            cmd.stdin(Stdio::null());
        }
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }

    #[allow(clippy::collapsible_if)]
    fn parse_session_id_chunk(&self, chunk: &str) -> Option<String> {
        for line in chunk.lines() {
            if line.is_empty() {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(s) = value.get("session_id").and_then(|v| v.as_str()) {
                    return Some(s.to_string());
                }
                if let Some(s) = value.get("id").and_then(|v| v.as_str()) {
                    if s.len() >= 8 {
                        return Some(s.to_string());
                    }
                }
            }
        }
        None
    }

    #[allow(clippy::collapsible_if)]
    fn fallback_session_id_lookup(&self, cwd: &Path, started_at: DateTime<Utc>) -> Option<String> {
        use std::fs;
        use std::time::SystemTime;

        let dir = std::env::var("OMNI_AGENT_CODEX_SESSIONS_DIR")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_default();
                std::path::PathBuf::from(home)
                    .join(".codex")
                    .join("sessions")
            });

        let entries = fs::read_dir(&dir).ok()?;
        let started_at_sys: SystemTime = started_at.into();
        let mut candidates: Vec<(std::path::PathBuf, SystemTime)> = vec![];

        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s == "json" || s == "jsonl")
                .unwrap_or(false)
            {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(mtime) = meta.modified() {
                        let tolerance = std::time::Duration::from_secs(2);
                        if mtime + tolerance >= started_at_sys {
                            candidates.push((path, mtime));
                        }
                    }
                }
            }
        }

        let _ = cwd;
        candidates.sort_by_key(|(_, m)| *m);
        let latest = candidates.into_iter().last()?;

        // Try parse session ID from filename stem first
        let from_filename = latest
            .0
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| s.len() >= 8)
            .map(|s| s.to_string());

        if let Some(s) = from_filename {
            return Some(s);
        }

        // Fallback: parse content
        let content = std::fs::read_to_string(&latest.0).ok()?;
        for line in content.lines() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(sid) = v.get("session_id").and_then(|x| x.as_str()) {
                    return Some(sid.to_string());
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::io::Write;

    fn strategy() -> CodexStrategy {
        CodexStrategy::default()
    }

    #[test]
    fn name_is_codex() {
        assert_eq!(strategy().name(), "codex");
    }

    #[test]
    fn parse_returns_some_when_json_has_session_id() {
        let input = r#"{"session_id":"abc-123","type":"start"}"#;
        assert_eq!(
            strategy().parse_session_id_chunk(input),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn fallback_returns_some_when_matching_file_in_tmp_dir() {
        let tmp_dir = std::env::temp_dir().join(format!(
            "codex-test-fallback-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        std::fs::create_dir_all(&tmp_dir).unwrap();

        // Create a session file with a UUID-ish name
        let session_id = "fb-sess-uuid-1234567890ab";
        let file_path = tmp_dir.join(format!("{}.json", session_id));
        let mut f = std::fs::File::create(&file_path).unwrap();
        writeln!(f, "{{}}").unwrap();
        drop(f);

        unsafe {
            std::env::set_var("OMNI_AGENT_CODEX_SESSIONS_DIR", tmp_dir.to_str().unwrap());
        }

        let started_at = Utc::now() - chrono::Duration::seconds(1);
        let result = strategy().fallback_session_id_lookup(std::path::Path::new("."), started_at);
        assert_eq!(result, Some(session_id.to_string()));

        unsafe {
            std::env::remove_var("OMNI_AGENT_CODEX_SESSIONS_DIR");
        }
        std::fs::remove_dir_all(&tmp_dir).ok();
    }

    #[test]
    fn fallback_returns_none_when_dir_missing() {
        unsafe {
            std::env::set_var(
                "OMNI_AGENT_CODEX_SESSIONS_DIR",
                "/nonexistent/codex-sessions-dir-xyz",
            );
        }
        let started_at = Utc::now();
        let result = strategy().fallback_session_id_lookup(std::path::Path::new("."), started_at);
        assert_eq!(result, None);
        unsafe {
            std::env::remove_var("OMNI_AGENT_CODEX_SESSIONS_DIR");
        }
    }

    #[test]
    fn fallback_returns_none_when_no_recent_files() {
        let tmp_dir = std::env::temp_dir().join(format!(
            "codex-test-old-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let file_path = tmp_dir.join("old-session.json");
        std::fs::write(&file_path, "{}").unwrap();

        unsafe {
            std::env::set_var("OMNI_AGENT_CODEX_SESSIONS_DIR", tmp_dir.to_str().unwrap());
        }

        // started_at is 5 minutes from now (file mtime is in the past)
        let started_at = Utc::now() + chrono::Duration::seconds(300);
        let result = strategy().fallback_session_id_lookup(std::path::Path::new("."), started_at);
        assert_eq!(result, None);

        unsafe {
            std::env::remove_var("OMNI_AGENT_CODEX_SESSIONS_DIR");
        }
        std::fs::remove_dir_all(&tmp_dir).ok();
    }

    #[test]
    fn fallback_picks_latest_mtime_among_multiple() {
        let tmp_dir = std::env::temp_dir().join(format!(
            "codex-test-multi-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        std::fs::create_dir_all(&tmp_dir).unwrap();

        // Create three session files
        for name in &[
            "sess-aaa-111111111",
            "sess-bbb-222222222",
            "sess-ccc-333333333",
        ] {
            let path = tmp_dir.join(format!("{}.json", name));
            std::fs::write(&path, "{}").unwrap();
            // Small sleep to ensure different mtime
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        unsafe {
            std::env::set_var("OMNI_AGENT_CODEX_SESSIONS_DIR", tmp_dir.to_str().unwrap());
        }

        let started_at = Utc::now() - chrono::Duration::seconds(1);
        let result = strategy().fallback_session_id_lookup(std::path::Path::new("."), started_at);
        // Should pick the latest file (sess-ccc-...)
        assert_eq!(result, Some("sess-ccc-333333333".to_string()));

        unsafe {
            std::env::remove_var("OMNI_AGENT_CODEX_SESSIONS_DIR");
        }
        std::fs::remove_dir_all(&tmp_dir).ok();
    }

    #[test]
    fn resume_command_with_comment_has_stdin_piped() {
        let s = CodexStrategy::default();
        unsafe {
            std::env::set_var("OMNI_AGENT_CODEX_BIN", "/tmp/mock-codex-test");
        }
        let cmd = s.resume_command("sess-uuid", Some("hello"));
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_program(), "/tmp/mock-codex-test");
        let args: Vec<&str> = std_cmd.get_args().map(|a| a.to_str().unwrap()).collect();
        assert_eq!(args, vec!["resume", "sess-uuid"]);
        unsafe {
            std::env::remove_var("OMNI_AGENT_CODEX_BIN");
        }
    }
}
