import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

/**
 * Simple in-memory rate limiter middleware
 * For production, consider using a distributed rate limiter with Redis
 * 
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum number of requests allowed in the window
 */
export function createRateLimiter(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup on each request
      Object.keys(rateLimitStore).forEach(key => {
        if (rateLimitStore[key].resetTime < now) {
          delete rateLimitStore[key];
        }
      });
    }
    
    if (!rateLimitStore[identifier]) {
      rateLimitStore[identifier] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }
    
    const record = rateLimitStore[identifier];
    
    // Reset if window has passed
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    // Increment count
    record.count++;
    
    // Check if limit exceeded
    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", new Date(record.resetTime).toISOString());
      
      return res.status(429).json({
        message: "Too many requests, please try again later",
        retryAfter,
      });
    }
    
    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count));
    res.setHeader("X-RateLimit-Reset", new Date(record.resetTime).toISOString());
    
    next();
  };
}

/**
 * Rate limiter for authentication endpoints
 * Allows 5 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5);

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per minute per IP
 */
export const apiRateLimiter = createRateLimiter(60 * 1000, 100);
