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
  Boxes,
  GitBranch,
  Globe,
} from "lucide-react";

// Curated Lucide icons admins can attach to a milestone. The key is what gets
// stored on milestone.icon; ICON_MAP resolves it for rendering.
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
  "Boxes",
  "GitBranch",
  "Globe",
];

const ICON_MAP = {
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

/**
 * Horizontal milestone timeline (Flowbite-style, themed for DMDevelon).
 * Milestones are the big nodes; each milestone's tasks render as small dots
 * underneath. Connectors fill #FFB633 up to the last completed milestone.
 */
export function ProjectTimeline({ milestones = [], selectedId, onSelect }) {
  const items = [...milestones].sort((a, b) => (a.order || 0) - (b.order || 0));

  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No milestones yet.</p>
    );
  }

  return (
    <ol className="items-center sm:flex">
      {items.map((m, i) => {
        const Icon = ICON_MAP[m.icon] || Circle;
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
                    "hidden sm:flex w-full h-0.5",
                    connectorActive ? "bg-[#FFB633]" : "bg-white/10",
                  )}
                />
              )}
            </div>
            <div className="mt-3 sm:pe-8">
              <h3
                className={cn(
                  "text-sm font-semibold my-1 cursor-pointer",
                  isSelected ? "text-[#FFB633]" : "text-white",
                )}
                onClick={() => onSelect?.(m._id)}
              >
                {m.title}
              </h3>
              {tasks.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {tasks.map((t) => (
                    <span
                      key={t._id}
                      title={`${t.title} — ${t.status.replace("_", " ")}`}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        TASK_DOT[t.status] || TASK_DOT.pending,
                      )}
                    />
                  ))}
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
