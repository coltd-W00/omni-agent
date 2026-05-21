# Stories

Stories là work packets. Chúng biến product intent thành implementation và
validation work có giới hạn.

Hiện chưa có story packets active.

## Normal Story

Dùng `docs/templates/story.md` cho normal feature work.

Suggested path:

```text
docs/stories/epics/E01-domain-name/US-001-short-story-title.md
```

## High-Risk Story

Dùng `docs/templates/high-risk-story/` khi feature intake phân loại công việc là
high-risk.

Suggested path:

```text
docs/stories/epics/E02-risky-domain/US-012-risky-story-title/
  execplan.md
  overview.md
  design.md
  validation.md
```

## Status Flow

```text
planned -> in_progress -> implemented
                  |
                  v
               changed
                  |
                  v
               retired
```
