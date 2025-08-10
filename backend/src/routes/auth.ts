import { FastifyPluginAsync } from 'fastify';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Expected body from Telegram Web App initData parsing on client
  // { telegramId, firstName, lastName?, username?, languageCode?, photoUrl?, phone? }
  const handler = async (request: any, _reply: any) => {
    console.log('auth/telegram', request.body);
    const body = request.body as Partial<{
      telegramId: number | string;
      firstName: string;
      lastName?: string | null;
      username?: string | null;
      languageCode?: string | null;
      photoUrl?: string | null;
      phone?: string | null;
    }>;

    if (!body?.telegramId || !body?.firstName) {
      return { ok: false, error: 'telegramId and firstName are required' };
    }

    const telegramId = Number(body.telegramId);

    const existing = await fastify.models.User.findOne({ where: { telegramId } });
    if (existing) {
      await existing.update({
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        username: body.username ?? null,
        languageCode: body.languageCode ?? null,
        photoUrl: body.photoUrl ?? null,
        phone: body.phone ?? null,
      });
      return { ok: true, user: existing };
    }

    const created = await fastify.models.User.create({
      telegramId,
      firstName: body.firstName,
      lastName: body.lastName ?? null,
      username: body.username ?? null,
      languageCode: body.languageCode ?? null,
      photoUrl: body.photoUrl ?? null,
      phone: body.phone ?? null,
    });

    return { ok: true, user: created };
  };

  fastify.post('/auth/telegram', handler);
  fastify.post('/api/auth/telegram', handler);
};

export default authRoutes;
