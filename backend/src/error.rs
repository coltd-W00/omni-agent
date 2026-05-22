use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{message}")]
    NotFound { code: &'static str, message: String },
    #[error("{message}")]
    BadRequest { code: &'static str, message: String },
    #[error("{message}")]
    Conflict { code: &'static str, message: String },
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            AppError::NotFound { code, message } => (StatusCode::NOT_FOUND, code, message),
            AppError::BadRequest { code, message } => (StatusCode::BAD_REQUEST, code, message),
            AppError::Conflict { code, message } => (StatusCode::CONFLICT, code, message),
            AppError::Internal(_err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "Internal server error".to_string(),
            ),
        };
        (status, Json(json!({"error": code, "message": message}))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Internal(anyhow::anyhow!(err))
    }
}
