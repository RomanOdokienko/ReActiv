import { initializeSchema } from "../db/schema";
import {
  buildCardPreviewRelativePath,
  ensureMediaStorageRoot,
  storedMediaFileExists,
} from "../services/local-media-storage";
import {
  listVehicleOfferMediaCandidatesByTenant,
  updateVehicleOfferCardPreviewPathsByOfferCode,
} from "../repositories/vehicle-offer-repository";

const KNOWN_TENANTS = ["gpb", "reso", "alpha", "sovcombank"] as const;
const DEFAULT_UPDATE_CHUNK_SIZE = 1000;

interface RelinkOptions {
  tenantIds: string[];
  limit: number | null;
  dryRun: boolean;
  chunkSize: number;
}

interface TenantRelinkStats {
  tenantId: string;
  totalRows: number;
  missingPreviewPathRows: number;
  relinkCandidatesFound: number;
  relinkCandidatesProcessed: number;
  updatedRows: number;
}

function parseOptions(argv: string[]): RelinkOptions {
  const options: RelinkOptions = {
    tenantIds: [...KNOWN_TENANTS],
    limit: null,
    dryRun: false,
    chunkSize: DEFAULT_UPDATE_CHUNK_SIZE,
  };

  argv.forEach((argument) => {
    if (argument.startsWith("--tenant=")) {
      const value = argument.slice("--tenant=".length).trim();
      const tenantIds = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (tenantIds.length > 0) {
        options.tenantIds = tenantIds;
      }
      return;
    }

    if (argument.startsWith("--limit=")) {
      const value = Number(argument.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) {
        options.limit = Math.floor(value);
      }
      return;
    }

    if (argument.startsWith("--chunk-size=")) {
      const value = Number(argument.slice("--chunk-size=".length));
      if (Number.isFinite(value) && value > 0) {
        options.chunkSize = Math.max(1, Math.floor(value));
      }
      return;
    }

    if (
      argument === "--dry-run" ||
      argument === "--plan" ||
      argument === "--no-write"
    ) {
      options.dryRun = true;
    }
  });

  return options;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildTenantUpdates(
  tenantId: string,
  limit: number | null,
): {
  updates: Array<{ offerCode: string; cardPreviewPath: string }>;
  stats: Omit<TenantRelinkStats, "updatedRows">;
} {
  const rows = listVehicleOfferMediaCandidatesByTenant(tenantId);
  const seenOfferCodes = new Set<string>();
  const updates: Array<{ offerCode: string; cardPreviewPath: string }> = [];
  let missingPreviewPathRows = 0;

  for (const row of rows) {
    const offerCode = row.offerCode.trim();
    if (!offerCode || seenOfferCodes.has(offerCode)) {
      continue;
    }
    seenOfferCodes.add(offerCode);

    if (row.cardPreviewPath?.trim()) {
      continue;
    }

    missingPreviewPathRows += 1;
    const expectedPreviewPath = buildCardPreviewRelativePath(tenantId, offerCode);
    if (!storedMediaFileExists(expectedPreviewPath)) {
      continue;
    }

    updates.push({
      offerCode,
      cardPreviewPath: expectedPreviewPath,
    });

    if (limit !== null && updates.length >= limit) {
      break;
    }
  }

  return {
    updates,
    stats: {
      tenantId,
      totalRows: rows.length,
      missingPreviewPathRows,
      relinkCandidatesFound: updates.length,
      relinkCandidatesProcessed: updates.length,
    },
  };
}

function applyTenantUpdates(
  tenantId: string,
  updates: Array<{ offerCode: string; cardPreviewPath: string }>,
  chunkSize: number,
): number {
  if (updates.length === 0) {
    return 0;
  }

  let updatedRows = 0;
  const chunks = chunkArray(updates, chunkSize);
  chunks.forEach((chunk) => {
    updatedRows += updateVehicleOfferCardPreviewPathsByOfferCode(tenantId, chunk);
  });

  return updatedRows;
}

function printTenantStats(stats: TenantRelinkStats): void {
  console.log("card_preview_relink_tenant", stats);
}

function printSummary(
  options: RelinkOptions,
  perTenantStats: TenantRelinkStats[],
): void {
  const summary = perTenantStats.reduce(
    (accumulator, item) => ({
      tenantCount: accumulator.tenantCount + 1,
      totalRows: accumulator.totalRows + item.totalRows,
      missingPreviewPathRows:
        accumulator.missingPreviewPathRows + item.missingPreviewPathRows,
      relinkCandidatesFound:
        accumulator.relinkCandidatesFound + item.relinkCandidatesFound,
      relinkCandidatesProcessed:
        accumulator.relinkCandidatesProcessed + item.relinkCandidatesProcessed,
      updatedRows: accumulator.updatedRows + item.updatedRows,
    }),
    {
      tenantCount: 0,
      totalRows: 0,
      missingPreviewPathRows: 0,
      relinkCandidatesFound: 0,
      relinkCandidatesProcessed: 0,
      updatedRows: 0,
    },
  );

  console.log("card_preview_relink_summary", {
    ...summary,
    tenantIds: options.tenantIds,
    dryRun: options.dryRun,
    limit: options.limit,
    chunkSize: options.chunkSize,
  });
}

function main(): void {
  initializeSchema();
  ensureMediaStorageRoot();

  const options = parseOptions(process.argv.slice(2));
  const perTenantStats: TenantRelinkStats[] = [];

  options.tenantIds.forEach((tenantId) => {
    const { updates, stats } = buildTenantUpdates(tenantId, options.limit);
    const updatedRows = options.dryRun
      ? 0
      : applyTenantUpdates(tenantId, updates, options.chunkSize);

    const tenantStats: TenantRelinkStats = {
      ...stats,
      updatedRows,
    };
    perTenantStats.push(tenantStats);
    printTenantStats(tenantStats);
  });

  printSummary(options, perTenantStats);
}

main();
