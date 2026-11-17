/**
 * Runs once when the server starts, before it accepts requests. Used to fail fast on an unsafe
 * production configuration (weak/missing AUTH_SECRET, …) instead of at the first login.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { exitOnInvalidProductionEnv } = await import("./lib/env");
    exitOnInvalidProductionEnv();
  }
}
