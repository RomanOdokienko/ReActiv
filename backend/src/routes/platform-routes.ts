import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import {
  getPlatformMode,
  setPlatformMode,
} from "../repositories/platform-settings-repository";

const updatePlatformModeSchema = z.object({
  mode: z.enum(["closed", "open"]),
});

function rejectIfNotAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (request.authUser?.role === "admin") {
    return false;
  }

  void reply.code(403).send({ message: "Forbidden" });
  return true;
}

export async function registerPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/platform/mode", async (_request, reply) => {
    return reply.code(200).send({ mode: getPlatformMode() });
  });

  app.patch("/api/admin/platform/mode", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      const payload = updatePlatformModeSchema.parse(request.body);
      const mode = setPlatformMode(payload.mode);
      return reply.code(200).send({ mode });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid request",
          errors: error.flatten(),
        });
      }

      return reply.code(500).send({ message: "Failed to update platform mode" });
    }
  });
}

