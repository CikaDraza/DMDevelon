#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { deterministicUuid } from "../lib/project-proposal-domain.mjs";

const SPECIAL_PROJECT_ID = "d9d435d4-ab36-41f1-93c5-7b435ce270d6";
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

// Existing process variables win; .env.local has precedence over .env.
loadEnvFile(resolve(rootDir, ".env.local"));
loadEnvFile(resolve(rootDir, ".env"));

const wantsApply = process.argv.includes("--apply");
const wantsDryRun = process.argv.includes("--dry-run");
if (wantsApply && wantsDryRun) {
  throw new Error("Use either --apply or --dry-run, not both");
}
const apply = wantsApply;

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plannerTasks(tasks, projectId, milestoneKey) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task, index) => ({
    _id:
      task?._id ||
      deterministicUuid(
        "proposal-migration",
        projectId,
        "milestone",
        milestoneKey,
        "task",
        index,
      ),
    title: String(task?.title || `Task ${index + 1}`),
    description: String(task?.description || ""),
    order: Number.isInteger(task?.order) ? task.order : index,
  }));
}

function plannerMilestones(milestones, projectId) {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((milestone, index) => {
    const milestoneKey = milestone?._id || `index:${index}`;
    return {
      _id:
        milestone?._id ||
        deterministicUuid(
          "proposal-migration",
          projectId,
          "milestone",
          index,
        ),
      title: String(milestone?.title || `Milestone ${index + 1}`),
      description: String(milestone?.description || ""),
      icon: String(milestone?.icon || "Circle"),
      githubBranch: String(milestone?.githubBranch || ""),
      order: Number.isInteger(milestone?.order) ? milestone.order : index,
      tasks: plannerTasks(milestone?.tasks, projectId, milestoneKey),
    };
  });
}

function legacyScope(project) {
  const description = String(project?.description || "").trim();
  const requirements = String(project?.requirements || "").trim();
  if (!requirements || requirements === description) return description || requirements;
  if (!description) return requirements;
  return `${description}\n\n## Original requirements\n\n${requirements}`;
}

function revisionHistory(revisions, projectId) {
  if (!Array.isArray(revisions)) return [];
  return revisions.map((revision, index) => ({
    kind: "master",
    phaseNumber: 1,
    phaseLabel: "Master Proposal",
    version:
      Number.isInteger(revision?.version) && revision.version > 0
        ? revision.version
        : index + 1,
    status: [
      "draft",
      "sent",
      "changes_requested",
      "accepted",
      "rejected",
      "archived",
    ].includes(revision?.status)
      ? revision.status
      : "sent",
    title: String(revision?.title || "Legacy proposal"),
    scope: String(revision?.scope || ""),
    timeline: String(revision?.timeline || ""),
    budget: String(revision?.budget || ""),
    milestonePlan: plannerMilestones(
      revision?.milestonePlan || revision?.milestones,
      `${projectId}:revision:${index}`,
    ),
    sentAt: dateOrNull(revision?.sentAt),
    capturedAt:
      dateOrNull(revision?.capturedAt) ||
      dateOrNull(revision?.sentAt) ||
      new Date(0),
    capturedByUserId: revision?.capturedByUserId || null,
  }));
}

function buildMasterProposal(project, request, proposalId) {
  const requestProposal = request?.proposal;
  const hasAcceptedRequestProposal =
    !!requestProposal &&
    (!!requestProposal.acceptedAt || request?.status === "approved");
  const source = hasAcceptedRequestProposal ? requestProposal : null;
  const sourcePlan =
    source?.milestonePlan?.length > 0
      ? source.milestonePlan
      : source?.milestones?.length > 0
        ? source.milestones
        : project.milestones || [];
  const now = new Date();

  return {
    _id: proposalId,
    projectId: project._id,
    requestId: project.requestId || null,
    clientUserId: project.clientUserId || request?.clientUserId || null,
    kind: "master",
    phaseNumber: 1,
    phaseLabel: "Master Proposal",
    title: String(source?.title || project.title || "Legacy project"),
    scope: String(source?.scope || legacyScope(project)),
    timeline: String(source?.timeline || ""),
    budget: String(source?.budget || ""),
    status: "accepted",
    version:
      Number.isInteger(source?.version) && source.version > 0
        ? source.version
        : 1,
    milestonePlan: plannerMilestones(sourcePlan, project._id),
    revisionHistory: revisionHistory(source?.revisionHistory, project._id),
    createdByUserId: source?.createdByUserId || null,
    sentAt: dateOrNull(source?.sentAt),
    acceptedAt:
      dateOrNull(source?.acceptedAt) ||
      dateOrNull(request?.updatedAt) ||
      dateOrNull(project.createdAt) ||
      now,
    rejectedAt: null,
    createdAt: dateOrNull(project.createdAt) || now,
    updatedAt: dateOrNull(project.updatedAt) || now,
  };
}

