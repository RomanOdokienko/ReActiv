import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { parseCatalogQuery } from "../catalog/catalog-query";
import {
  findCatalogItemById,
  getCatalogFiltersMetadata,
  searchCatalogItems,
} from "../repositories/catalog-repository";

export async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/catalog/items", async (request, reply) => {
    try {
      const query = parseCatalogQuery(request.query);
      const result = searchCatalogItems(query);

      return reply.code(200).send({
        items: result.items,
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

  app.get("/api/catalog/filters", async (_request, reply) => {
    try {
      const metadata = getCatalogFiltersMetadata();
      return reply.code(200).send(metadata);
    } catch {
      return reply.code(500).send({ message: "Failed to fetch filter metadata" });
    }
  });

  app.get("/api/catalog/items/:id", async (request, reply) => {
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

      return reply.code(200).send(item);
    } catch {
      return reply.code(500).send({ message: "Failed to fetch catalog item" });
    }
  });
}
