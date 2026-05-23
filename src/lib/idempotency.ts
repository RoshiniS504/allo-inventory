import { redis } from '@/src/lib/redis';

export async function getIdempotencyResult<T>(
  key: string
): Promise<T | null> {
  const raw = await redis.get<string>(`idem:${key}`);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setIdempotencyResult<T>(
  key: string,
  value: T,
  expiresInSeconds: number
): Promise<void> {
  await redis.set(`idem:${key}`, JSON.stringify(value), { ex: expiresInSeconds });
}

