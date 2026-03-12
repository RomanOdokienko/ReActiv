import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import {
  listVehicleOfferMediaCandidatesByTenant,
  updateVehicleOfferMediaUrlsByOfferCode,
} from "../repositories/vehicle-offer-repository";

const VIN_REGEX = /^[A-Z0-9]{17}$/i;

const candidatesQuerySchema = z.object({
  onlyMissingMedia: z
    .preprocess((value) => String(value ?? "true").toLowerCase(), z.enum(["true", "false"]))
    .transform((value) => value === "true"),
  limit: z
    .preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().positive().max(20000).optional(),
    ),
});

const bulkUpdateBodySchema = z.object({
  items: z
    .array(
      z.object({
        offerCode: z.string().trim().min(1),
        mediaUrls: z.array(z.string().url()).max(200),
      }),
    )
    .max(5000),
});

function rejectIfInvalidSyncToken(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  const configuredToken = process.env.RESO_MEDIA_SYNC_TOKEN?.trim();
  if (!configuredToken) {
    void reply.code(503).send({ message: "RESO media sync token is not configured" });
    return true;
  }

  const providedToken = request.headers["x-reso-media-token"];
  const token =
    typeof providedToken === "string"
      ? providedToken.trim()
      : Array.isArray(providedToken)
        ? String(providedToken[0] ?? "").trim()
        : "";

  if (token !== configuredToken) {
    void reply.code(401).send({ message: "Unauthorized" });
    return true;
  }

  return false;
}

export async function registerAdminResoMediaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/reso-media/candidates", async (request, reply) => {
    if (rejectIfInvalidSyncToken(request, reply)) {
      return;
    }

    try {
      const query = candidatesQuerySchema.parse(request.query);
      const rows = listVehicleOfferMediaCandidatesByTenant("reso");
      const filtered = rows
        .filter((row) => VIN_REGEX.test(row.offerCode))
        .filter((row) => (query.onlyMissingMedia ? !row.yandexDiskUrl?.trim() : true));
      const items =
        typeof query.limit === "number" ? filtered.slice(0, query.limit) : filtered;

      return reply.code(200).send({
        items: items.map((row) => ({
          offerCode: row.offerCode,
          hasMedia: Boolean(row.yandexDiskUrl?.trim()),
        })),
        total: filtered.length,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid query params",
          errors: error.flatten(),
        });
      }
      return reply.code(500).send({ message: "Failed to fetch RESO media candidates" });
    }
  });

  app.post("/api/admin/reso-media/bulk-update", async (request, reply) => {
    if (rejectIfInvalidSyncToken(request, reply)) {
      return;
    }

    try {
      const payload = bulkUpdateBodySchema.parse(request.body);
      const updates = payload.items
        .map((item) => ({
          offerCode: item.offerCode.trim().toUpperCase(),
          yandexDiskUrl: item.mediaUrls.join("\n"),
        }))
        .filter((item) => VIN_REGEX.test(item.offerCode));

      const updatedRows = updateVehicleOfferMediaUrlsByOfferCode("reso", updates);
      return reply.code(200).send({
        acceptedItems: updates.length,
        updatedRows,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid payload",
          errors: error.flatten(),
        });
      }
      return reply.code(500).send({ message: "Failed to apply RESO media updates" });
    }
  });
}
