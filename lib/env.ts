export function getRequiredEnv(name: string, fallbackNames: string[] = []) {
  const value = [name, ...fallbackNames]
    .map((envName) => process.env[envName])
    .find(Boolean);

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${[name, ...fallbackNames].join(" or ")}`
    );
  }

  return value;
}

export function getOptionalEnv(name: string) {
  return process.env[name] || null;
}
