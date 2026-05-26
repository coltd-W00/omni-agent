use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct Comment {
    pub id: String,
    pub task_id: String,
    pub content: String,
    pub sent: i64, // DB lưu INTEGER 0/1
    pub created_at: String,
}

impl Serialize for Comment {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct CommentWire<'a> {
            id: &'a str,
            task_id: &'a str,
            content: &'a str,
            sent: bool,
            created_at: &'a str,
        }
        CommentWire {
            id: &self.id,
            task_id: &self.task_id,
            content: &self.content,
            sent: self.sent != 0,
            created_at: &self.created_at,
        }
        .serialize(serializer)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentRequest {
    pub content: Option<String>,
}
