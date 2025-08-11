import { FastifyPluginAsync } from 'fastify';

// Tiny curl examples:
// Create text:
//   curl -s -X POST http://localhost:4000/api/folders/1/texts -H 'Content-Type: application/json' -H 'x-user-id: 1' \
//     -d '{"title":"Folk Tale","uzRaw":"Salom dunyo. Yaxshimisan?","enRaw":"Hello world. How are you?"}' | jq .
// List texts in folder:
//   curl -s http://localhost:4000/api/folders/1/texts -H 'x-user-id: 1' | jq .
// Get one text:
//   curl -s http://localhost:4000/api/texts/1 -H 'x-user-id: 1' | jq .
// Delete one text:
//   curl -s -X DELETE http://localhost:4000/api/texts/1 -H 'x-user-id: 1' -i

function getUserId(request: any): number | undefined {
  const reqAny = request as any;
  const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
  return reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined);
}

function splitSentences(input: string): string[] {
  const parts: string[] = [];
  const regex = /([^\s].*?[.?!…]+)(?:\s+|$)/gs; // capture up to punctuation
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(input)) !== null) {
    parts.push(match[1].trim());
    lastIndex = regex.lastIndex;
  }
  const tail = input.slice(lastIndex).trim();
  if (tail) parts.push(tail);
  return parts;
}

const textsRoutes: FastifyPluginAsync = async (fastify) => {
  const folderBases = ['/folders/:folderId/texts', '/api/folders/:folderId/texts'];
  const textBases = ['/texts/:id', '/api/texts/:id'];

  // POST create text in folder
  for (const base of folderBases) {
    fastify.post(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const params = request.params as any;
      const folderId = Number(params.folderId);
      if (!Number.isFinite(folderId)) return reply.code(400).send({ error: 'Invalid folderId' });

      // Verify folder ownership
      const folder = await fastify.models.Folder.findOne({ where: { id: folderId, userId } });
      if (!folder) return reply.code(404).send({ error: 'Folder not found' });

      const body = request.body as Partial<{ title: string; uzRaw: string; enRaw: string }>;
      const title = (body?.title ?? '').toString().trim();
      const uzRaw = (body?.uzRaw ?? '').toString();
      const enRaw = (body?.enRaw ?? '').toString();

      if (title.length < 1 || title.length > 200) {
        return reply.code(400).send({ error: 'Title must be 1-200 characters' });
      }
      if (!uzRaw.trim() || !enRaw.trim()) {
        return reply.code(400).send({ error: 'uzRaw and enRaw are required' });
      }

      const text = await fastify.models.Text.create({ userId, folderId, title, uzRaw, enRaw });

      // Split into sentences and create records
      const uzParts = splitSentences(uzRaw);
      const enParts = splitSentences(enRaw);
      const maxLen = Math.max(uzParts.length, enParts.length);

      const toCreate = Array.from({ length: maxLen }, (_, i) => ({
        textId: text.id,
        index: i,
        uz: uzParts[i] ?? '',
        en: enParts[i] ?? '',
      }));

      if (toCreate.length > 0) {
        await fastify.models.Sentence.bulkCreate(toCreate);
      }

      return reply.code(201).send({ id: text.id, title: text.title });
    });

    // GET list texts in a folder
    fastify.get(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const params = request.params as any;
      const folderId = Number(params.folderId);
      if (!Number.isFinite(folderId)) return reply.code(400).send({ error: 'Invalid folderId' });

      const folder = await fastify.models.Folder.findOne({ where: { id: folderId, userId } });
      if (!folder) return reply.code(404).send({ error: 'Folder not found' });

      const texts = await fastify.models.Text.findAll({
        where: { userId, folderId },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'title', 'createdAt'],
      });

      return reply.send(texts);
    });
  }

  // GET/PATCH/DELETE one text
  for (const base of textBases) {
    fastify.get(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const text = await fastify.models.Text.findOne({ where: { id, userId } });
      if (!text) return reply.code(404).send({ error: 'Not found' });

      const sentences = await fastify.models.Sentence.findAll({
        where: { textId: id },
        order: [['index', 'ASC']],
        attributes: ['id', 'index', 'uz', 'en'],
      });

      return reply.send({
        id: text.id,
        title: text.title,
        lastIndex: (text as any).lastIndex,
        uzRaw: (text as any).uzRaw,
        enRaw: (text as any).enRaw,
        sentences,
      });
    });

    fastify.patch(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const text = await fastify.models.Text.findOne({ where: { id, userId } });
      if (!text) return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ title?: string; uzRaw?: string; enRaw?: string }>;
      const updates: any = {};
      if (body.title !== undefined) {
        const title = String(body.title).trim();
        if (title.length < 1 || title.length > 200)
          return reply.code(400).send({ error: 'Title must be 1-200 characters' });
        updates.title = title;
      }
      if (body.uzRaw !== undefined) {
        const uzRaw = String(body.uzRaw);
        if (!uzRaw.trim()) return reply.code(400).send({ error: 'uzRaw is required' });
        updates.uzRaw = uzRaw;
      }
      if (body.enRaw !== undefined) {
        const enRaw = String(body.enRaw);
        if (!enRaw.trim()) return reply.code(400).send({ error: 'enRaw is required' });
        updates.enRaw = enRaw;
      }

      // If raw contents are updated, we need to rebuild sentences
      const needRebuild = updates.uzRaw !== undefined || updates.enRaw !== undefined;

      try {
        await (text as any).update(updates);

        if (needRebuild) {
          const uzRaw = updates.uzRaw !== undefined ? updates.uzRaw : (text as any).uzRaw;
          const enRaw = updates.enRaw !== undefined ? updates.enRaw : (text as any).enRaw;
          const uzParts = splitSentences(uzRaw);
          const enParts = splitSentences(enRaw);
          const maxLen = Math.max(uzParts.length, enParts.length);

          // Replace all sentences for this text
          await fastify.models.Sentence.destroy({ where: { textId: id } });
          const toCreate = Array.from({ length: maxLen }, (_, i) => ({
            textId: id,
            index: i,
            uz: uzParts[i] ?? '',
            en: enParts[i] ?? '',
          }));
          if (toCreate.length > 0) {
            await fastify.models.Sentence.bulkCreate(toCreate);
          }
        }
      } catch (err: any) {
        const message = (err && err.message) || '';
        if (message.includes('texts_user_folder_title_unique') || message.includes('unique')) {
          return reply.code(409).send({ error: 'Title already exists' });
        }
        request.log.error({ err }, 'Failed to update text');
        return reply.code(500).send({ error: 'Failed to update text' });
      }

      return reply.send({
        id: (text as any).id,
        title: (text as any).title,
        lastIndex: (text as any).lastIndex,
        uzRaw: (text as any).uzRaw,
        enRaw: (text as any).enRaw,
      });
    });

    fastify.delete(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const exists = await fastify.models.Text.findOne({ where: { id, userId } });
      if (!exists) return reply.code(404).send({ error: 'Not found' });

      await fastify.models.Text.destroy({ where: { id, userId } });
      return reply.code(204).send();
    });
  }
};

export default textsRoutes;
