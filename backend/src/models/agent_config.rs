use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentProtocol {
    Claude,
    Codex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTestResult {
    pub ok: bool,
    pub message: String,
    pub tested_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub name: String,
    pub protocol: AgentProtocol,
    pub binary: String,
    pub enabled: bool,
    pub built_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_test: Option<AgentTestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfigFile {
    pub agents: Vec<AgentConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentRequest {
    pub name: String,
    pub protocol: AgentProtocol,
    pub binary: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentRequest {
    pub protocol: Option<AgentProtocol>,
    pub binary: String,
    pub enabled: bool,
}
