import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { parseCatalogQuery } from "../catalog/catalog-query";
import { getLatestSuccessfulImportBatch } from "../repositories/import-batch-repository";
import {
  findOfferAdminComment,
  upsertOfferAdminComment,
} from "../repositories/offer-admin-note-repository";
import {
  findCatalogItemById,
  getCatalogFiltersMetadata,
  getCatalogStructureSummaryMetrics,
  getCatalogStockValueRub,
  searchCatalogItems,
} from "../repositories/catalog-repository";

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

const updateCatalogItemCommentBodySchema = z.object({
  comment: z.string().max(5000),
});

export async function registerAdminCatalogRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/admin/catalog/summary", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      const latestImportBatch = getLatestSuccessfulImportBatch();
      const stockValueRub = getCatalogStockValueRub();
      const structureMetrics = getCatalogStructureSummaryMetrics();

      return reply.code(200).send({
        newThisWeekCount: latestImportBatch?.added_rows ?? 0,
        stockValueRub,
        avgPriceRub: structureMetrics.avgPriceRub,
        medianPriceRub: structureMetrics.medianPriceRub,
        avgPriceByVehicleType: structureMetrics.avgPriceByVehicleType,
        vehicleTypeShare: structureMetrics.vehicleTypeShare,
      });
    } catch {
      return reply.code(500).send({ message: "Failed to fetch catalog summary" });
    }
  });

  app.get("/api/admin/catalog/items", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      const query = parseCatalogQuery(request.query);
      const result = searchCatalogItems(query);

      return reply.code(200).send({
        items: result.items,
        newThisWeekCount: result.newThisWeekCount,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid query params",
          errors: error.flatten(),
        });
      }

      return reply.code(500).send({ message: "Failed to fetch catalog items" });
    }
  });

  app.get("/api/admin/catalog/filters", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      return reply.code(200).send(getCatalogFiltersMetadata());
    } catch {
      return reply.code(500).send({ message: "Failed to fetch filter metadata" });
    }
  });

  app.get("/api/admin/catalog/items/:id", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const parsedId = Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return reply.code(400).send({ message: "Invalid catalog item id" });
    }

    try {
      const item = findCatalogItemById(parsedId);
      if (!item) {
        return reply.code(404).send({ message: "Catalog item not found" });
      }

      const adminComment = findOfferAdminComment(item.tenantId, item.offerCode) ?? "";
      return reply.code(200).send({
        ...item,
        adminComment,
      });
    } catch {
      return reply.code(500).send({ message: "Failed to fetch catalog item" });
    }
  });

  app.patch("/api/admin/catalog/items/:id/comment", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const parsedId = Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return reply.code(400).send({ message: "Invalid catalog item id" });
    }

    try {
      const payload = updateCatalogItemCommentBodySchema.parse(request.body);
      const item = findCatalogItemById(parsedId);
      if (!item) {
        return reply.code(404).send({ message: "Catalog item not found" });
      }

      const adminComment = upsertOfferAdminComment({
        tenantId: item.tenantId,
        offerCode: item.offerCode,
        commentText: payload.comment,
        updatedByUserId: request.authUser?.id ?? null,
      });

      return reply.code(200).send({ adminComment });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid request body",
          errors: error.flatten(),
        });
      }

      return reply.code(500).send({ message: "Failed to update catalog item comment" });
    }
  });
}
