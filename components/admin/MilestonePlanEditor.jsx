"use client";

import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MILESTONE_ICON_OPTIONS } from "@/components/ui/project-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";

const ITEM_STATUSES = ["pending", "in_progress", "completed"];

function createLocalId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyTask(order = 0) {
  return {
    _id: createLocalId(),
    title: "",
    description: "",
    status: "pending",
    order,
  };
}

export function createEmptyMilestone(order = 0) {
  return {
    _id: createLocalId(),
    title: "",
    description: "",
    icon: "Circle",
    githubBranch: "",
    status: "pending",
    order,
    tasks: [],
  };
}

/**
 * Clone a plan, preserve existing ids, create ids only where they are missing,
 * and make both milestone and task order values deterministic.
 */
export function normalizeMilestonePlan(plan = []) {
  return (Array.isArray(plan) ? plan : []).map((milestone, milestoneIndex) => ({
    ...milestone,
    _id: milestone?._id || createLocalId(),
    title: milestone?.title || "",
    description: milestone?.description || "",
    icon: milestone?.icon || "Circle",
    githubBranch: milestone?.githubBranch || "",
    status: milestone?.status || "pending",
    order: milestoneIndex,
    tasks: (Array.isArray(milestone?.tasks) ? milestone.tasks : []).map(
      (task, taskIndex) => ({
        ...task,
        _id: task?._id || createLocalId(),
        title: task?.title || "",
        description: task?.description || "",
        status: task?.status || "pending",
        order: taskIndex,
      }),
    ),
  }));
}

/**
 * Validation is exported so a parent dialog/form can block its own submit.
 * `byPath` is convenient for inline errors; `errors` is useful for summaries.
 */
export function validateMilestonePlan(plan = []) {
  const errors = [];
  const byPath = {};
  const milestones = Array.isArray(plan) ? plan : [];

  const addError = (path, message) => {
    if (!byPath[path]) byPath[path] = message;
    errors.push({ path, message });
  };

  const milestoneOrders = new Set();
  milestones.forEach((milestone, milestoneIndex) => {
    const milestonePath = `milestones.${milestoneIndex}`;
    if (!milestone?.title?.trim()) {
      addError(`${milestonePath}.title`, "Milestone title is required.");
    }

    const milestoneOrder = Number(milestone?.order);
    if (milestoneOrders.has(milestoneOrder)) {
      addError(`${milestonePath}.order`, "Milestone order values must be unique.");
    }
    milestoneOrders.add(milestoneOrder);

    const taskOrders = new Set();
    const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
    tasks.forEach((task, taskIndex) => {
      const taskPath = `${milestonePath}.tasks.${taskIndex}`;
      if (!task?.title?.trim()) {
        addError(`${taskPath}.title`, "Task title is required.");
      }

      const taskOrder = Number(task?.order);
      if (taskOrders.has(taskOrder)) {
        addError(`${taskPath}.order`, "Task order values must be unique.");
      }
      taskOrders.add(taskOrder);
    });
  });

  return { valid: errors.length === 0, errors, byPath };
}

