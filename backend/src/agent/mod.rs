use std::path::Path;
use tokio::process::Command;
use chrono::{DateTime, Utc};
use crate::error::AppError;
use crate::models::task::Task;

pub trait AgentStrategy: Send + Sync + std::fmt::Debug {
    fn name(&self) -> &'static str;
    fn spawn_command(&self, task: &Task, log_path: &Path) -> Command;
    fn resume_command(&self, session_id: &str, comment: Option<&str>) -> Command;
    fn parse_session_id_chunk(&self, chunk: &str) -> Option<String>;
    fn fallback_session_id_lookup(
        &self,
        _cwd: &Path,
        _started_at: DateTime<Utc>,
    ) -> Option<String> {
        None
    }
}

pub mod claude;
pub mod codex;

pub fn strategy_for(agent: &str) -> Result<Box<dyn AgentStrategy>, AppError> {
    match agent {
        "claude" => Ok(Box::new(claude::ClaudeStrategy::default())),
        "codex" => Ok(Box::new(codex::CodexStrategy::default())),
        other => Err(AppError::BadRequest {
            code: "invalid_agent",
            message: format!("Agent must be one of: codex, claude (got: {})", other),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strategy_for_claude_returns_claude_strategy() {
        let strategy = strategy_for("claude").unwrap();
        assert_eq!(strategy.name(), "claude");
    }

    #[test]
    fn strategy_for_codex_returns_codex_strategy() {
        let strategy = strategy_for("codex").unwrap();
        assert_eq!(strategy.name(), "codex");
    }

    #[test]
    fn strategy_for_unknown_returns_bad_request() {
        let err = strategy_for("unknown").unwrap_err();
        match err {
            AppError::BadRequest { code, .. } => assert_eq!(code, "invalid_agent"),
            _ => panic!("expected BadRequest"),
        }
    }
}
