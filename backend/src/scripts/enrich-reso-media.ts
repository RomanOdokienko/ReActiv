import {
  enrichResoMediaForTenant,
  type ResoMediaEnrichmentInput,
} from "../services/reso-media-enrichment-service";

function parseLimitArg(argv: string[]): number | undefined {
  const raw = argv.find((item) => item.startsWith("--limit="));
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw.split("=")[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

async function main(): Promise<void> {
  const limit = parseLimitArg(process.argv.slice(2));

  const input: ResoMediaEnrichmentInput = {
    tenantId: "reso",
    limit,
    logger: {
      info: (context, message) => {
        // eslint-disable-next-line no-console
        console.log(message, context);
      },
      error: (context, message) => {
        // eslint-disable-next-line no-console
        console.error(message, context);
      },
    },
  };

  const result = await enrichResoMediaForTenant(input);
  // eslint-disable-next-line no-console
  console.log("reso_media_enrichment_result", result);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  // eslint-disable-next-line no-console
  console.error("reso_media_enrichment_script_failed", { error: message });
  process.exitCode = 1;
});