function moveItem(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Controlled editor shared by proposal plans and live milestone editing.
 * In `plan` mode status controls stay hidden. `operational` mode exposes them.
 */
export function MilestonePlanEditor({
  value = [],
  onChange,
  mode = "plan",
  readOnly = false,
  disabled = false,
  onValidationChange,
  className,
  addMilestoneLabel = "Milestone",
  allowAddMilestones = true,
  allowRemoveMilestones = true,
  heading = "Milestones & tasks",
  description,
}) {
  const milestones = Array.isArray(value) ? value : [];
  const locked = readOnly || disabled;
  const showStatuses = mode === "operational";
  const validation = useMemo(
    () => validateMilestonePlan(milestones),
    [milestones],
  );

  useEffect(() => {
    onValidationChange?.(validation);
  }, [onValidationChange, validation]);

  const emit = (next) => onChange?.(next);

  const addMilestone = () => {
    emit([...milestones, createEmptyMilestone(milestones.length)]);
  };

  const updateMilestone = (milestoneIndex, patch) => {
    emit(
      milestones.map((milestone, index) =>
        index === milestoneIndex ? { ...milestone, ...patch } : milestone,
      ),
    );
  };

  const removeMilestone = (milestoneIndex) => {
    emit(
      normalizeMilestonePlan(
        milestones.filter((_, index) => index !== milestoneIndex),
      ),
    );
  };

  const moveMilestone = (milestoneIndex, direction) => {
    emit(normalizeMilestonePlan(moveItem(milestones, milestoneIndex, direction)));
  };

  const addTask = (milestoneIndex) => {
    const milestone = milestones[milestoneIndex];
    const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
    updateMilestone(milestoneIndex, {
      tasks: [...tasks, createEmptyTask(tasks.length)],
    });
  };

  const updateTask = (milestoneIndex, taskIndex, patch) => {
    const milestone = milestones[milestoneIndex];
    const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
    updateMilestone(milestoneIndex, {
      tasks: tasks.map((task, index) =>
        index === taskIndex ? { ...task, ...patch } : task,
      ),
    });
  };

  const removeTask = (milestoneIndex, taskIndex) => {
    const milestone = milestones[milestoneIndex];
    const tasks = (milestone?.tasks || []).filter(
      (_, index) => index !== taskIndex,
    );
    updateMilestone(milestoneIndex, {
      tasks: tasks.map((task, index) => ({ ...task, order: index })),
    });
  };

  const moveTask = (milestoneIndex, taskIndex, direction) => {
    const milestone = milestones[milestoneIndex];
    const tasks = moveItem(milestone?.tasks || [], taskIndex, direction).map(
      (task, index) => ({ ...task, order: index }),
    );
    updateMilestone(milestoneIndex, { tasks });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-white">{heading}</Label>
          <p className="mt-0.5 text-xs text-gray-500">
            {description ||
              (showStatuses
                ? "Edit the live milestone structure and statuses."
                : "Plan the work that will be created after acceptance.")}
          </p>
        </div>
        {!readOnly && allowAddMilestones && (
          <Button
            type="button"
            onClick={addMilestone}
            disabled={locked}
            variant="outline"
            size="sm"
            className="border-white/20 text-gray-300 hover:text-white"
          >
            <Plus className="mr-1 h-4 w-4" /> {addMilestoneLabel}
          </Button>
        )}
      </div>

      {milestones.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
          No milestones in this plan yet.
        </div>
      )}

      {milestones.map((milestone, milestoneIndex) => {
        const milestonePath = `milestones.${milestoneIndex}`;
        const tasks = Array.isArray(milestone.tasks) ? milestone.tasks : [];

        return (
          <div
            key={milestone._id || `milestone-${milestoneIndex}`}
            className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-start gap-2">
              <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-gray-600" />
              <div className="min-w-0 flex-1">
                <Input
                  value={milestone.title || ""}
                  onChange={(event) =>
                    updateMilestone(milestoneIndex, {
                      title: event.target.value,
                    })
                  }
                  disabled={locked}
                  placeholder={`Milestone ${milestoneIndex + 1} title`}
                  aria-invalid={!!validation.byPath[`${milestonePath}.title`]}
                  className="bg-white/5 border-white/10 text-white"
                />
                {validation.byPath[`${milestonePath}.title`] && (
                  <p className="mt-1 text-xs text-red-400">
                    {validation.byPath[`${milestonePath}.title`]}
                  </p>
                )}
                {validation.byPath[`${milestonePath}.order`] && (
                  <p className="mt-1 text-xs text-red-400">
                    {validation.byPath[`${milestonePath}.order`]}
                  </p>
                )}
              </div>

              {!readOnly && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => moveMilestone(milestoneIndex, -1)}
                    disabled={locked || milestoneIndex === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    aria-label={`Move ${milestone.title || "milestone"} up`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMilestone(milestoneIndex, 1)}
                    disabled={locked || milestoneIndex === milestones.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    aria-label={`Move ${milestone.title || "milestone"} down`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {allowRemoveMilestones && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(milestoneIndex)}
                      disabled={locked}
                      className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-30"
                      aria-label={`Remove ${milestone.title || "milestone"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div
              className={cn(
                "grid grid-cols-1 gap-2",
                showStatuses ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              <Select
                value={milestone.icon || "Circle"}
                onValueChange={(icon) =>
                  updateMilestone(milestoneIndex, { icon })
                }
                disabled={locked}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Icon" />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_ICON_OPTIONS.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {showStatuses && (
                <Select
                  value={milestone.status || "pending"}
                  onValueChange={(status) =>
                    updateMilestone(milestoneIndex, { status })
                  }
                  disabled={locked}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Input
                value={milestone.githubBranch || ""}
                onChange={(event) =>
                  updateMilestone(milestoneIndex, {
                    githubBranch: event.target.value,
                  })
                }
                disabled={locked}
                placeholder="git branch"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <Textarea
              value={milestone.description || ""}
              onChange={(event) =>
                updateMilestone(milestoneIndex, {
                  description: event.target.value,
                })
              }
              disabled={locked}
              rows={2}
              placeholder="What this part covers…"
              className="bg-white/5 border-white/10 text-white"
            />

            <div className="space-y-2 border-l border-white/10 pl-4">
              {tasks.map((task, taskIndex) => {
                const taskPath = `${milestonePath}.tasks.${taskIndex}`;
                return (
                  <div
                    key={task._id || `task-${milestoneIndex}-${taskIndex}`}
                    className="rounded-lg border border-white/5 bg-black/10 p-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          value={task.title || ""}
                          onChange={(event) =>
                            updateTask(milestoneIndex, taskIndex, {
                              title: event.target.value,
                            })
                          }
                          disabled={locked}
                          placeholder={`Task ${taskIndex + 1} title`}
                          aria-invalid={!!validation.byPath[`${taskPath}.title`]}
                          className="bg-white/5 border-white/10 text-white"
                        />
                        <Input
                          value={task.description || ""}
                          onChange={(event) =>
                            updateTask(milestoneIndex, taskIndex, {
                              description: event.target.value,
                            })
                          }
                          disabled={locked}
                          placeholder="Task description (optional)"
                          className="bg-white/5 border-white/10 text-white"
                        />
                        {validation.byPath[`${taskPath}.title`] && (
                          <p className="text-xs text-red-400">
                            {validation.byPath[`${taskPath}.title`]}
                          </p>
                        )}
                        {validation.byPath[`${taskPath}.order`] && (
                          <p className="text-xs text-red-400">
                            {validation.byPath[`${taskPath}.order`]}
                          </p>
                        )}
                      </div>

                      {showStatuses && (
                        <Select
                          value={task.status || "pending"}
                          onValueChange={(status) =>
                            updateTask(milestoneIndex, taskIndex, { status })
                          }
                          disabled={locked}
                        >
                          <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {!readOnly && (
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            onClick={() => moveTask(milestoneIndex, taskIndex, -1)}
                            disabled={locked || taskIndex === 0}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                            aria-label={`Move ${task.title || "task"} up`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTask(milestoneIndex, taskIndex, 1)}
                            disabled={locked || taskIndex === tasks.length - 1}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                            aria-label={`Move ${task.title || "task"} down`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTask(milestoneIndex, taskIndex)}
                            disabled={locked}
                            className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-30"
                            aria-label={`Remove ${task.title || "task"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => addTask(milestoneIndex)}
                  disabled={locked}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <Plus className="mr-1 h-4 w-4" /> Task
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MilestonePlanEditor;
