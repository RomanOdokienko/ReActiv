import { initializeSchema } from "../db/schema";
import { createUser } from "../repositories/auth-user-repository";
import { buildPasswordHash, normalizeLogin } from "../services/auth-service";

interface CliArgs {
  login: string;
  password: string;
  name: string;
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
  const positionalName = positional.slice(2).join(" ").trim();
  const name = ((argMap.name ?? positionalName) || login).trim();

  if (!login || !password) {
    throw new Error(
      "Usage: npm run create-user -- --login <login> --password <password> [--name \"Display Name\"]",
    );
  }

  return { login, password, name };
}

function main(): void {
  const args = parseArgs(process.argv);
  initializeSchema();

  const createdUser = createUser({
    login: normalizeLogin(args.login),
    password_hash: buildPasswordHash(args.password),
    display_name: args.name,
  });

  // eslint-disable-next-line no-console
  console.log(`User created: login=${createdUser.login}, displayName=${createdUser.displayName}`);
}

try {
  main();
} catch (error) {
  let message = error instanceof Error ? error.message : "Failed to create user";
  if (message.includes("UNIQUE constraint failed: users.login")) {
    message = "Пользователь с таким логином уже существует";
  }
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}
