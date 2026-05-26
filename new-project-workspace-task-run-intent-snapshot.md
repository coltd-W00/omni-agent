# Intent Snapshot

## Current Intent

- Add project-level workspace support so each project defines the filesystem path where assigned agents are allowed to execute tasks.
- Extend task creation so a specific agent can be assigned to the task.
- Allow the assigned agent to be updated after task creation.
- Add a real `Run` action for successfully created tasks.

## Desired Outcome

- Creating a new project includes setting a `workspace_path`.
- Every task inherits execution workspace from its parent project.
- Creating a new task includes selecting an assigned agent.
- Existing tasks expose an update path for changing the assigned agent.
- A task can be run only when it has an assigned agent.
- Pressing `Run` starts an async run/session record instead of blocking the UI.
- The assigned agent executes the task inside the project `workspace_path`.

## Boundaries to Keep

- Workspace is project-level only.
- Tasks do not override `workspace_path`.
- Running a task without an assigned agent is not allowed.
- Do not auto-pick a default agent when `Run` is pressed.
- `Run` should not be a purely visual button; it should start real execution behavior.
- Use an async run/session lifecycle rather than a blocking UI call.

## Confirmed Decisions

- Use `Project.workspace_path` as the single execution workspace for all tasks in that project.
- Require an assigned agent before a task can run.
- Implement `Run` by creating an async run/session record.

## Current Assumptions

- The app already has a project/task model or equivalent workflow.
- The app already has an agent list or agent identity concept that tasks can reference.
- The existing execution system can be adapted to run from a specified working directory.
- The run/session record can represent states such as `queued`, `running`, `succeeded`, and `failed`.
- Permission enforcement should align with the project `workspace_path`, but the exact enforcement mechanism is left for implementation discovery.

## Evaluation Criteria

- A user can create a project with a workspace path.
- A user can create a task and assign a concrete agent.
- A user can update the assigned agent after task creation.
- A task without an assigned agent cannot be run.
- A task with an assigned agent exposes a usable `Run` action.
- Running a task creates an async run/session record.
- Execution uses the parent project's workspace path.
- The UI makes the run state clear enough for the user to know whether the task is queued, running, succeeded, or failed.

## Open Points

- Exact validation rules for `workspace_path`, such as whether the path must already exist and whether it must be absolute.
- Exact run/session status model and where logs are displayed.
- Exact permission enforcement boundary for preventing execution outside the project workspace.
- Whether agent reassignment is allowed while a task is already running.

## Next Thinking Points

- Inspect the existing project, task, agent, and execution models before implementation.
- Identify whether the current app already has a run/session abstraction.
- Decide the smallest schema/API/UI change that supports the confirmed behavior.
- Add tests around task run eligibility, agent assignment updates, and workspace propagation into execution.
