import 'dotenv/config';
import Fastify from 'fastify';
import sequelizePlugin from './plugins/sequelize';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';

const app = Fastify({
  logger: true,
});

app.register(sequelizePlugin);
app.register(healthRoutes);
app.register(authRoutes);

const port = Number(process.env.PORT) || 4000;
const host = '0.0.0.0';

async function start() {
  try {
    await app.listen({ port, host });
    app.log.info(`Server listening at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
