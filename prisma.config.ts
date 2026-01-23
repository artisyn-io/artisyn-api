import { defineConfig, env } from "prisma/config";

import dotenv from 'dotenv'
dotenv.config();


export default defineConfig({
    schema: process.env.NODE_ENV === 'test' ? 'prisma/schema.test.prisma' : 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx src/database/seed.ts',
    },
    datasource: {
        url: process.env.NODE_ENV === 'test' ? 'file:./test.db' : env("DATABASE_URL")
    }
});