import { FastifyPluginAsync } from 'fastify';

// Tiny curl examples:
// List root folders
//   curl -s http://localhost:4000/folders | jq .
//   curl -s http://localhost:4000/api/folders | jq .
// List children of folder 123
//   curl -s 'http://localhost:4000/folders?parentId=123' | jq .
// Create root folder
//   curl -s -X POST http://localhost:4000/folders -H 'Content-Type: application/json' -d '{"name":"Stories"}' | jq .
// Create subfolder under 123
//   curl -s -X POST http://localhost:4000/folders -H 'Content-Type: application/json' -d '{"name":"Tales","parentId":123}' | jq .
// Delete folder 123 (with cascade)
//   curl -s -X DELETE http://localhost:4000/api/folders/123 -H 'x-user-id: 1' -i

function getUserId(request: any): number | undefined {
  const reqAny = request as any;
  const headerVal = request.headers?.['x-user-id'] as string | string[] | undefined;
  const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const parsedHeader = fromHeader ? Number(fromHeader) : undefined;
  return reqAny.user?.id ?? (Number.isFinite(parsedHeader) ? (parsedHeader as number) : undefined);
}

const foldersRoutes: FastifyPluginAsync = async (fastify) => {
  const bases = ['/folders', '/api/folders'];

  for (const base of bases) {
    // GET -> list folders for current user (optionally within a parent)
    fastify.get(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const q = request.query as Partial<{ parentId?: string | number | null }>;
      const parentIdParam = q?.parentId ?? null;
      const parentId =
        parentIdParam === null || parentIdParam === 'null' ? null : Number(parentIdParam);

      if (parentId !== null && !Number.isFinite(parentId)) {
        return reply.code(400).send({ error: 'Invalid parentId' });
      }

      if (parentId !== null) {
        // Ensure parent belongs to user
        const parent = await fastify.models.Folder.findOne({ where: { id: parentId, userId } });
        if (!parent) {
          return reply.code(404).send({ error: 'Parent not found' });
        }
      }

      const folders = await fastify.models.Folder.findAll({
        where: { userId, parentId },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'parentId', 'createdAt', 'updatedAt'],
      });

      return reply.send(folders);
    });

    // GET one -> fetch folder by id (ensuring ownership)
    fastify.get(`${base}/:id`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      const folder = await fastify.models.Folder.findOne({
        where: { id, userId },
        attributes: ['id', 'name', 'parentId', 'createdAt', 'updatedAt'],
      });
      if (!folder) return reply.code(404).send({ error: 'Not found' });
      return reply.send(folder);
    });

    // POST -> create folder (root or subfolder)
    fastify.post(base, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as Partial<{ name: string; parentId?: number | null }>;
      const nameRaw = (body?.name ?? '').toString();
      const name = nameRaw.trim();
      const parentId =
        body?.parentId === undefined || body?.parentId === null ? null : Number(body.parentId);

      if (name.length < 1 || name.length > 100) {
        return reply.code(400).send({ error: 'Name must be 1-100 characters' });
      }
      if (parentId !== null && !Number.isFinite(parentId)) {
        return reply.code(400).send({ error: 'Invalid parentId' });
      }

      if (parentId !== null) {
        const parent = await fastify.models.Folder.findOne({ where: { id: parentId, userId } });
        if (!parent) {
          return reply.code(404).send({ error: 'Parent not found' });
        }
      }

      try {
        const created = await fastify.models.Folder.create({ userId, name, parentId });
        return reply.code(201).send({
          id: created.id,
          name: created.name,
          parentId: created.parentId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        });
      } catch (err: any) {
        const message = (err && err.message) || '';
        if (message.includes('folders_user_parent_name_unique') || message.includes('unique')) {
          return reply.code(409).send({ error: 'Name already exists' });
        }
        request.log.error({ err }, 'Failed to create folder');
        return reply.code(500).send({ error: 'Failed to create folder' });
      }
    });

    // PATCH -> rename folder or move folder (change parentId)
    fastify.patch(`${base}/:id`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const folder = await fastify.models.Folder.findOne({ where: { id, userId } });
      if (!folder) return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ name?: string; parentId?: number | null }>;
      const updates: any = {};

      if (body.name !== undefined) {
        const name = (body.name ?? '').toString().trim();
        if (!name) return reply.code(400).send({ error: 'Name is required' });
        if (name.length < 1 || name.length > 100)
          return reply.code(400).send({ error: 'Name must be 1-100 characters' });
        updates.name = name;
      }

      if (body.parentId !== undefined) {
        const newParentId = body.parentId === null ? null : Number(body.parentId);
        if (newParentId !== null && !Number.isFinite(newParentId)) {
          return reply.code(400).send({ error: 'Invalid parentId' });
        }
        if (newParentId === id) {
          return reply.code(400).send({ error: 'Cannot move folder into itself' });
        }
        if (newParentId !== null) {
          const newParent = await fastify.models.Folder.findOne({
            where: { id: newParentId, userId },
          });
          if (!newParent) return reply.code(404).send({ error: 'Parent not found' });
          // Prevent cycles: ensure id is not an ancestor of newParent
          let cursor: any = newParent;
          while (cursor) {
            if (cursor.id === id) {
              return reply.code(400).send({ error: 'Cannot move folder into its descendant' });
            }
            if (!cursor.parentId) break;
            cursor = await fastify.models.Folder.findOne({
              where: { id: cursor.parentId, userId },
              attributes: ['id', 'parentId'],
            });
          }
        }
        updates.parentId = newParentId;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        await (folder as any).update(updates);
        return reply.send({
          id: (folder as any).id,
          name: (folder as any).name,
          parentId: (folder as any).parentId,
          createdAt: (folder as any).createdAt,
          updatedAt: (folder as any).updatedAt,
        });
      } catch (err: any) {
        const message = (err && err.message) || '';
        if (message.includes('folders_user_parent_name_unique') || message.includes('unique')) {
          return reply.code(409).send({ error: 'Name already exists' });
        }
        request.log.error({ err }, 'Failed to rename/move folder');
        return reply.code(500).send({ error: 'Failed to update folder' });
      }
    });

    // DELETE -> delete folder (cascade)
    fastify.delete(`${base}/:id`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const exists = await fastify.models.Folder.findOne({ where: { id, userId } });
      if (!exists) return reply.code(404).send({ error: 'Not found' });

      await fastify.models.Folder.destroy({ where: { id, userId } });
      return reply.code(204).send();
    });
  }
};

export default foldersRoutes;
