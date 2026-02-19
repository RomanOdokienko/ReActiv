import type { FastifyInstance } from "fastify";
import {
  resolveGalleryUrls,
  resolvePreviewUrl,
} from "../services/media-preview-service";

export async function registerMediaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/media/preview", async (request, reply) => {
    const query = request.query as { url?: string };
    const sourceUrl = query.url?.trim();

    if (!sourceUrl) {
      return reply.code(400).send({ message: "url is required" });
    }

    const result = await resolvePreviewUrl(sourceUrl);
    return reply.code(200).send(result);
  });

  app.get("/api/media/preview-image", async (request, reply) => {
    const query = request.query as { url?: string };
    const sourceUrl = query.url?.trim();

    if (!sourceUrl) {
      return reply.code(400).send({ message: "url is required" });
    }

    const resolved = await resolvePreviewUrl(sourceUrl);
    if (!resolved.previewUrl) {
      return reply.code(404).send({ message: "preview not found" });
    }

    try {
      const imageResponse = await fetch(resolved.previewUrl, { method: "GET" });
      if (!imageResponse.ok) {
        return reply.code(404).send({ message: "preview fetch failed" });
      }

      const contentType =
        imageResponse.headers.get("content-type") ?? "image/jpeg";
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return reply
        .code(200)
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=300")
        .send(buffer);
    } catch {
      return reply.code(500).send({ message: "preview fetch failed" });
    }
  });

  app.get("/api/media/gallery", async (request, reply) => {
    const query = request.query as { url?: string };
    const sourceUrl = query.url?.trim();

    if (!sourceUrl) {
      return reply.code(400).send({ message: "url is required" });
    }

    const result = await resolveGalleryUrls(sourceUrl);
    return reply.code(200).send(result);
  });
}
