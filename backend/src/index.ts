import { buildApp } from "./app";

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({
      port: app.config.PORT,
      host: app.config.HOST
    });
    app.log.info(`Backend listening on ${app.config.HOST}:${app.config.PORT}`);
  } catch (error) {
    app.log.error(error, "Failed to start backend");
    process.exit(1);
  }
};

void start();

