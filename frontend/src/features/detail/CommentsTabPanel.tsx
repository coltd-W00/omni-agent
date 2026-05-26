import { useRef, useState } from "react";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../api/client";
import { useAddComment } from "../../hooks/useAddComment";
import { useCommentList } from "../../hooks/useCommentList";
import type { Task } from "../../types/task";
import "./CommentsTabPanel.css";

interface CommentsTabPanelProps {
  task: Task;
  projectId: string;
}

export default function CommentsTabPanel({ task, projectId }: CommentsTabPanelProps) {
  const { showToast } = useToast();
  const commentsQuery = useCommentList(projectId, task.id);
  const addCommentMut = useAddComment(projectId, task.id);
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTerminal = task.status === "completed" || task.status === "cancelled";
  const trimmed = inputText.trim();
  const isSubmitDisabled = isTerminal || trimmed.length === 0 || addCommentMut.isPending;

  const handleAddComment = () => {
    if (trimmed.length === 0) {
      showToast({ tone: "warning", message: "Comment cannot be empty" });
      return;
    }

    addCommentMut.mutate(trimmed, {
      onSuccess: () => {
        setInputText("");
        showToast({ tone: "success", message: "Comment added" });
        textareaRef.current?.focus();
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : "Failed to add comment";
        const tone = err instanceof ApiError && err.code === "task_terminal" ? "warning" : "error";
        showToast({ tone, message });
      },
    });
  };

  const placeholder = isTerminal
    ? `Comments disabled — task is ${task.status}.`
    : "Add a comment or instruction for the agent...";

  return (
    <div className="comments-tab-panel">
      {commentsQuery.isLoading && <p className="comments-tab-panel__placeholder">Loading comments…</p>}
      {commentsQuery.isError && (
        <div className="comments-tab-panel__error">
          <p>Could not load comments.</p>
          <Button variant="ghost" size="sm" onClick={() => void commentsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!commentsQuery.isLoading && !commentsQuery.isError && commentsQuery.data?.length === 0 && (
        <EmptyState
          variant="inline"
          icon="💬"
          heading="No comments yet"
          description="Comments and instructions sent to the agent will appear here."
        />
      )}
      {!commentsQuery.isLoading && !commentsQuery.isError && commentsQuery.data && commentsQuery.data.length > 0 && (
        <ul className="comment-thread-list" role="list">
          {commentsQuery.data.map((comment) => {
            const formattedTime = new Date(comment.createdAt).toLocaleString();
            const sentStatus = comment.sent ? "sent" : "pending";
            return (
              <li
                key={comment.id}
                className="comment-thread-item"
                aria-label={`Comment by You at ${formattedTime}, ${sentStatus}`}
              >
                <div className="comment-thread-header">
                  <AgentAvatar name="You" runtime="codex" size="sm" />
                  <span className="comment-thread-author">You</span>
                  <span className="comment-thread-timestamp">{formattedTime}</span>
                </div>
                <div className="comment-thread-content">{comment.content}</div>
                <div
                  className={`comment-thread-status comment-thread-status--${comment.sent ? "sent" : "pending"}`}
                >
                  {comment.sent ? "Sent to agent ✓" : "Pending · will be sent on next Resume"}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="comment-input-section">
        <label className="comment-input-label" htmlFor="new-comment">
          New comment
        </label>
        <textarea
          id="new-comment"
          ref={textareaRef}
          className="comment-input-textarea"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={isTerminal || addCommentMut.isPending}
          aria-label="New comment"
        />
        <p className="comment-input-hint">This comment will be sent to the agent on next resume.</p>
        <Button
          variant="primary"
          size="md"
          onClick={handleAddComment}
          disabled={isSubmitDisabled}
          aria-disabled={isSubmitDisabled}
        >
          {addCommentMut.isPending ? "Adding…" : "Add Comment"}
        </Button>
      </div>
    </div>
  );
}
