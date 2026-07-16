"use client";

import { cn } from "@/lib/utils";
import {
  Check,
  Circle,
  Rocket,
  Database,
  Server,
  Code2,
  Palette,
  Cloud,
  ShieldCheck,
  Bug,
  FileCog,
  Bot,
  Monitor,
  Smartphone,
  Boxes,
  GitBranch,
  Globe,
} from "lucide-react";

// Curated Lucide icons admins can attach to a milestone. The key is what gets
// stored on milestone.icon; MILESTONE_ICON_COMPONENTS resolves it for rendering.
export const MILESTONE_ICON_OPTIONS = [
  "Circle",
  "Rocket",
  "Database",
  "Server",
  "Code2",
  "Palette",
  "Cloud",
  "ShieldCheck",
  "Bug",
  "FileCog",
  "Bot",
  "Monitor",
  "Smartphone",
  "Boxes",
  "GitBranch",
  "Globe",
];

export const MILESTONE_ICON_LABELS = {
  FileCog: "Engine / backend",
  Bot: "Robot / AI",
  Monitor: "Frontend / screen",
  Smartphone: "Mobile app / view",
};

export const MILESTONE_ICON_COMPONENTS = {
  Circle,
  Rocket,
  Database,
  Server,
  Code2,
  Palette,
  Cloud,
  ShieldCheck,
  Bug,
  FileCog,
  Bot,
  Monitor,
  Smartphone,
  Boxes,
  GitBranch,
  Globe,
};

const TASK_DOT = {
  completed: "bg-[#FFB633]",
  in_progress: "bg-[#FFB633]/50 ring-2 ring-[#FFB633]/40",
  pending: "bg-white/15",
};

function nodeClasses(status) {
  if (status === "completed")
    return "bg-[#FFB633] text-black ring-[#0f0f10]";
  if (status === "in_progress")
    return "bg-[#FFB633]/20 text-[#FFB633] border-2 border-[#FFB633] ring-[#0f0f10] animate-pulse";
  return "bg-white/10 text-gray-500 ring-[#0f0f10]";
}

export function getMilestonePhase(milestone = {}) {
  const parsedPhaseNumber = Number(milestone.phaseNumber);
  const phaseNumber =
    Number.isFinite(parsedPhaseNumber) && parsedPhaseNumber > 0
      ? parsedPhaseNumber
      : 1;

  let phaseLabel = milestone.phaseLabel?.trim();
  if (!phaseLabel) {
    if (phaseNumber > 1) phaseLabel = `Faza ${phaseNumber}`;
    else if (milestone.proposalId) phaseLabel = "Master Proposal";
    else phaseLabel = "Master / Existing scope";
  }

  return { phaseNumber, phaseLabel };
}

/**
 * Horizontal milestone timeline (Flowbite-style, themed for DMDevelon).
 * Milestones are the big nodes; each milestone's tasks render as small dots
 * underneath. Connectors fill #FFB633 up to the last completed milestone.
 */
export function ProjectTimeline({
  milestones = [],
  selectedId,
  onSelect,
  showPhaseBadges = true,
}) {
  const items = milestones
    .map((milestone, originalIndex) => ({ milestone, originalIndex }))
    .sort((a, b) => {
      const aPhase = getMilestonePhase(a.milestone).phaseNumber;
      const bPhase = getMilestonePhase(b.milestone).phaseNumber;
      if (aPhase !== bPhase) return aPhase - bPhase;

      const aOrder = Number.isFinite(Number(a.milestone.order))
        ? Number(a.milestone.order)
        : 0;
      const bOrder = Number.isFinite(Number(b.milestone.order))
        ? Number(b.milestone.order)
        : 0;
      return aOrder - bOrder || a.originalIndex - b.originalIndex;
    })
    .map(({ milestone }) => milestone);

  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No milestones yet.</p>
    );
  }

  return (
    <ol className="items-center sm:flex">
      {items.map((m, i) => {
        const Icon = MILESTONE_ICON_COMPONENTS[m.icon] || Circle;
        const phase = getMilestonePhase(m);
        const nextPhase = items[i + 1]
          ? getMilestonePhase(items[i + 1])
          : null;
        const crossesPhase =
          nextPhase && nextPhase.phaseNumber !== phase.phaseNumber;
        const connectorActive =
          m.status === "completed" || items[i + 1]?.status === "completed";
        const isSelected = selectedId === m._id;
        const tasks = [...(m.tasks || [])].sort(
          (a, b) => (a.order || 0) - (b.order || 0),
        );
        return (
          <li key={m._id} className="relative mb-6 sm:mb-0 sm:flex-1">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect?.(m._id)}
                aria-current={isSelected ? "step" : undefined}
                className={cn(
                  "z-10 flex items-center justify-center w-9 h-9 rounded-full shrink-0 ring-4 transition-transform",
                  "hover:scale-110 focus:outline-none focus:ring-[#FFB633]/40",
                  nodeClasses(m.status),
                  isSelected && "scale-110 ring-[#FFB633]/40",
                )}
                title={m.title}
              >
                {m.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </button>
              {i < items.length - 1 && (
                <div
                  className={cn(
                    "hidden w-full sm:flex",
                    crossesPhase
                      ? "h-0 border-t border-dashed border-[#FFB633]/50 bg-transparent"
                      : connectorActive
                        ? "h-0.5 bg-[#FFB633]"
                        : "h-0.5 bg-white/10",
                  )}
                />
              )}
            </div>
            <div className="mt-3 sm:pe-8">
              <h3
                title={m.title}
                className={cn(
                  "text-sm font-semibold my-1 cursor-pointer truncate min-w-[125px] max-w-[200px]",
                  isSelected ? "text-[#FFB633]" : "text-white",
                )}
                onClick={() => onSelect?.(m._id)}
              >
                {m.title}
              </h3>
              {showPhaseBadges && (
                <span
                  title={`Phase ${phase.phaseNumber}: ${phase.phaseLabel}`}
                  className="inline-flex max-w-[200px] truncate rounded-full bg-[#FFB633]/10 px-2 py-0.5 text-[10px] font-medium text-[#FFB633]"
                >
                  {phase.phaseLabel}
                </span>
              )}
              {tasks.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {tasks.slice(0, 10).map((t) => (
                    <span
                      key={t._id}
                      title={`${t.title} — ${(t.status || "pending").replace("_", " ")}`}
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        TASK_DOT[t.status] || TASK_DOT.pending,
                      )}
                    />
                  ))}
                  {tasks.length > 10 && (
                    <span
                      title={`${tasks.length - 10} more task(s)`}
                      className="text-[10px] leading-none text-gray-500 ml-0.5 shrink-0"
                    >
                      +{tasks.length - 10}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default ProjectTimeline;
