import { useEffect, useMemo, useRef, useState } from "react";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../api/client";
import { useAddComment } from "../../hooks/useAddComment";
import { useCommentList } from "../../hooks/useCommentList";
import { useRunList } from "../../hooks/useRunList";
import type { Task } from "../../types/task";
import { buildChatTimeline, formatTokens, type ChatEvent } from "./chatTimeline";
import "./CommentsTabPanel.css";

interface CommentsTabPanelProps {
  task: Task;
  projectId: string;
  /**
   * When true, hide the inline composer (used on the full-page route
   * where a single follow-up prompt at the bottom of the page is the
   * only comment input).
   */
  hideComposer?: boolean;
}

function agentDisplayName(task: Task): string {
  if (task.agent === "claude") return "Claude";
  if (task.agent === "codex") return "Codex";
  if (task.agent) return task.agent;
  return "Agent";
}

function agentRuntime(task: Task): "claude" | "codex" | undefined {
  if (task.agent === "claude" || task.agent === "codex") return task.agent;
  return undefined;
}

export default function CommentsTabPanel({ task, projectId, hideComposer = false }: CommentsTabPanelProps) {
  const { showToast } = useToast();
  const commentsQuery = useCommentList(projectId, task.id);
  const runsQuery = useRunList(projectId, task.id, task.status);
  const addCommentMut = useAddComment(projectId, task.id);
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isTerminal = task.status === "completed" || task.status === "cancelled";
  const trimmed = inputText.trim();
  const isSubmitDisabled = isTerminal || trimmed.length === 0 || addCommentMut.isPending;

  const timeline = useMemo(
    () => buildChatTimeline(commentsQuery.data ?? [], runsQuery.data ?? []),
    [commentsQuery.data, runsQuery.data],
  );

  // Auto-scroll to the latest message when the timeline grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [timeline.events.length]);

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

  const isLoading = commentsQuery.isLoading || runsQuery.isLoading;
  const isError = commentsQuery.isError || runsQuery.isError;
  const isEmpty = !isLoading && !isError && timeline.events.length === 0;

  const agentName = agentDisplayName(task);
  const runtime = agentRuntime(task);

  return (
    <div className="comments-tab-panel chat-panel">
      <ChatTokenUsageStrip
        input={timeline.tokenUsage.input}
        output={timeline.tokenUsage.output}
        total={timeline.tokenUsage.total}
        cachedInput={timeline.tokenUsage.cachedInput}
        hasData={timeline.hasTokenData}
      />

      <div
        className="chat-panel__messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation between user and agent"
      >
        {isLoading && (
          <p className="comments-tab-panel__placeholder">Loading conversation…</p>
        )}
        {isError && (
          <div className="comments-tab-panel__error">
            <p>Could not load conversation.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void commentsQuery.refetch();
                void runsQuery.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {isEmpty && (
          <EmptyState
            variant="inline"
            icon="💬"
            heading="No messages yet"
            description="Comments you send and agent replies will appear here."
          />
        )}
        {!isLoading && !isError && timeline.events.length > 0 && (
          <ul className="comment-thread-list chat-thread-list" role="list">
            {timeline.events.map((event) => (
              <ChatMessage
                key={event.id}
                event={event}
                agentName={agentName}
                runtime={runtime}
              />
            ))}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!hideComposer && (
        <div className="comment-input-section chat-panel__composer">
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
            rows={3}
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
      )}
    </div>
  );
}

interface ChatMessageProps {
  event: ChatEvent;
  agentName: string;
  runtime: "claude" | "codex" | undefined;
}

function ChatMessage({ event, agentName, runtime }: ChatMessageProps) {
  const formattedTime = new Date(event.timestamp).toLocaleString();

  if (event.kind === "user") {
    const sentStatus = event.sent ? "sent" : "pending";
    return (
      <li
        className="comment-thread-item chat-msg chat-msg--user"
        aria-label={`Comment by You at ${formattedTime}, ${sentStatus}`}
      >
        <div className="comment-thread-header chat-msg__header">
          <AgentAvatar name="You" runtime="codex" size="sm" />
          <span className="comment-thread-author">You</span>
          <span className="comment-thread-timestamp">{formattedTime}</span>
        </div>
        <div className="comment-thread-content chat-msg__content">{event.content}</div>
        <div
          className={`comment-thread-status comment-thread-status--${sentStatus}`}
        >
          {event.sent ? "Sent to agent ✓" : "Pending · will be sent on next Resume"}
        </div>
      </li>
    );
  }

  return (
    <li
      className="comment-thread-item chat-msg chat-msg--agent"
      aria-label={`Reply from ${agentName} at ${formattedTime}`}
    >
      <div className="comment-thread-header chat-msg__header">
        <AgentAvatar name={agentName} runtime={runtime} size="sm" />
        <span className="comment-thread-author">{agentName}</span>
        {event.phase && (
          <span className="chat-msg__phase" title={`Phase: ${event.phase}`}>
            {event.phase.replace(/_/g, " ")}
          </span>
        )}
        <span className="comment-thread-timestamp">{formattedTime}</span>
      </div>
      <div className="comment-thread-content chat-msg__content">{event.content}</div>
      <div className="comment-thread-status chat-msg__run-tag">
        Run #{event.runNumber}
      </div>
    </li>
  );
}

interface ChatTokenUsageStripProps {
  input: number;
  output: number;
  total: number;
  cachedInput: number;
  hasData: boolean;
}

function ChatTokenUsageStrip({
  input,
  output,
  total,
  cachedInput,
  hasData,
}: ChatTokenUsageStripProps) {
  return (
    <div
      className="chat-token-usage"
      role="group"
      aria-label="Token usage"
      data-testid="chat-token-usage"
    >
      <TokenStat label="Total" value={total} hasData={hasData} />
      <TokenStat label="In" value={input} hasData={hasData} title={cachedInput > 0 ? `Cached: ${cachedInput.toLocaleString()}` : undefined} />
      <TokenStat label="Out" value={output} hasData={hasData} />
    </div>
  );
}

function TokenStat({
  label,
  value,
  hasData,
  title,
}: {
  label: string;
  value: number;
  hasData: boolean;
  title?: string;
}) {
  const display = hasData ? formatTokens(value) : "—";
  return (
    <div className="chat-token-usage__stat" title={title}>
      <span className="chat-token-usage__label">{label}</span>
      <span className="chat-token-usage__value">{display}</span>
    </div>
  );
}
