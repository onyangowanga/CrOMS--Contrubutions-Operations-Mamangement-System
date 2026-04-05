export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/croms",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL ?? "admin@croms.local",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "Admin@12345",
};
