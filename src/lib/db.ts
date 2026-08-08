import { Pool } from 'pg';

// El pool se reutiliza entre hot-reloads de Next para no agotar conexiones.
const g = globalThis as unknown as { _pool?: Pool };

export const pool =
  g._pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') g._pool = pool;

/** Tenant activo. Cuando agregues Clerk, esto sale de la sesión del usuario. */
export const TENANT = process.env.TENANT_ID ?? 'brewwines';
