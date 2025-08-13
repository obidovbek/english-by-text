import { FastifyPluginAsync } from 'fastify';
import { nextGreeting, pickSupportedLocale, shouldSendGreetingNow } from '../utils/telegram';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Expected body from Telegram Web App initData parsing on client
  // { telegramId, firstName, lastName?, username?, languageCode?, photoUrl?, phone?, uiLocale? }
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
      uiLocale?: string | null;
    }>;

    if (!body?.telegramId || !body?.firstName) {
      return { ok: false, error: 'telegramId and firstName are required' };
    }

    const telegramId = Number(body.telegramId);

    const existing = await fastify.models.User.findOne({ where: { telegramId } });
    let user = existing;
    if (existing) {
      await existing.update({
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        username: body.username ?? null,
        languageCode: body.languageCode ?? null,
        photoUrl: body.photoUrl ?? null,
        phone: body.phone ?? null,
      });
    } else {
      const created = await fastify.models.User.create({
        telegramId,
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        username: body.username ?? null,
        languageCode: body.languageCode ?? null,
        photoUrl: body.photoUrl ?? null,
        phone: body.phone ?? null,
      });
      user = created;
    }

    // Send greeting on each app open; remove previous greeting if any
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && user && shouldSendGreetingNow(telegramId)) {
        const apiBase = `https://api.telegram.org/bot${botToken}`;

        // Delete previous greeting if exists
        const lastId = (user as any).lastGreetingMessageId as number | null | undefined;
        if (lastId && Number.isFinite(lastId)) {
          try {
            await fetch(`${apiBase}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: telegramId, message_id: lastId }),
            });
          } catch (err) {
            request.log.warn({ err }, 'Failed to delete previous greeting');
          }
        }

        // Localized rotating greeting
        const preferred =
          (body.uiLocale as string | undefined) ||
          (user as any).languageCode ||
          body.languageCode ||
          undefined;
        const locale = pickSupportedLocale(preferred);
        const lastVariant = (user as any).lastGreetingVariant as number | null | undefined;
        const { text, index } = nextGreeting(
          locale,
          (user as any).firstName || 'there',
          lastVariant ?? null,
        );

        // Send new greeting
        const sendResp = await fetch(`${apiBase}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramId, text }),
        });
        const sendJson = await sendResp.json().catch(() => null as any);
        const newMsgId = sendJson?.result?.message_id as number | undefined;
        const updates: any = { lastGreetingVariant: index };
        if (newMsgId && Number.isFinite(newMsgId)) {
          updates.lastGreetingMessageId = newMsgId;
        }
        await (user as any).update(updates);
      }
    } catch (err) {
      request.log.warn({ err }, 'Failed to send greeting');
    }

    return { ok: true, user };
  };

  fastify.post('/auth/telegram', handler);
  fastify.post('/api/auth/telegram', handler);
};

export default authRoutes;
