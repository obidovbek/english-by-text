import { FastifyPluginAsync } from 'fastify';

// curl examples:
// List tokens: curl -s http://localhost:4000/api/sentences/1/tokens -H 'x-user-id: 1' | jq .
// Generate: curl -s -X POST http://localhost:4000/api/sentences/1/tokens/generate -H 'x-user-id: 1' | jq .
// Update token: curl -s -X PATCH http://localhost:4000/api/sentences/1/tokens/5 -H 'Content-Type: application/json' -H 'x-user-id: 1' -d '{"en":"hello"}' | jq .
// Update sentence: curl -s -X PATCH http://localhost:4000/api/sentences/1 -H 'Content-Type: application/json' -H 'x-user-id: 1' -d '{"en":"Hello there"}' | jq .
// Save progress: curl -s -X PATCH http://localhost:4000/api/texts/9/progress -H 'Content-Type: application/json' -H 'x-user-id: 1' -d '{"index":3}' | jq .

function getUserId(request: any): number | undefined {
  const reqAny = request as any;
  const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
  return reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined);
}

function tokenizeUz(input: string): string[] {
  // Split by spaces but keep punctuation tokens separate
  const tokens: string[] = [];
  const regex = /(\w+|[^\s\w])/gu;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(input)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

const tokensRoutes: FastifyPluginAsync = async (fastify) => {
  // GET tokens
  const getPaths = ['/api/sentences/:id/tokens', '/sentences/:id/tokens'];
  for (const p of getPaths) {
    fastify.get(p, async (request: any, reply: any) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      // Ensure ownership via join Text -> Sentence
      const sentence = await fastify.models.Sentence.findOne({
        where: { id },
        include: [{ model: fastify.models.Text, attributes: ['userId'], required: true }] as any,
      });
      if (!sentence || (sentence as any).Text.userId !== userId)
        return reply.code(404).send({ error: 'Not found' });

      const tokens = await fastify.models.Token.findAll({
        where: { sentenceId: id },
        order: [['order', 'ASC']],
      });
      return reply.send(tokens);
    });
  }

  // POST generate tokens
  const postGenPaths = ['/api/sentences/:id/tokens/generate', '/sentences/:id/tokens/generate'];
  for (const p of postGenPaths) {
    fastify.post(p, async (request: any, reply: any) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const sentence = await fastify.models.Sentence.findOne({
        where: { id },
        include: [{ model: fastify.models.Text, attributes: ['userId'], required: true }] as any,
      });
      if (!sentence || (sentence as any).Text.userId !== userId)
        return reply.code(404).send({ error: 'Not found' });

      const existing = await fastify.models.Token.count({ where: { sentenceId: id } });
      if (existing > 0) return reply.code(409).send({ error: 'Tokens already exist' });

      const pieces = tokenizeUz((sentence as any).uz as string);
      const created = await fastify.models.Token.bulkCreate(
        pieces.map((p, i) => ({ sentenceId: id, order: i, uz: p, en: '' })),
      );

      return reply.code(201).send(created);
    });
  }

  // PATCH update token
  const patchTokenPaths = [
    '/api/sentences/:sentenceId/tokens/:tokenId',
    '/sentences/:sentenceId/tokens/:tokenId',
  ];
  for (const p of patchTokenPaths) {
    fastify.patch(p, async (request: any, reply: any) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const sentenceId = Number((request.params as any).sentenceId);
      const tokenId = Number((request.params as any).tokenId);
      if (!Number.isFinite(sentenceId) || !Number.isFinite(tokenId))
        return reply.code(400).send({ error: 'Invalid id' });

      const sentence = await fastify.models.Sentence.findOne({
        where: { id: sentenceId },
        include: [{ model: fastify.models.Text, attributes: ['userId'], required: true }] as any,
      });
      if (!sentence || (sentence as any).Text.userId !== userId)
        return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ en?: string; pos?: string; note?: string }>;
      const updates: any = {};
      if (body.en !== undefined) {
        const en = String(body.en);
        if (en.length > 200) return reply.code(400).send({ error: 'en too long (max 200)' });
        updates.en = en;
      }
      if (body.pos !== undefined) updates.pos = String(body.pos);
      if (body.note !== undefined) updates.note = String(body.note);

      const token = await fastify.models.Token.findOne({ where: { id: tokenId, sentenceId } });
      if (!token) return reply.code(404).send({ error: 'Token not found' });

      await token.update(updates);
      return reply.send(token);
    });
  }

  // PATCH sentence
  const patchSentencePaths = ['/api/sentences/:id', '/sentences/:id'];
  for (const p of patchSentencePaths) {
    fastify.patch(p, async (request: any, reply: any) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const sentence = await fastify.models.Sentence.findOne({
        where: { id },
        include: [{ model: fastify.models.Text, attributes: ['userId'], required: true }] as any,
      });
      if (!sentence || (sentence as any).Text.userId !== userId)
        return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ en?: string }>;
      if (body.en !== undefined) await (sentence as any).update({ en: String(body.en) });

      return reply.send(sentence);
    });
  }

  // PATCH text progress
  const patchProgressPaths = ['/api/texts/:id/progress', '/texts/:id/progress'];
  for (const p of patchProgressPaths) {
    fastify.patch(p, async (request: any, reply: any) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const text = await fastify.models.Text.findOne({ where: { id, userId } });
      if (!text) return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ index: number }>;
      const index = Number(body?.index);
      if (!Number.isFinite(index) || index < 0)
        return reply.code(400).send({ error: 'Invalid index' });
      await text.update({ lastIndex: index });
      return reply.send({ ok: true, lastIndex: text.lastIndex });
    });
  }
};

export default tokensRoutes;
