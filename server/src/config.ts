import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3001),
  desktopCodeLength: Number(process.env.DESKTOP_CODE_LENGTH ?? 6),
  desktopCodeTtlMinutes: Number(process.env.DESKTOP_CODE_TTL_MINUTES ?? 5),
};
