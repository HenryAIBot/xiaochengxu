import { buildApp } from "./app.js";

async function main() {
  const app = buildApp();

  try {
    await app.listen({
      port: Number(process.env.API_PORT ?? 3000),
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
