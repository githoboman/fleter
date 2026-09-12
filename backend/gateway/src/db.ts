import { Pool } from 'pg';

export const pool = new Pool({
  connectionString:
    process.env.POSTGRES_CONNECTION_STRING || 'postgresql://0t41k1@localhost:5432/bitdrum',
});
