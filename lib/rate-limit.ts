import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// 10 requests per minute per authenticated user (brief endpoint)
export const briefLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:brief",
});

// 3 requests per 10 minutes per IP (email endpoints)
export const emailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  prefix: "rl:email",
});

// x-real-ip is set by Vercel's infrastructure and cannot be spoofed by clients
export function getClientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? "unknown";
}
