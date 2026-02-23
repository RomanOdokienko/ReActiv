import { initializeSchema } from "../db/schema";
import {
  findUserByLogin,
  updateUserPasswordByLogin,
} from "../repositories/auth-user-repository";
import { buildPasswordHash, normalizeLogin } from "../services/auth-service";

interface CliArgs {
  login: string;
  password: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const argMap: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const next = args[index + 1];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    if (!next || next.startsWith("--")) {
      continue;
    }
    argMap[token.slice(2)] = next;
    index += 1;
  }

  const login = (argMap.login ?? positional[0] ?? "").trim();
  const password = (argMap.password ?? positional[1] ?? "").trim();

  if (!login || !password) {
    throw new Error(
      "Usage: npm run set-user-password -- --login <login> --password <password>",
    );
  }

  return { login, password };
}

function main(): void {
  const args = parseArgs(process.argv);
  initializeSchema();

  const normalizedLogin = normalizeLogin(args.login);
  const user = findUserByLogin(normalizedLogin);
  if (!user) {
    throw new Error("User not found");
  }

  const updated = updateUserPasswordByLogin(
    normalizedLogin,
    buildPasswordHash(args.password),
  );
  if (!updated) {
    throw new Error("Failed to update password");
  }

  // eslint-disable-next-line no-console
  console.log(`Password updated for login=${normalizedLogin}`);
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Failed to update user password";
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}
