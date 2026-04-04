import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  enqueueCarcadeDirectImportJob,
  getLatestCarcadeDirectImportJob,
  getCarcadeDirectImportJobById,
} from "../services/carcade-direct-import-service";

function rejectIfNoImportAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (request.authUser?.role === "admin") {
    return false;
  }

  void reply.code(403).send({ message: "Forbidden" });
  return true;
}

export async function registerAdminCarcadeImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/admin/carcade-import/latest", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    return reply.code(200).send({
      job: getLatestCarcadeDirectImportJob(),
    });
  });

  app.get("/api/admin/carcade-import/:jobId", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const { jobId } = request.params as { jobId: string };
    const job = getCarcadeDirectImportJobById(jobId);
    if (!job) {
      return reply.code(404).send({ message: "CARCADE import job not found" });
    }

    return reply.code(200).send({ job });
  });

  app.post("/api/admin/carcade-import/run", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const job = enqueueCarcadeDirectImportJob({
      logger: app.log,
    });
    return reply.code(200).send({ job });
  });
}
