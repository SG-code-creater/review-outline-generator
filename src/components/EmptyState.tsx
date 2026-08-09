"use client";

type Accent = "teal" | "purple" | "coral" | "emerald" | "amber" | "blue";

// 各主题色对应的 hex 与低透明度背景（用于图标圈）
const ACCENTS: Record<Accent, { solid: string; soft: string; glow: string }> = {
  teal:    { solid: "#2dd4bf", soft: "rgba(45,212,191,0.12)",  glow: "rgba(45,212,191,0.22)" },
  emerald: { solid: "#34d399", soft: "rgba(52,211,153,0.12)",  glow: "rgba(52,211,153,0.22)" },
  purple:  { solid: "#a78bfa", soft: "rgba(167,139,250,0.12)", glow: "rgba(167,139,250,0.22)" },
  amber:   { solid: "#fbbf24", soft: "rgba(251,191,36,0.12)",  glow: "rgba(251,191,36,0.22)" },
  coral:   { solid: "#fb7185", soft: "rgba(251,113,133,0.12)", glow: "rgba(251,113,133,0.22)" },
  blue:    { solid: "#60a5fa", soft: "rgba(96,165,250,0.12)",  glow: "rgba(96,165,250,0.22)" },
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  accent?: Accent;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  accent = "teal",
  action,
  compact = false,
}: EmptyStateProps) {
  const a = ACCENTS[accent];
  return (
    <div
      className="glass-card flex flex-col items-center gap-3 text-center"
      style={{
        padding: compact ? "1.25rem" : "2rem",
        borderColor: "var(--glass-border)",
      }}
    >
      {icon && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
          style={{
            background: a.soft,
            color: a.solid,
            boxShadow: `0 0 24px ${a.glow}`,
          }}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary-glow mt-1 px-4 py-2 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
