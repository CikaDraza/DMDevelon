import { z } from "zod";
import {
  lifecycleErrorResponse,
  lifecycleSuccessResponse,
  requireLifecycleAdmin,
} from "@/server/modules/projects/project-lifecycle-http";
import {
  RESTORE_TARGET_STATUSES,
  restoreClientProject,
} from "@/server/modules/projects/project-lifecycle";

const restoreSchema = z
  .object({
    status: z.enum(RESTORE_TARGET_STATUSES),
    ownerUserId: z.string().trim().min(1).optional(),
  })
  .strict();

export async function POST(request, context) {
  try {
    const actor = await requireLifecycleAdmin(request);
    const { id } = await context.params;
    const command = restoreSchema.parse(await request.json());
    const result = await restoreClientProject({
      projectId: id,
      status: command.status,
      ownerUserId: command.ownerUserId,
      actor,
    });
    return lifecycleSuccessResponse(result);
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
