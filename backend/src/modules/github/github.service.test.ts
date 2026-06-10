import { describe, expect, it } from "vitest";
import { createGitHubService } from "./github.service";

const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0SZ/NsgLoTgPtkxImL5FYD0Kzx1L6irOlci+22KqcxQPoI0/
3Y8sGpa8wBkh1JdZF+LQbP7rcKnh6sZgS1D9uFnUOdj55vGGr+O8bwTshQSU1R4I
V3l2s07HhYj4c2r5DjzB93d/NEs1K0J4lgo2e1BwxDmG60Sl4lu+0DUV0j7a/Ww+
1NPUKq30Hre6m3ejgSaTixDZsYfe1kYF2UQKY2Yzx4fypaVZ8qZQ8CGb5TT57jGQ
tGKv2jnJf8iWv8DdTwdUfcfUQVK2cfj0h6GHtF0ul7n2m5eiKcH1yILQ8H1WrK3o
2zL2XpmSY+vZ2euLk+JvMmM4U0Ut3jD2Qzv8nQIDAQABAoIBAQCL6d5k1xUQ4F0e
8yG7BltJw3wFxF8uC4tl5w8QSWLU9+7vVaV+G9yjF+8Y5pXkJjK2iyKCbO1JM3xp
qwC9jKz7VL+z6aL1VA8FdqS0Pk/G8LCdXgQpdVOAp+1gBAKv7Lm2Mshe5e2j7QJ5
i6Qbg/GP0UV2hbnD8dSq9pq6myj56UBI+k2Dmwmwq6M2TEl3fN4h0w28Te6J6r8c
xLpd4+EeKPRj3w8w2MEz/9eDmnQ4GnS76ymt9Vr6eDnG5xTbdi7f5qM6z5dS3N3m
mcbB/jX63HExw6LhQkq7/GvsG4DhyN4OwFsl1InY6OO6uOeP69vA8S2+rbxNe5mq
tYGYTk8hAoGBAPW8j2y8r65ePEu2zzmzI32KB9hmCb8g3B0yQBB9QAzD4N0fGfGz
xd4/G6RydslL1YrdIO2sT2w9s7TKyA1eR30q1+1rUfW0b2L4ppWYX3QNAQdMzjG0
5yn3fMmV3DQ8tnQm8DX9vFlR5WXdczY2R32LWWf3yILPj2+6fTrWPKgJAoGBANsD
M0YbnD6M2hP1cxch7iLjQvFh1jYd+FQKBwk3ns98R84VwG3X2UqSH1l8svu2/32c
EAj6ydHYJYpxSLt8kU9b0lNNBL9ct0Muw6v0oQAVmCV0TJd9b7nB3FJ9Fx+PI2u0
Hk8LfoekMLfxj1a9T4A41kLF8EfjB2vrY3quSVl/AoGBAL/JuR6OwKwRmeIfz7xv
u0v94xY0lc6PiYfO/GQgrcGQVe4mnKmYa5U7QzAGB3+d4oM0c6f6yIZ7Fn75zF+Q
tqj3ShWnN8TLrCCLahz1ixdR92hEkp9V4NPdqv5FsD9XwdB7kFS2UVmOyHxj1oXj
2SG2GhUJA3BpAkX6ulzYyTVZAoGAEmjZrNVc5M2lW10bJ6n5z6v3n9e50D/GotSO
v+S0xHlW6TQ7YoN6BoZn0nGc8s7ShYBVt3gkJ+ovKPK8lh5lpe8fx7hBtWEJd8Z7
VCPE5c57bF7z08Z+Ae3BvWrT1s+6YzbzY6/tQ5YxN3VJfN+kXqq9seWosTsn7V+d
TWLFc7UCgYB4SG+N20q4KykBohVE48d3C6DbR0JQ0hLQ8lwqXvAj8vMh6Q8fcm40
juD7QdR4hgD0zD9w4W/7mMPEV9Bk3v3Q1a2g70DI3L/owRzvFZKMxhQt1ny/V+X5
gK+vKjNz4F7ElIZMw/4AbgV6GWmR1xXaM6PvJdGQhNr4+y8YKr/74w==
-----END RSA PRIVATE KEY-----`;

describe("createGitHubService", () => {
  it("verifies a freshly signed install state", () => {
    const service = createGitHubService({
      APP_AUTH_SECRET: "01234567890123456789012345678901",
      GITHUB_APP_ID: "123",
      GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY
    });

    const token = service.createInstallState({
      appUserId: "user_123",
      sessionId: "session_456",
      returnTo: "/onboarding"
    });

    expect(service.verifyInstallState(token)).toMatchObject({
      appUserId: "user_123",
      sessionId: "session_456",
      returnTo: "/onboarding"
    });
  });

  it("rejects a tampered install state", () => {
    const service = createGitHubService({
      APP_AUTH_SECRET: "01234567890123456789012345678901",
      GITHUB_APP_ID: "123",
      GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY
    });

    const token = service.createInstallState({
      appUserId: "user_123",
      sessionId: "session_456"
    });

    expect(service.verifyInstallState(`${token}tampered`)).toBeNull();
  });
});
