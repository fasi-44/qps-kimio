import { config } from 'dotenv';
import path from 'path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// prisma.config.ts lives at packages/database/ — root .env is two levels up
config({ path: path.join(__dirname, '../../.env') });

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
  migrate: {
    adapter() {
      return new PrismaPg({ connectionString: process.env.DATABASE_URL });
    },
  },
});
