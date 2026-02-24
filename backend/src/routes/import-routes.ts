import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  clearImportedData,
  getImportBatchById,
  listImportBatches,
} from "../repositories/import-batch-repository";
import { getImportErrorsByBatchId } from "../repositories/import-error-repository";
import { importWorkbook } from "../services/import-service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function rejectIfNoImportAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (request.authUser?.role === "admin" || request.authUser?.role === "stock_owner") {
    return false;
  }

  void reply.code(403).send({ message: "Forbidden" });
  return true;
}

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/imports", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const query = request.query as { limit?: string | number };
    const parsedLimit = Number(query.limit ?? 20);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : 20;

    const imports = listImportBatches(limit);
    return reply.code(200).send({ items: imports });
  });

  app.post("/api/imports", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ message: "File is required" });
    }

    if (!file.filename.toLowerCase().endsWith(".xlsx")) {
      return reply.code(400).send({ message: "Only .xlsx files are allowed" });
    }

    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of file.file) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bufferChunk.length;
      if (size > MAX_FILE_SIZE_BYTES) {
        return reply.code(400).send({ message: "File exceeds 10MB limit" });
      }
      chunks.push(bufferChunk);
    }

    const fileBuffer = Buffer.concat(chunks);

    try {
      const result = importWorkbook({
        filename: file.filename,
        fileBuffer,
        logger: app.log,
      });
      return reply.code(200).send(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import failed";
      app.log.error(
        {
          filename: file.filename,
          message,
        },
        "import_request_failed",
      );
      return reply.code(500).send({ message });
    }
  });

  app.delete("/api/imports", async (_request, reply) => {
    if (rejectIfNoImportAccess(_request, reply)) {
      return;
    }

    try {
      const deleted = clearImportedData();

      app.log.info(
        {
          ...deleted,
        },
        "imports_cleared",
      );

      return reply.code(200).send({
        message: "All imported data deleted",
        ...deleted,
      });
    } catch (error) {
      app.log.error(error, "imports_clear_failed");
      return reply.code(500).send({ message: "Failed to clear imported data" });
    }
  });

  app.get("/api/imports/:id", async (request, reply) => {
    if (rejectIfNoImportAccess(request, reply)) {
      return;
    }

    const params = request.params as { id: string };
    const importBatch = getImportBatchById(params.id);

    if (!importBatch) {
      return reply.code(404).send({ message: "Import batch not found" });
    }

    const errors = getImportErrorsByBatchId(params.id);

    return reply.code(200).send({
      importBatch,
      errors,
    });
  });
}
