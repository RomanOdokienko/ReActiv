import type { FastifyInstance } from "fastify";

const DEFAULT_YANDEX_VERIFICATION_CODES = ["fedf308208a9b3f7"];

function resolveYandexVerificationCodes(): Set<string> {
  const raw = process.env.YANDEX_VERIFICATION_CODES;
  if (!raw) {
    return new Set(DEFAULT_YANDEX_VERIFICATION_CODES);
  }

  const codes = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (codes.length === 0) {
    return new Set(DEFAULT_YANDEX_VERIFICATION_CODES);
  }

  return new Set(codes);
}

function buildYandexVerificationHtml(code: string): string {
  return `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: ${code}</body>
</html>`;
}

export async function registerSiteVerificationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/yandex_:code.html", async (request, reply) => {
    const { code } = request.params as { code: string };
    const allowedCodes = resolveYandexVerificationCodes();
    if (!allowedCodes.has(code)) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Not found");
    }

    return reply
      .code(200)
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "public, max-age=600")
      .send(buildYandexVerificationHtml(code));
  });
}
