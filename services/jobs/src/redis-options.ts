import type { RedisOptions } from "ioredis";

export const redisConnectionOptions = {
  maxRetriesPerRequest: null,
} satisfies RedisOptions;
