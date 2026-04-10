import { defineConfig } from "drizzle-kit"
import * as dotenv from "dotenv"

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/drizzle/schema.ts",
    out: "./drizzle/migrations/",
    dbCredentials: {
        url: process.env.DATABASE_URL as string
    },
    strict: true,
    verbose: true
});
