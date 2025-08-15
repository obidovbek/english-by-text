import 'dotenv/config';
import Fastify from 'fastify';
import sequelizePlugin from './plugins/sequelize';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import foldersRoutes from './routes/folders';
import textsRoutes from './routes/texts';
import tokensRoutes from './routes/tokens';
import vocabularyRoutes from './routes/vocabulary';
import telegramRoutes from './routes/telegram';
import studyRoutes from './routes/study';
import usersRoutes from './routes/users';

const app = Fastify({
  logger: true,
});

// Accept raw/binary audio uploads (webm/wav/mpeg and generic octet-stream)
app.addContentTypeParser(
  ['application/octet-stream', 'audio/webm', 'audio/wav', 'audio/mpeg', 'video/webm'],
  function (_request, payload, done) {
    // Do not consume the stream; pass it through so routes can read Buffer/stream
    done(null, payload);
  },
);

app.register(sequelizePlugin);
app.register(healthRoutes);
app.register(authRoutes);
app.register(foldersRoutes);
app.register(textsRoutes);
app.register(tokensRoutes);
app.register(vocabularyRoutes);
app.register(telegramRoutes);
app.register(studyRoutes);
app.register(usersRoutes);

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
