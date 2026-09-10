import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { ProjectLifecycleError } from "./project-lifecycle";

export async function requireLifecycleAdmin(request) {
  await connectDB();
  const actor = await getUserFromRequest(request);
  if (!actor) {
    throw new ProjectLifecycleError("Unauthorized", {
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  }
  if (actor.isAdmin !== true) {
    throw new ProjectLifecycleError("Forbidden", {
      code: "FORBIDDEN",
      statusCode: 403,
    });
  }
  return actor;
}

export function lifecycleErrorResponse(error) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }
  if (error instanceof ProjectLifecycleError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  console.error("project lifecycle command failed", error);
  return NextResponse.json(
    { error: "Project lifecycle command failed", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function lifecycleSuccessResponse(result) {
  return NextResponse.json({
    project: result.project,
    noOp: result.noOp,
    membershipTransitioned: result.membershipTransitioned,
    auditEventTypes: result.auditEventTypes,
  });
}
