import { z } from "zod";
import {
  lifecycleErrorResponse,
  lifecycleSuccessResponse,
  requireLifecycleAdmin,
} from "@/server/modules/projects/project-lifecycle-http";
import { assignClientProjectOwner } from "@/server/modules/projects/project-lifecycle";

const ownershipSchema = z
  .object({ ownerUserId: z.string().trim().min(1) })
  .strict();

export async function POST(request, context) {
  try {
    const actor = await requireLifecycleAdmin(request);
    const { id } = await context.params;
    const command = ownershipSchema.parse(await request.json());
    const result = await assignClientProjectOwner({
      projectId: id,
      ownerUserId: command.ownerUserId,
      actor,
    });
    return lifecycleSuccessResponse(result);
  } catch (error) {
    return lifecycleErrorResponse(error);
  }
}
