export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PollTimeoutError extends Error {
  constructor(public readonly attempts: number) {
    super(`polling timed out after ${attempts} attempts`);
    this.name = "PollTimeoutError";
  }
}

export async function pollUntil<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 30000;
  const sleep = options.sleep ?? defaultSleep;
  const start = Date.now();
  let attempts = 0;

  while (true) {
    attempts += 1;
    const value = await fetcher();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() - start + intervalMs > timeoutMs) {
      throw new PollTimeoutError(attempts);
    }
    await sleep(intervalMs);
  }
}
