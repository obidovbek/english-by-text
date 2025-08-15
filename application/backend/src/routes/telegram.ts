import { FastifyPluginAsync } from 'fastify';
import { nextGreeting, pickSupportedLocale, shouldSendGreetingNow } from '../utils/telegram';

function getUserId(request: any): number | undefined {
  const reqAny = request as any;
  const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
  return reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined);
}

const telegramRoutes: FastifyPluginAsync = async (fastify) => {
  const paths = ['/telegram/greet', '/api/telegram/greet'];
  for (const p of paths) {
    fastify.post(p, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ ok: false, error: 'Unauthorized' });

      const user = await fastify.models.User.findOne({ where: { id: userId } });
      if (!user || !(user as any).telegramId) {
        return reply.code(400).send({ ok: false, error: 'User not linked to Telegram' });
      }

      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return reply.send({ ok: true, skipped: true });

        const telegramId = (user as any).telegramId as number;
        if (!shouldSendGreetingNow(telegramId)) {
          return reply.send({ ok: true, skipped: true });
        }

        const apiBase = `https://api.telegram.org/bot${botToken}`;

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

        const locale = pickSupportedLocale((user as any).languageCode || undefined);
        const lastVariant = (user as any).lastGreetingVariant as number | null | undefined;
        const { text, index } = nextGreeting(
          locale,
          (user as any).firstName || 'there',
          lastVariant ?? null,
        );
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

        return reply.send({ ok: true });
      } catch (err) {
        request.log.warn({ err }, 'Failed to send greeting');
        return reply.code(500).send({ ok: false, error: 'Failed to send greeting' });
      }
    });
  }

  // Telegram webhook for /start command
  const webhookPaths = ['/telegram/webhook', '/api/telegram/webhook'];
  for (const p of webhookPaths) {
    fastify.post(p, async (request, reply) => {
      try {
        const update = request.body as any;
        request.log.info({ update }, 'Received Telegram webhook update');

        const message = update?.message;
        const chatId: number | undefined = message?.chat?.id;
        const text: string | undefined = message?.text;

        request.log.info({ chatId, text }, 'Processing webhook message');

        if (!chatId) {
          request.log.warn('No chat ID in message, ignoring');
          return reply.send({ ok: true });
        }

        // If not /start, ignore silently
        if (!text || !text.toLowerCase().startsWith('/start')) {
          request.log.info({ text }, 'Not a /start message, ignoring');
          return reply.send({ ok: true, ignored: true });
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          request.log.error('TELEGRAM_BOT_TOKEN not set');
          return reply.send({ ok: true });
        }
        const apiBase = `https://api.telegram.org/bot${botToken}`;

        // Try to find existing user by telegramId
        const user = await fastify.models.User.findOne({ where: { telegramId: chatId } });
        request.log.info({ userId: user?.id, hasUser: !!user }, 'User lookup result');

        // Determine locale: user's languageCode if available, else message.from.language_code, else uz
        const preferredLang: string | undefined =
          (user as any)?.languageCode || message?.from?.language_code || undefined;
        const locale = pickSupportedLocale(preferredLang);
        const firstName: string = (user as any)?.firstName || message?.from?.first_name || '';

        request.log.info({ preferredLang, locale, firstName }, 'Greeting parameters');

        const lastVariant = (user as any)?.lastGreetingVariant ?? null;
        const { text: greeting, index } = nextGreeting(locale, firstName || "do'st", lastVariant);

        request.log.info({ greeting, index }, 'Generated greeting');

        const sendResp = await fetch(`${apiBase}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: greeting }),
        });

        const sendJson = await sendResp.json().catch(() => null as any);
        request.log.info({ sendStatus: sendResp.status, sendJson }, 'Telegram API response');

        const newMsgId = sendJson?.result?.message_id as number | undefined;

        if (user) {
          const updates: any = { lastGreetingVariant: index };
          if (newMsgId && Number.isFinite(newMsgId)) {
            updates.lastGreetingMessageId = newMsgId;
          }
          await (user as any).update(updates);
          request.log.info({ updates }, 'Updated user greeting state');
        }

        return reply.send({ ok: true });
      } catch (err) {
        request.log.error({ err }, 'Telegram webhook error');
        return reply.send({ ok: true });
      }
    });
  }
};

export default telegramRoutes;
