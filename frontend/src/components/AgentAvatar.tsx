import "./AgentAvatar.css";

type Runtime = "codex" | "claude" | undefined;
type AvatarSize = "sm" | "md" | "lg";

interface AgentAvatarProps {
  name: string;
  runtime?: Runtime;
  size?: AvatarSize;
}

function getInitials(name: string): string {
  const tokens = name.trim().split(/[\s\-_]+/).filter(Boolean).slice(0, 2);
  return tokens.map((t) => t[0]!.toUpperCase()).join("");
}

function nameToHue(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % 360;
  return hash;
}

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

const SIZE_FONT: Record<AvatarSize, number> = {
  sm: 10,
  md: 12,
  lg: 14,
};

const RUNTIME_LABEL: Record<NonNullable<Runtime>, string> = {
  codex: "Codex CLI",
  claude: "Claude CLI",
};

const RUNTIME_ICON: Record<NonNullable<Runtime>, string> = {
  codex: "⚙",
  claude: "✦",
};

export default function AgentAvatar({
  name,
  runtime,
  size = "md",
}: AgentAvatarProps) {
  const initials = getInitials(name);
  const hue = nameToHue(name);
  const diameter = SIZE_PX[size];
  const fontSize = SIZE_FONT[size];

  const ariaLabel = runtime
    ? `${name}, runtime: ${RUNTIME_LABEL[runtime]}`
    : name;

  return (
    <span
      className={`app-agent-avatar app-agent-avatar--${size}`}
      style={{
        width: diameter,
        height: diameter,
        fontSize,
        backgroundColor: `hsl(${hue}, 60%, 88%)`,
        color: `hsl(${hue}, 50%, 30%)`,
      }}
      aria-label={ariaLabel}
    >
      {initials}
      {runtime && (
        <span
          className={`app-agent-avatar__runtime app-agent-avatar__runtime--${runtime} app-agent-avatar__runtime--${size}`}
          aria-hidden="true"
        >
          {RUNTIME_ICON[runtime]}
        </span>
      )}
    </span>
  );
}
