import { FastifyPluginAsync } from 'fastify';
import { Op } from 'sequelize';

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

async function uniqueFolderName(
  fastify: any,
  userId: number,
  parentId: number | null,
  baseName: string,
): Promise<string> {
  const trimBase = (baseName || '').trim() || 'Folder';
  let name = trimBase;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await fastify.models.Folder.findOne({ where: { userId, parentId, name } });
    if (!exists) return name;
    name = `${trimBase} (${n++})`;
  }
}

async function uniqueTextTitle(
  fastify: any,
  userId: number,
  folderId: number,
  baseTitle: string,
): Promise<string> {
  const trimBase = (baseTitle || '').trim() || 'Text';
  let title = trimBase;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await fastify.models.Text.findOne({ where: { userId, folderId, title } });
    if (!exists) return title;
    title = `${trimBase} (${n++})`;
  }
}

async function cloneFolderTree(
  fastify: any,
  sourceFolderId: number,
  fromUserId: number,
  toUserId: number,
  targetParentId: number | null,
): Promise<number> {
  // Create root clone
  const sourceFolder = await fastify.models.Folder.findOne({
    where: { id: sourceFolderId, userId: fromUserId },
  });
  if (!sourceFolder) throw new Error('Source folder not found');

  const newFolderName = await uniqueFolderName(
    fastify,
    toUserId,
    targetParentId,
    (sourceFolder as any).name,
  );
  const created = await fastify.models.Folder.create({
    userId: toUserId,
    name: newFolderName,
    parentId: targetParentId,
  });
  const newFolderId = created.id as number;

  // Clone texts under this folder
  const texts = await fastify.models.Text.findAll({
    where: { folderId: sourceFolderId, userId: fromUserId },
  });
  for (const tx of texts) {
    const newTitle = await uniqueTextTitle(fastify, toUserId, newFolderId, (tx as any).title);
    const newText = await fastify.models.Text.create({
      userId: toUserId,
      folderId: newFolderId,
      title: newTitle,
      uzRaw: (tx as any).uzRaw,
      enRaw: (tx as any).enRaw,
    });
    const sentences = await fastify.models.Sentence.findAll({
      where: { textId: (tx as any).id },
      order: [['index', 'ASC']],
    });
    if (sentences.length > 0) {
      const toCreate = sentences.map((s: any) => ({
        textId: newText.id,
        index: s.index,
        uz: s.uz,
        en: s.en,
      }));
      await fastify.models.Sentence.bulkCreate(toCreate);
    }
  }

  // Recurse for subfolders
  const children = await fastify.models.Folder.findAll({
    where: { parentId: sourceFolderId, userId: fromUserId },
  });
  for (const child of children) {
    await cloneFolderTree(fastify, (child as any).id, fromUserId, toUserId, newFolderId);
  }

  return newFolderId;
}

async function cascadeSetGlobal(
  fastify: any,
  userId: number,
  rootId: number,
  makeGlobal: boolean,
): Promise<void> {
  const queue: number[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const folder = await fastify.models.Folder.findOne({ where: { id, userId } });
    if (!folder) continue;
    if ((folder as any).isGlobal !== makeGlobal) {
      await (folder as any).update({ isGlobal: makeGlobal });
    }
    const children = await fastify.models.Folder.findAll({
      where: { parentId: id, userId },
      attributes: ['id'],
    });
    for (const ch of children) queue.push((ch as any).id as number);
  }
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
        attributes: ['id', 'name', 'parentId', 'createdAt', 'updatedAt', 'isGlobal'],
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
        attributes: ['id', 'name', 'parentId', 'createdAt', 'updatedAt', 'isGlobal'],
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
          isGlobal: (created as any).isGlobal,
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
          isGlobal: (folder as any).isGlobal,
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

    // POST publish -> mark folder as global (owner only, cascade)
    fastify.post(`${base}/:id/publish`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const folder = await fastify.models.Folder.findOne({ where: { id, userId } });
      if (!folder) return reply.code(404).send({ error: 'Not found' });
      await cascadeSetGlobal(fastify, userId, id, true);
      return reply.send({ id, isGlobal: true });
    });

    // POST unpublish -> mark folder as not global (cascade)
    fastify.post(`${base}/:id/unpublish`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const folder = await fastify.models.Folder.findOne({ where: { id, userId } });
      if (!folder) return reply.code(404).send({ error: 'Not found' });
      await cascadeSetGlobal(fastify, userId, id, false);
      return reply.send({ id, isGlobal: false });
    });

    // GET global folders (browse by parent)
    fastify.get(`${base}-global`, async (request, reply) => {
      // Any authenticated user can browse
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const q = request.query as Partial<{ parentId?: string | number | null }>;
      const parentIdParam = q?.parentId ?? null;
      const parentId =
        parentIdParam === null || parentIdParam === 'null' ? null : Number(parentIdParam);
      if (parentId !== null && !Number.isFinite(parentId)) {
        return reply.code(400).send({ error: 'Invalid parentId' });
      }

      const where: any = { isGlobal: true };
      if (parentId === null) where.parentId = null;
      else where.parentId = parentId;

      const folders = await fastify.models.Folder.findAll({
        where,
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'parentId', 'createdAt', 'updatedAt'],
      });
      return reply.send(folders);
    });

    // GET search global folders by name
    fastify.get(`${base}-global/search`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const q = (request.query as any)?.q ?? '';
      const query = String(q).trim();
      if (query.length < 1) return reply.send([]);
      const results = await fastify.models.Folder.findAll({
        where: { isGlobal: true, name: { [Op.iLike]: `%${query}%` } },
        order: [['name', 'ASC']],
        limit: 50,
        attributes: ['id', 'name', 'parentId'],
      });
      return reply.send(results);
    });

    // GET global folder texts list
    fastify.get(`${base}-global/:id/texts`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const folder = await fastify.models.Folder.findOne({ where: { id, isGlobal: true } });
      if (!folder) return reply.code(404).send({ error: 'Not found' });

      const texts = await fastify.models.Text.findAll({
        where: { folderId: id },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'title', 'createdAt'],
      });
      return reply.send(texts);
    });

    // POST import -> copy a global folder tree into user's folders
    fastify.post(`${base}-global/:id/import`, async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const source = await fastify.models.Folder.findOne({ where: { id, isGlobal: true } });
      if (!source) return reply.code(404).send({ error: 'Not found' });

      const body = request.body as Partial<{ parentId?: number | null; namePrefix?: string }>;
      const parentId =
        body?.parentId === undefined ? null : body.parentId === null ? null : Number(body.parentId);
      if (parentId !== null) {
        if (!Number.isFinite(parentId)) return reply.code(400).send({ error: 'Invalid parentId' });
        const parent = await fastify.models.Folder.findOne({ where: { id: parentId, userId } });
        if (!parent) return reply.code(404).send({ error: 'Parent not found' });
      }

      // Perform clone
      const newRootId = await cloneFolderTree(
        fastify,
        id,
        (source as any).userId,
        userId,
        parentId,
      );

      // Optionally rename root with prefix
      if (body?.namePrefix) {
        const newRoot = await fastify.models.Folder.findOne({ where: { id: newRootId, userId } });
        if (newRoot) {
          const newName = `${String(body.namePrefix)} ${(newRoot as any).name}`.trim();
          try {
            await (newRoot as any).update({ name: newName });
          } catch {}
        }
      }

      return reply.code(201).send({ id: newRootId });
    });
  }
};

export default foldersRoutes;
