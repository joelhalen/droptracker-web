/**
 * Headless Claude Code CLI runner (server-side only).
 *
 * Mirrors the adminbot KB answerer's zero-API-cost design: we spawn one
 * `claude -p` process per generation under the machine's subscription auth
 * (HOME=/home/debian on the node services) and close it when done. Nothing is
 * ever billed to the metered API — ANTHROPIC_API_KEY is stripped from the
 * child environment so the CLI cannot fall back to it.
 *
 * Abuse containment, in layers:
 *  - `--tools ""`            the session has NO tools — it can only emit text
 *  - `--system-prompt`       REPLACES Claude Code's default agent prompt, so
 *                            the model knows nothing about this machine
 *  - `--json-schema`         output is validated against the caller's schema;
 *                            prompt-injected "ignore instructions" output that
 *                            doesn't match the schema fails the call
 *  - `--strict-mcp-config` / `--setting-sources ""` / `--disable-slash-commands`
 *                            no MCP servers, no local settings, no skills
 *  - one generation at a time process-wide (serialized via a module promise)
 *  - hard wall-clock timeout, then SIGKILL
 */
import { spawn } from "node:child_process";

const CLAUDE_CLI = process.env.CLAUDE_CLI_PATH ?? "/home/debian/.local/bin/claude";
const MODEL = process.env.EVENTPROMPT_CLAUDE_MODEL ?? "sonnet";
const EFFORT = process.env.EVENTPROMPT_CLAUDE_EFFORT ?? "low";
const TIMEOUT_MS = Number(process.env.EVENTPROMPT_CLAUDE_TIMEOUT_MS ?? 120_000);

export class ClaudeCliError extends Error {}

/** Serialize generations — one subscription session at a time, like adminbot. */
let queue: Promise<unknown> = Promise.resolve();

export type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_creation: number;
  cost_usd: number;
};

/**
 * Run one schema-constrained, tool-less `claude -p` call. Resolves with the
 * parsed JSON result (already schema-validated by the CLI) plus usage meta.
 */
export async function runClaudeJson<T>(opts: {
  systemPrompt: string;
  prompt: string;
  jsonSchema: object;
}): Promise<{ result: T; usage: ClaudeUsage }> {
  const run = queue.then(() => spawnOnce<T>(opts));
  // Keep the chain alive even when a run rejects.
  queue = run.catch(() => undefined);
  return run;
}

function spawnOnce<T>(opts: {
  systemPrompt: string;
  prompt: string;
  jsonSchema: object;
}): Promise<{ result: T; usage: ClaudeUsage }> {
  const argv = [
    "-p",
    "--output-format", "json",
    "--model", MODEL,
    "--effort", EFFORT,
    "--tools", "",
    "--system-prompt", opts.systemPrompt,
    "--json-schema", JSON.stringify(opts.jsonSchema),
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--setting-sources", "",
  ];
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_CLI, argv, {
      env,
      cwd: "/tmp",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;
    const fail = (e: Error) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    };
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      fail(new ClaudeCliError(`generation timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    proc.stdout.on("data", (c: Buffer) => out.push(c));
    proc.stderr.on("data", (c: Buffer) => err.push(c));
    proc.on("error", (e) => {
      clearTimeout(timer);
      fail(new ClaudeCliError(`failed to spawn claude CLI: ${e.message}`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      const stderrTail = Buffer.concat(err).toString("utf-8").slice(-400);
      if (code !== 0) {
        return fail(new ClaudeCliError(`claude exited ${code}: ${stderrTail || "no output"}`));
      }
      let data: {
        result?: unknown;
        is_error?: boolean;
        usage?: Record<string, number>;
        total_cost_usd?: number;
      };
      try {
        data = JSON.parse(Buffer.concat(out).toString("utf-8"));
      } catch {
        return fail(new ClaudeCliError("claude returned non-JSON output"));
      }
      if (data.is_error) {
        return fail(
          new ClaudeCliError(`claude reported an error: ${String(data.result ?? "").slice(0, 300)}`),
        );
      }
      // With --json-schema the result is the JSON document itself (the CLI may
      // deliver it as an object or as a JSON-encoded string; accept both).
      let result: T;
      try {
        result =
          typeof data.result === "string"
            ? (JSON.parse(data.result) as T)
            : (data.result as T);
      } catch {
        return fail(new ClaudeCliError("claude result was not valid JSON"));
      }
      const u = data.usage ?? {};
      settled = true;
      resolve({
        result,
        usage: {
          input_tokens: Number(u.input_tokens ?? 0),
          output_tokens: Number(u.output_tokens ?? 0),
          cache_read: Number(u.cache_read_input_tokens ?? 0),
          cache_creation: Number(u.cache_creation_input_tokens ?? 0),
          cost_usd: Number(data.total_cost_usd ?? 0),
        },
      });
    });

    proc.stdin.write(opts.prompt, "utf-8");
    proc.stdin.end();
  });
}
