import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  enqueueVtbDirectImportJob,
  getLatestVtbDirectImportJob,
  getVtbDirectImportJobById,
} from "../services/vtb-direct-import-service";

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

export async function registerAdminVtbImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/admin/vtb-import/latest", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    return reply.code(200).send({
      job: getLatestVtbDirectImportJob(),
    });
  });

  app.get("/api/admin/vtb-import/:jobId", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const { jobId } = request.params as { jobId: string };
    const job = getVtbDirectImportJobById(jobId);
    if (!job) {
      return reply.code(404).send({ message: "VTB import job not found" });
    }

    return reply.code(200).send({ job });
  });

  app.post("/api/admin/vtb-import/run", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const job = enqueueVtbDirectImportJob({
      logger: app.log,
    });
    return reply.code(200).send({ job });
  });
}

