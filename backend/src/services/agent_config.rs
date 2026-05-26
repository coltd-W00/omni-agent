use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::error::AppError;
use crate::models::agent_config::{
    AgentConfig, AgentConfigFile, AgentProtocol, AgentTestResult, CreateAgentRequest,
    UpdateAgentRequest,
};

pub fn default_config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".omni-agent").join("config.json")
}

fn default_agents() -> Vec<AgentConfig> {
    vec![
        AgentConfig {
            name: "claude".to_string(),
            protocol: AgentProtocol::Claude,
            binary: "claude".to_string(),
            enabled: true,
            built_in: true,
            last_test: None,
        },
        AgentConfig {
            name: "codex".to_string(),
            protocol: AgentProtocol::Codex,
            binary: "codex".to_string(),
            enabled: true,
            built_in: true,
            last_test: None,
        },
    ]
}

fn normalize_config(mut config: AgentConfigFile) -> AgentConfigFile {
    for builtin in default_agents() {
        if let Some(agent) = config
            .agents
            .iter_mut()
            .find(|agent| agent.name == builtin.name)
        {
            agent.protocol = builtin.protocol;
            agent.built_in = true;
        } else {
            config.agents.push(builtin);
        }
    }
    config
        .agents
        .sort_by_key(|agent| (!agent.built_in, agent.name.clone()));
    config
}

fn read_config_unpersisted(path: &Path) -> Result<AgentConfigFile, AppError> {
    if !path.exists() {
        return Ok(AgentConfigFile {
            agents: default_agents(),
        });
    }

    let text = std::fs::read_to_string(path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read agent config: {}", e)))?;
    let config: AgentConfigFile =
        serde_json::from_str(&text).map_err(|e| AppError::BadRequest {
            code: "invalid_agent_config",
            message: format!("Agent config is not valid JSON: {}", e),
        })?;
    Ok(normalize_config(config))
}

pub fn read_config(path: &Path) -> Result<AgentConfigFile, AppError> {
    let config = read_config_unpersisted(path)?;
    write_config(path, &config)?;
    Ok(config)
}

pub fn write_config(path: &Path, config: &AgentConfigFile) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to create agent config dir: {}", e))
        })?;
    }

    let tmp_path = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize config: {}", e)))?;
    std::fs::write(&tmp_path, text)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write agent config: {}", e)))?;
    std::fs::rename(&tmp_path, path).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to replace agent config: {}", e))
    })?;
    Ok(())
}

fn validate_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty()
        || name.len() > 40
        || !name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return Err(AppError::BadRequest {
            code: "invalid_agent_name",
            message: "Agent name must be 1–40 characters using letters, digits, - or _".to_string(),
        });
    }
    Ok(name.to_string())
}

fn validate_binary(binary: &str) -> Result<String, AppError> {
    let binary = binary.trim();
    if binary.is_empty() {
        return Err(AppError::BadRequest {
            code: "invalid_agent_binary",
            message: "Binary path is required".to_string(),
        });
    }
    Ok(binary.to_string())
}

pub fn list_agents(path: &Path) -> Result<Vec<AgentConfig>, AppError> {
    Ok(read_config(path)?.agents)
}

pub fn get_agent(path: &Path, name: &str) -> Result<AgentConfig, AppError> {
    let config = read_config(path)?;
    config
        .agents
        .into_iter()
        .find(|agent| agent.name == name)
        .ok_or_else(|| AppError::BadRequest {
            code: "invalid_agent",
            message: format!("Agent '{}' does not exist", name),
        })
}

pub fn enabled_agent(path: &Path, name: &str) -> Result<AgentConfig, AppError> {
    let config = read_config(path)?;
    let agent = config
        .agents
        .into_iter()
        .find(|agent| agent.name == name && agent.enabled)
        .ok_or_else(|| AppError::BadRequest {
            code: "invalid_agent",
            message: format!("Agent '{}' is not enabled", name),
        })?;
    Ok(agent)
}

