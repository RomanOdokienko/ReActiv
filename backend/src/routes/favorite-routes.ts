import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  deleteUserFavorite,
  findOfferIdentityByItemId,
  listFavoriteCatalogItems,
  listFavoriteItemIds,
  upsertUserFavorite,
} from "../repositories/favorite-repository";

const paginationQuerySchema = z.object({
  page: z.preprocess((value) => Number(value ?? 1), z.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    (value) => Number(value ?? 20),
    z.number().int().min(1).max(100).default(20),
  ),
});

function parseItemId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function sanitizeFavoriteItemForRole<T extends { responsiblePerson?: string }>(
  item: T,
  role: string | undefined,
): T {
  if (role === "admin" || role === "stock_owner") {
    return item;
  }

  return {
    ...item,
    ...(Object.prototype.hasOwnProperty.call(item, "responsiblePerson")
      ? { responsiblePerson: "" }
      : {}),
  };
}

export async function registerFavoriteRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/favorites/ids", async (request, reply) => {
    if (!request.authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    try {
      const itemIds = listFavoriteItemIds(request.authUser.id);
      return reply.code(200).send({ itemIds });
    } catch {
      return reply.code(500).send({ message: "Failed to fetch favorites" });
    }
  });

  app.get("/api/favorites", async (request, reply) => {
    if (!request.authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    try {
      const query = paginationQuerySchema.parse(request.query);
      const result = listFavoriteCatalogItems(
        request.authUser.id,
        query.page,
        query.pageSize,
      );
      const items = result.items.map((item) =>
        sanitizeFavoriteItemForRole(item, request.authUser?.role),
      );

      return reply.code(200).send({
        items,
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

      return reply.code(500).send({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites/:itemId", async (request, reply) => {
    if (!request.authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { itemId: rawItemId } = request.params as { itemId: string };
    const itemId = parseItemId(rawItemId);
    if (!itemId) {
      return reply.code(400).send({ message: "Invalid catalog item id" });
    }

    const identity = findOfferIdentityByItemId(itemId);
    if (!identity) {
      return reply.code(404).send({ message: "Catalog item not found" });
    }

    try {
      upsertUserFavorite(request.authUser.id, identity);
      return reply.code(200).send({
        itemId,
        isFavorite: true,
      });
    } catch {
      return reply.code(500).send({ message: "Failed to update favorites" });
    }
  });

  app.delete("/api/favorites/:itemId", async (request, reply) => {
    if (!request.authUser) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { itemId: rawItemId } = request.params as { itemId: string };
    const itemId = parseItemId(rawItemId);
    if (!itemId) {
      return reply.code(400).send({ message: "Invalid catalog item id" });
    }

    const identity = findOfferIdentityByItemId(itemId);
    if (!identity) {
      return reply.code(404).send({ message: "Catalog item not found" });
    }

    try {
      const removed = deleteUserFavorite(request.authUser.id, identity);
      return reply.code(200).send({
        itemId,
        isFavorite: false,
        removed,
      });
    } catch {
      return reply.code(500).send({ message: "Failed to update favorites" });
    }
  });
}
