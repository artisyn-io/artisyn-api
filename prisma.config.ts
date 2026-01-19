import { defineConfig, env } from "prisma/config";

import dotenv from 'dotenv'
dotenv.config();


export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx src/database/seed.ts',
    },
    datasource: {
        url: env("DATABASE_URL")
    }
});