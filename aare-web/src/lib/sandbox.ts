export const SANDBOX_API_BASE =
  process.env.NEXT_PUBLIC_SANDBOX_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "";

export const isSandboxConfigured = Boolean(
  process.env.NEXT_PUBLIC_SANDBOX_API_BASE &&
    process.env.NEXT_PUBLIC_SANDBOX_API_BASE !== process.env.NEXT_PUBLIC_API_BASE
);
