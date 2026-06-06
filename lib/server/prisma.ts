import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@prisma/client"

const datasourceUrl = process.env.DATABASE_URL || "file:./dev.db"
const adapter = new PrismaBetterSqlite3({ url: datasourceUrl })

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma
}
