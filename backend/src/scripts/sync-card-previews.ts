import { initializeSchema } from "../db/schema";
import { ensureMediaStorageRoot } from "../services/local-media-storage";
import { syncCardPreviewsForTenant } from "../services/card-preview-sync-service";

const KNOWN_TENANTS = ["gpb", "reso", "alpha", "sovcombank"] as const;
const DEFAULT_LIMIT = 500;
const DEFAULT_CONCURRENCY = 4;

interface SyncOptions {
  tenantIds: string[];
  limit: number;
  concurrency: number;
  force: boolean;
}

function parseOptions(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    tenantIds: [...KNOWN_TENANTS],
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
  };

  argv.forEach((argument) => {
    if (argument.startsWith("--tenant=")) {
      const value = argument.slice("--tenant=".length).trim();
      options.tenantIds = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return;
    }

    if (argument.startsWith("--limit=")) {
      const value = Number(argument.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) {
        options.limit = Math.floor(value);
      }
      return;
    }

    if (argument.startsWith("--concurrency=")) {
      const value = Number(argument.slice("--concurrency=".length));
      if (Number.isFinite(value) && value > 0) {
        options.concurrency = Math.max(1, Math.floor(value));
      }
      return;
    }

    if (argument === "--force") {
      options.force = true;
    }
  });

  if (options.tenantIds.length === 0) {
    options.tenantIds = [...KNOWN_TENANTS];
  }

  return options;
}

async function main(): Promise<void> {
  initializeSchema();
  ensureMediaStorageRoot();

  const options = parseOptions(process.argv.slice(2));
  let candidatesTotal = 0;
  let updatedRowsTotal = 0;
  const tenantsUpdated = new Set<string>();

  for (const tenantId of options.tenantIds) {
    const result = await syncCardPreviewsForTenant({
      tenantId,
      limit: options.limit,
      concurrency: options.concurrency,
      force: options.force,
      onProgress: (progress) => {
        if (progress.processed % 25 === 0 || progress.processed === progress.total) {
          console.log("card_preview_sync_progress", {
            tenantId,
            processed: progress.processed,
            total: progress.total,
          });
        }
      },
    });

    candidatesTotal += result.totalCandidates;
    updatedRowsTotal += result.updatedRows;
    if (result.updatedRows > 0) {
      tenantsUpdated.add(result.tenantId);
    }
  }

  console.log("card_preview_sync_result", {
    tenantIds: options.tenantIds,
    candidatesTotal,
    updatedRowsTotal,
    tenantsUpdated: Array.from(tenantsUpdated.values()),
    force: options.force,
  });
}

void main().catch((error) => {
  console.log("card_preview_sync_failed", {
    error: error instanceof Error ? error.message : "unknown_error",
  });
  process.exitCode = 1;
});
