import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { createUser, listUsersForAdmin } from "../repositories/auth-user-repository";
import { buildPasswordHash, normalizeLogin } from "../services/auth-service";

const createUserBodySchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "manager"]).optional(),
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

export async function registerAdminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/users", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const items = listUsersForAdmin();
    return reply.code(200).send({ items });
  });

  app.post("/api/admin/users", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    try {
      const payload = createUserBodySchema.parse(request.body);
      const createdUser = createUser({
        login: normalizeLogin(payload.login),
        password_hash: buildPasswordHash(payload.password),
        display_name: payload.displayName,
        role: payload.role ?? "manager",
      });

      return reply.code(201).send({ user: createdUser });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid request",
          errors: error.flatten(),
        });
      }

      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.login")) {
        return reply.code(409).send({ message: "Login already exists" });
      }

      return reply.code(500).send({ message: "Failed to create user" });
    }
  });
}
