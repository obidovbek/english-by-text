import { FastifyPluginAsync } from 'fastify';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  function getUserId(request: any): number | undefined {
    const reqAny = request as any;
    const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
    const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
    return (
      reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined)
    );
  }

  fastify.patch('/api/users/me', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ ok: false, error: 'Unauthorized' });

    const body = request.body as Partial<{ languageCode: string | null }> | undefined;
    const nextLang = (body?.languageCode || '').trim();

    const user = await fastify.models.User.findOne({ where: { id: userId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'User not found' });

    await (user as any).update({ languageCode: nextLang || null });
    return reply.send({ ok: true });
  });
};

export default usersRoutes;
