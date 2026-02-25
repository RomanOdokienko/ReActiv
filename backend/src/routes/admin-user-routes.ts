import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import {
  countUsersByRole,
  createUser,
  deleteUserById,
  findUserById,
  listUsersForAdmin,
  updateUserPasswordById,
  updateUserMetaById,
} from "../repositories/auth-user-repository";
import { buildPasswordHash, normalizeLogin } from "../services/auth-service";

const createUserBodySchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(100),
  company: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  role: z.enum(["admin", "manager", "stock_owner"]).optional(),
});

const updateUserMetaBodySchema = z.object({
  company: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
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

function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let result = "";

  for (let index = 0; index < bytes.length; index += 1) {
    result += alphabet[bytes[index] % alphabet.length];
  }

  return result;
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
        company: payload.company,
        phone: payload.phone,
        notes: payload.notes,
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

  app.delete("/api/admin/users/:id", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return reply.code(400).send({ message: "Invalid user id" });
    }

    if (request.authUser?.id === parsedId) {
      return reply.code(400).send({ message: "Cannot delete current user" });
    }

    const targetUser = findUserById(parsedId);
    if (!targetUser) {
      return reply.code(404).send({ message: "User not found" });
    }

    if (targetUser.role === "admin" && countUsersByRole("admin") <= 1) {
      return reply.code(400).send({ message: "Cannot delete last admin user" });
    }

    const deleted = deleteUserById(parsedId);
    if (!deleted) {
      return reply.code(404).send({ message: "User not found" });
    }

    return reply.code(200).send({ message: "User deleted" });
  });

  app.post("/api/admin/users/:id/reset-password", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return reply.code(400).send({ message: "Invalid user id" });
    }

    if (request.authUser?.id === parsedId) {
      return reply.code(400).send({ message: "Cannot reset current user password" });
    }

    const targetUser = findUserById(parsedId);
    if (!targetUser) {
      return reply.code(404).send({ message: "User not found" });
    }

    const temporaryPassword = generateTemporaryPassword();
    const updated = updateUserPasswordById(parsedId, buildPasswordHash(temporaryPassword));
    if (!updated) {
      return reply.code(404).send({ message: "User not found" });
    }

    return reply.code(200).send({
      user: {
        id: targetUser.id,
        login: targetUser.login,
        displayName: targetUser.display_name,
        role: targetUser.role,
      },
      temporaryPassword,
    });
  });

  app.patch("/api/admin/users/:id/meta", async (request, reply) => {
    if (rejectIfNotAdmin(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return reply.code(400).send({ message: "Invalid user id" });
    }

    const targetUser = findUserById(parsedId);
    if (!targetUser) {
      return reply.code(404).send({ message: "User not found" });
    }

    try {
      const payload = updateUserMetaBodySchema.parse(request.body);
      updateUserMetaById(parsedId, payload);
      return reply.code(200).send({ message: "User meta updated" });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          message: "Invalid request",
          errors: error.flatten(),
        });
      }

      return reply.code(500).send({ message: "Failed to update user meta" });
    }
  });
}
