#!/usr/bin/env tsx
import { spawn, execSync } from "child_process";

const LOG_PREFIX = "[SafeGo Deploy]";

function log(message: string, level: "INFO" | "ERROR" | "WARN" = "INFO") {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${LOG_PREFIX} [${level}] ${message}`);
}

function runCommand(command: string, description: string): boolean {
  log(`Running: ${description}`);
  try {
    execSync(command, { stdio: "inherit", timeout: 120000 });
    log(`✓ ${description} completed`);
    return true;
  } catch (error: any) {
    log(`✗ ${description} failed: ${error.message}`, "ERROR");
    return false;
  }
}

async function checkDatabaseConnection(): Promise<boolean> {
  log("Checking database connection...");
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ log: ["error"] });
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    log("✓ Database connection successful");
    return true;
  } catch (error: any) {
    log(`✗ Database connection failed: ${error.message}`, "ERROR");
    return false;
  }
}

async function runMigrations(): Promise<boolean> {
  log("=".repeat(60));
  log("RUNNING DATABASE MIGRATIONS");
  log("=".repeat(60));

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    log(`Migration attempt ${attempt}/${maxRetries}`);

    if (!(await checkDatabaseConnection())) {
      log(`Database not ready, waiting 5s before retry...`, "WARN");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    const prismaSuccess = runCommand(
      "npx prisma migrate deploy",
      "Prisma migrations"
    );

    if (prismaSuccess) {
      log("✓ All migrations completed successfully");
      return true;
    }

    log(`Migration failed, attempt ${attempt}/${maxRetries}`, "WARN");
    await new Promise((r) => setTimeout(r, 3000));
  }

  log("✗ All migration attempts failed", "ERROR");
  return false;
}

function startServer(): void {
  log("=".repeat(60));
  log("STARTING APPLICATION SERVER");
  log("=".repeat(60));

  const nodeOptions = process.env.NODE_OPTIONS || "--max-old-space-size=1536";
  log(`NODE_OPTIONS: ${nodeOptions}`);
  log(`NODE_ENV: ${process.env.NODE_ENV || "production"}`);

  const server = spawn("node", ["dist/index.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NODE_OPTIONS: nodeOptions,
    },
  });

  server.on("error", (err) => {
    log(`Server failed to start: ${err.message}`, "ERROR");
    process.exit(1);
  });

  server.on("exit", (code) => {
    log(`Server exited with code ${code}`, code === 0 ? "INFO" : "ERROR");
    process.exit(code || 0);
  });

  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down gracefully...");
    server.kill("SIGTERM");
  });

  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down gracefully...");
    server.kill("SIGINT");
  });
}

async function main() {
  log("=".repeat(60));
  log("SAFEGO PRODUCTION STARTUP");
  log("=".repeat(60));

  const skipMigrations = process.env.SKIP_MIGRATIONS === "true";

  if (skipMigrations) {
    log("Skipping migrations (SKIP_MIGRATIONS=true)");
  } else {
    const migrationSuccess = await runMigrations();
    if (!migrationSuccess) {
      log(
        "Migrations failed but continuing with server start (tables may already exist)",
        "WARN"
      );
    }
  }

  startServer();
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, "ERROR");
  process.exit(1);
});
