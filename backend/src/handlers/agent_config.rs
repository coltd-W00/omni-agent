use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::error::AppError;
use crate::models::agent_config::{
    AgentConfig, AgentTestResult, CreateAgentRequest, UpdateAgentRequest,
};
use crate::services::agent_config;
use crate::state::AppState;

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AgentConfig>>, AppError> {
    Ok(Json(agent_config::list_agents(&state.agent_config_path)?))
}

pub async fn create_agent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateAgentRequest>,
) -> Result<(StatusCode, Json<AgentConfig>), AppError> {
    let agent = agent_config::create_agent(&state.agent_config_path, req)?;
    Ok((StatusCode::CREATED, Json(agent)))
}

pub async fn update_agent(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateAgentRequest>,
) -> Result<Json<AgentConfig>, AppError> {
    let agent = agent_config::update_agent(&state.agent_config_path, &name, req)?;
    Ok(Json(agent))
}

pub async fn delete_agent(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<StatusCode, AppError> {
    agent_config::delete_agent(&state.agent_config_path, &name)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn test_agent(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<AgentTestResult>, AppError> {
    Ok(Json(
        agent_config::test_agent(&state.agent_config_path, &name).await?,
    ))
}
