use std::path::Path;
use std::process::Stdio;
use chrono::{DateTime, Utc};
use tokio::process::Command;

use super::AgentStrategy;
use crate::models::task::Task;

#[derive(Debug, Default)]
pub struct ClaudeStrategy;

impl AgentStrategy for ClaudeStrategy {
    fn name(&self) -> &'static str {
        "claude"
    }

    fn spawn_command(&self, _task: &Task, _log_path: &Path) -> Command {
        let binary = std::env::var("OMNI_AGENT_CLAUDE_BIN")
            .unwrap_or_else(|_| "claude".to_string());
        let mut cmd = Command::new(binary);
        cmd.kill_on_drop(true);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd
    }

    fn resume_command(&self, session_id: &str, comment: Option<&str>) -> Command {
        let binary = std::env::var("OMNI_AGENT_CLAUDE_BIN")
            .unwrap_or_else(|_| "claude".to_string());
        let mut cmd = Command::new(binary);
        cmd.arg("--continue").arg("--session-id").arg(session_id);
        cmd.kill_on_drop(true);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        let _ = comment;
        cmd
    }

    fn parse_session_id_chunk(&self, chunk: &str) -> Option<String> {
        for line in chunk.lines() {
            if line.is_empty() {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(s) = value.get("session_id").and_then(|v| v.as_str()) {
                    return Some(s.to_string());
                }
            }
        }
        None
    }

    fn fallback_session_id_lookup(&self, _cwd: &Path, _started_at: DateTime<Utc>) -> Option<String> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strategy() -> ClaudeStrategy {
        ClaudeStrategy::default()
    }

    #[test]
    fn name_is_claude() {
        assert_eq!(strategy().name(), "claude");
    }

    #[test]
    fn parse_returns_some_when_json_has_session_id() {
        let input = r#"{"session_id":"abc-123","type":"start"}"#;
        assert_eq!(strategy().parse_session_id_chunk(input), Some("abc-123".to_string()));
    }

    #[test]
    fn parse_returns_none_when_no_session_id() {
        let input = r#"{"type":"start"}"#;
        assert_eq!(strategy().parse_session_id_chunk(input), None);
    }

    #[test]
    fn parse_returns_none_when_not_json() {
        let input = "hello world session_id=foo";
        assert_eq!(strategy().parse_session_id_chunk(input), None);
    }

    #[test]
    fn parse_handles_multiple_lines() {
        let input = "not json\n{\"session_id\":\"xyz-456\",\"type\":\"start\"}";
        assert_eq!(strategy().parse_session_id_chunk(input), Some("xyz-456".to_string()));
    }

    #[test]
    fn parse_handles_session_id_in_first_match() {
        let input = "{\"session_id\":\"first-id\"}\n{\"session_id\":\"second-id\"}";
        assert_eq!(strategy().parse_session_id_chunk(input), Some("first-id".to_string()));
    }

    #[test]
    fn spawn_command_uses_env_override_when_set() {
        // SAFETY: test-only env manipulation, no threads at this point
        unsafe { std::env::set_var("OMNI_AGENT_CLAUDE_BIN", "/tmp/mock-claude-test"); }
        let cmd = strategy().spawn_command(
            &crate::models::task::Task {
                id: "T".to_string(),
                project_id: "P".to_string(),
                seq: 1,
                title: "t".to_string(),
                description: "d".to_string(),
                acceptance_criteria: None,
                agent: Some("claude".to_string()),
                role: None,
                status: "Assigned".to_string(),
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
            std::path::Path::new("/tmp/log.log"),
        );
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_program(), "/tmp/mock-claude-test");
        unsafe { std::env::remove_var("OMNI_AGENT_CLAUDE_BIN"); }
    }
}
