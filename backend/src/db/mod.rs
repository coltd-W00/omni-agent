use sqlx::SqlitePool;

pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::migrate!("src/db/migrations")
        .run(pool)
        .await
        .map_err(|e| anyhow::anyhow!("Migration failed: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::{Row, SqlitePool};

    use super::run_migrations;

    async fn migrated_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn migrations_are_idempotent() {
        let pool = migrated_pool().await;

        run_migrations(&pool).await.unwrap();
    }

    #[tokio::test]
    async fn schema_matches_story_contract() {
        let pool = migrated_pool().await;

        let table_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('projects', 'tasks', 'sessions', 'runs', 'comments')",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(table_count, 5);

        let project_columns: Vec<String> = sqlx::query("PRAGMA table_info(projects)")
            .fetch_all(&pool)
            .await
            .unwrap()
            .into_iter()
            .map(|row| row.get("name"))
            .collect();
        assert_eq!(
            project_columns,
            [
                "id",
                "name",
                "key",
                "created_at",
                "updated_at",
                "workspace_path"
            ]
        );

        let task_columns: Vec<String> = sqlx::query("PRAGMA table_info(tasks)")
            .fetch_all(&pool)
            .await
            .unwrap()
            .into_iter()
            .map(|row| row.get("name"))
            .collect();
        assert_eq!(
            task_columns,
            [
                "id",
                "project_id",
                "seq",
                "title",
                "description",
                "acceptance_criteria",
                "agent",
                "role",
                "status",
                "created_at",
                "updated_at"
            ]
        );

        let session_unique_indexes: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_index_list('sessions') WHERE origin = 'u'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(session_unique_indexes, 1);

        let sent_column = sqlx::query(
            "SELECT type, dflt_value FROM pragma_table_info('comments') WHERE name = 'sent'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(sent_column.get::<String, _>("type"), "INTEGER");
        assert_eq!(sent_column.get::<String, _>("dflt_value"), "0");

        // Verify UNIQUE(project_id, seq) index from migration 2
        let task_seq_unique: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_index_list('tasks') WHERE \"unique\" = 1 AND name = 'idx_tasks_project_id_seq'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            task_seq_unique, 1,
            "UNIQUE index on tasks(project_id, seq) should exist"
        );
    }
}
