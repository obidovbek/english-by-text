import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';

function getUserId(request: any): number | undefined {
  const reqAny = request as any;
  const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
  return reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined);
}

const vocabularyRoutes: FastifyPluginAsync = async (fastify) => {
  const bases = ['/vocabulary', '/api/vocabulary'];

  for (const base of bases) {
    // GET list (cursor pagination)
    fastify.get(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const q = (request as any).query || {};
      const limit = Math.max(1, Math.min(200, Number(q.limit ?? 50) || 50));
      const cursorTsRaw = q.cursor !== undefined ? Number(q.cursor) : undefined;
      const cursorIdRaw = q.cursorId !== undefined ? Number(q.cursorId) : undefined;
      const cursorTs = Number.isFinite(cursorTsRaw) ? (cursorTsRaw as number) : undefined;
      const cursorId = Number.isFinite(cursorIdRaw) ? (cursorIdRaw as number) : undefined;

      const where: any = { userId };
      if (cursorTs !== undefined) {
        const cursorDate = new Date(cursorTs);
        if (Number.isFinite(cursorDate.getTime())) {
          if (cursorId !== undefined) {
            where[Op.or] = [
              { createdAt: { [Op.lt]: cursorDate } },
              { [Op.and]: [{ createdAt: { [Op.eq]: cursorDate } }, { id: { [Op.lt]: cursorId } }] },
            ];
          } else {
            where.createdAt = { [Op.lt]: cursorDate };
          }
        }
      }

      const results = await fastify.models.Vocabulary.findAll({
        where,
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
        attributes: [
          'id',
          'word',
          'translation',
          'note',
          'language',
          'lastReviewedAt',
          'nextReviewAt',
          'easeFactor',
          'intervalDays',
          'repetition',
          'correctStreak',
          'totalReviews',
          'totalCorrect',
          'lastResult',
          'createdAt',
        ],
        limit: limit + 1,
      });

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const last = items[items.length - 1] as any;
      const nextCursor =
        hasMore && last?.createdAt ? new Date(last.createdAt).getTime() : undefined;
      const nextCursorId = hasMore && last?.id ? Number(last.id) : undefined;

      return reply.send({ items, nextCursor, nextCursorId });
    });

    // POST create
    fastify.post(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const body = request.body as Partial<{
        word: string;
        translation: string;
        note?: string;
        language?: string;
      }>;
      const word = (body?.word ?? '').toString().trim();
      const translation = (body?.translation ?? '').toString().trim();
      const note = body?.note ? String(body.note) : null;
      const language = body?.language ? String(body.language).slice(0, 16) : null;
      if (!word || !translation)
        return reply.code(400).send({ error: 'word and translation are required' });
      if (word.length > 200) return reply.code(400).send({ error: 'word too long' });
      if (translation.length > 400) return reply.code(400).send({ error: 'translation too long' });

      const created = await fastify.models.Vocabulary.create({
        userId,
        word,
        translation,
        note,
        language,
      });
      return reply.code(201).send({
        id: created.id,
        word: created.word,
        translation: created.translation,
        note: created.note,
        language: (created as any).language ?? null,
        createdAt: (created as any).createdAt,
      });
    });

    // PATCH update
    fastify.patch(`${base}/:id`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const body = request.body as Partial<{
        word?: string;
        translation?: string;
        note?: string | null;
        language?: string | null;
      }>;
      const updates: any = {};
      if (body.word !== undefined) {
        const w = String(body.word).trim();
        if (!w) return reply.code(400).send({ error: 'word required' });
        if (w.length > 200) return reply.code(400).send({ error: 'word too long' });
        updates.word = w;
      }
      if (body.translation !== undefined) {
        const tr = String(body.translation).trim();
        if (!tr) return reply.code(400).send({ error: 'translation required' });
        if (tr.length > 400) return reply.code(400).send({ error: 'translation too long' });
        updates.translation = tr;
      }
      if (body.note !== undefined) {
        updates.note = body.note === null ? null : String(body.note);
      }
      if (body.language !== undefined) {
        updates.language = body.language === null ? null : String(body.language).slice(0, 16);
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      const item = await fastify.models.Vocabulary.findOne({ where: { id, userId } });
      if (!item) return reply.code(404).send({ error: 'Not found' });

      await (item as any).update(updates);
      return reply.send({
        id: (item as any).id,
        word: (item as any).word,
        translation: (item as any).translation,
        note: (item as any).note,
        language: (item as any).language ?? null,
        createdAt: (item as any).createdAt,
      });
    });

    // DELETE one
    fastify.delete(`${base}/:id`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const exists = await fastify.models.Vocabulary.findOne({ where: { id, userId } });
      if (!exists) return reply.code(404).send({ error: 'Not found' });

      await fastify.models.Vocabulary.destroy({ where: { id, userId } });
      return reply.code(204).send();
    });
  }
};

export default vocabularyRoutes;