function tagMasterMilestones(milestones, proposalId) {
  let tagged = 0;
  const next = (Array.isArray(milestones) ? milestones : []).map((milestone) => {
    const belongsToMaster =
      !milestone?.proposalId || String(milestone.proposalId) === proposalId;
    if (!belongsToMaster) return milestone;

    const patch = {};
    if (!milestone.proposalId) patch.proposalId = proposalId;
    if (!Number.isInteger(milestone.phaseNumber) || milestone.phaseNumber < 1) {
      patch.phaseNumber = 1;
    }
    if (!milestone.phaseLabel) patch.phaseLabel = "Master Proposal";
    if (!Number.isInteger(milestone.revision) || milestone.revision < 1) {
      patch.revision = 1;
    }
    if (!Array.isArray(milestone.changeHistory)) patch.changeHistory = [];

    if (Object.keys(patch).length === 0) return milestone;
    tagged += 1;
    return { ...milestone, ...patch };
  });
  return { milestones: next, tagged };
}

async function findMasterProposal(projectProposals, project) {
  const byProject = await projectProposals.findOne({
    projectId: project._id,
    kind: "master",
  });
  if (byProject) return byProject;
  if (!project.requestId) return null;
  const byRequest = await projectProposals.findOne({
    requestId: project.requestId,
  });
  if (byRequest && byRequest.projectId !== project._id) {
    throw new Error(
      `requestId ${project.requestId} already belongs to project ${byRequest.projectId}`,
    );
  }
  return byRequest;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL is required");
  const dbName = process.env.DB_NAME || "portfolio_db";
  const client = new MongoClient(mongoUrl);
  const counters = {
    examined: 0,
    migrated: 0,
    skipped: 0,
    problematic: 0,
    proposalsCreated: 0,
    milestonesTagged: 0,
  };

  try {
    await client.connect();
    const db = client.db(dbName);
    const clientProjects = db.collection("clientprojects");
    const projectRequests = db.collection("projectrequests");
    const projectProposals = db.collection("projectproposals");
    const cursor = clientProjects.find({});

    for await (const project of cursor) {
      counters.examined += 1;
      try {
        const request = project.requestId
          ? await projectRequests.findOne({ _id: project.requestId })
          : null;
        const existingMaster = await findMasterProposal(
          projectProposals,
          project,
        );
        const proposalId =
          existingMaster?._id ||
          deterministicUuid("proposal-migration", "master", project._id);
        const { milestones, tagged } = tagMasterMilestones(
          project.milestones,
          proposalId,
        );
        const needsProposal = !existingMaster;

        if (!needsProposal && tagged === 0) {
          counters.skipped += 1;
          continue;
        }

        if (apply && needsProposal) {
          const proposal = buildMasterProposal(
            project,
            request,
            proposalId,
          );
          await projectProposals.updateOne(
            { projectId: project._id, kind: "master" },
            { $setOnInsert: proposal },
            { upsert: true },
          );
        }
        if (apply && tagged > 0) {
          await clientProjects.updateOne(
            { _id: project._id },
            { $set: { milestones } },
          );
        }

        counters.migrated += 1;
        if (needsProposal) counters.proposalsCreated += 1;
        counters.milestonesTagged += tagged;
      } catch (error) {
        counters.problematic += 1;
        console.error(
          JSON.stringify({ projectId: project._id, error: error.message }),
        );
      }
    }

    // This ID is intentionally used only for explicit post-migration reporting.
    const specialProject = await clientProjects.findOne({
      _id: SPECIAL_PROJECT_ID,
    });
    const specialMaster = specialProject
      ? await projectProposals.findOne({
          projectId: SPECIAL_PROJECT_ID,
          kind: "master",
        })
      : null;
    const specialUntagged = specialProject
      ? (specialProject.milestones || []).filter((milestone) => !milestone.proposalId)
          .length
      : 0;

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          ...counters,
          specialProjectVerification: {
            projectId: SPECIAL_PROJECT_ID,
            projectFound: !!specialProject,
            masterProposalFound: !!specialMaster,
            masterProposalWouldBeCreated:
              !apply && !!specialProject && !specialMaster,
            untaggedMilestones: specialUntagged,
            milestonesWouldBeTagged: !apply ? specialUntagged : 0,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
