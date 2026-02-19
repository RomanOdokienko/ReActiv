import "fastify";
import type { PublicAuthUser } from "../repositories/auth-user-repository";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: PublicAuthUser;
  }
}