pub fn create_agent(path: &Path, req: CreateAgentRequest) -> Result<AgentConfig, AppError> {
    let mut config = read_config(path)?;
    let name = validate_name(&req.name)?;
    let binary = validate_binary(&req.binary)?;

    if config.agents.iter().any(|agent| agent.name == name) {
        return Err(AppError::Conflict {
            code: "agent_exists",
            message: format!("Agent '{}' already exists", name),
        });
    }

    let agent = AgentConfig {
        name,
        protocol: req.protocol,
        binary,
        enabled: true,
        built_in: false,
        last_test: None,
    };
    config.agents.push(agent.clone());
    config = normalize_config(config);
    write_config(path, &config)?;
    Ok(agent)
}

pub fn update_agent(
    path: &Path,
    name: &str,
    req: UpdateAgentRequest,
) -> Result<AgentConfig, AppError> {
    let mut config = read_config(path)?;
    let binary = validate_binary(&req.binary)?;
    let agent = config
        .agents
        .iter_mut()
        .find(|agent| agent.name == name)
        .ok_or_else(|| AppError::NotFound {
            code: "agent_not_found",
            message: format!("Agent '{}' does not exist", name),
        })?;

    if !agent.built_in
        && let Some(protocol) = req.protocol
    {
        agent.protocol = protocol;
    }
    if agent.binary != binary {
        agent.last_test = None;
    }
    agent.binary = binary;
    agent.enabled = req.enabled;
    let updated = agent.clone();
    write_config(path, &config)?;
    Ok(updated)
}

pub fn delete_agent(path: &Path, name: &str) -> Result<(), AppError> {
    let mut config = read_config(path)?;
    let agent = config
        .agents
        .iter()
        .find(|agent| agent.name == name)
        .ok_or_else(|| AppError::NotFound {
            code: "agent_not_found",
            message: format!("Agent '{}' does not exist", name),
        })?;
    if agent.built_in {
        return Err(AppError::Conflict {
            code: "built_in_agent",
            message: "Built-in agents cannot be deleted".to_string(),
        });
    }
    config.agents.retain(|agent| agent.name != name);
    write_config(path, &config)?;
    Ok(())
}

pub async fn test_agent(path: &Path, name: &str) -> Result<AgentTestResult, AppError> {
    let config = read_config(path)?;
    let agent = config
        .agents
        .iter()
        .find(|agent| agent.name == name)
        .cloned()
        .ok_or_else(|| AppError::NotFound {
            code: "agent_not_found",
            message: format!("Agent '{}' does not exist", name),
        })?;

    let mut cmd = Command::new(&agent.binary);
    cmd.kill_on_drop(true);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let result = match cmd.spawn() {
        Ok(mut child) => {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(b"ping\n").await;
                let _ = stdin.shutdown().await;
            }
            match tokio::time::timeout(Duration::from_secs(15), child.wait_with_output()).await {
                Ok(Ok(output)) => {
                    let text = String::from_utf8_lossy(if output.stdout.is_empty() {
                        &output.stderr
                    } else {
                        &output.stdout
                    });
                    let first_line = text.lines().next().unwrap_or("").trim();
                    AgentTestResult {
                        ok: output.status.success(),
                        message: if first_line.is_empty() {
                            format!("Process exited with status {}", output.status)
                        } else {
                            first_line.to_string()
                        },
                        tested_at: chrono::Utc::now().to_rfc3339(),
                    }
                }
                Ok(Err(e)) => AgentTestResult {
                    ok: false,
                    message: format!("Test failed: {}", e),
                    tested_at: chrono::Utc::now().to_rfc3339(),
                },
                Err(_) => AgentTestResult {
                    ok: false,
                    message: "Test timed out after 15s".to_string(),
                    tested_at: chrono::Utc::now().to_rfc3339(),
                },
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => AgentTestResult {
            ok: false,
            message: "Agent binary not found".to_string(),
            tested_at: chrono::Utc::now().to_rfc3339(),
        },
        Err(e) => AgentTestResult {
            ok: false,
            message: format!("Failed to spawn agent: {}", e),
            tested_at: chrono::Utc::now().to_rfc3339(),
        },
    };

    let mut updated = read_config(path)?;
    if let Some(agent) = updated.agents.iter_mut().find(|agent| agent.name == name) {
        agent.last_test = Some(result.clone());
    }
    write_config(path, &updated)?;
    Ok(result)
}
