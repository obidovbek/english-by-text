import { FastifyPluginAsync } from 'fastify';
import { createWriteStream } from 'fs';
import path from 'path';

function normalizePerLanguage(input: string, lang: string): string {
  let s = (input || '').toLowerCase().trim();
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[\p{P}\p{S}]/gu, '');
  if (lang === 'ru') {
    s = s.replace(/ё/g, 'е');
  }
  if (lang === 'tr') {
    s = s.replace(/ı/g, 'i');
  }
  return s.replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function sm2Schedule(
  prevEase: number,
  prevInterval: number,
  repetition: number,
  quality: 0 | 1 | 2 | 3 | 4 | 5,
): { ease: number; interval: number; repetition: number } {
  let ease = prevEase;
  if (quality < 3) {
    return { ease, interval: 1, repetition: 0 };
  }
  ease = Math.max(1.3, ease + 0.1 - (5 - quality) * 0.08);
  let interval = 0;
  let rep = repetition;
  if (rep <= 1) interval = 1;
  else if (rep === 2) interval = 6;
  else interval = Math.round(prevInterval * ease);
  return { ease, interval, repetition: rep + 1 };
}

async function tryFetchJson(url: string, body: FormData): Promise<any> {
  const res = await fetch(url, { method: 'POST', body: body as any });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(`STT HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const studyRoutes: FastifyPluginAsync = async (fastify) => {
  const bases = ['/api', ''];
  for (const base of bases) {
    fastify.post(`${base}/tts`, async (request, reply) => {
      const body = request.body as Partial<{
        text: string;
        language?: string;
        provider?: 'piper' | 'coqui';
        voice?: string;
        speed?: number;
      }>;
      const text = (body?.text ?? '').toString();
      if (!text) return reply.code(400).send({ error: 'text required' });
      const language = (body?.language ?? 'en').toString();
      const provider = (body?.provider ?? (language === 'uz' ? 'coqui' : 'piper')) as
        | 'piper'
        | 'coqui';

      if (provider === 'piper') {
        try {
          const piperUrl = process.env.PIPER_TTS_URL || 'http://tts-piper:8080/api/tts';
          const qs = new URLSearchParams({ text });
          if (body?.voice) qs.set('voice', body.voice);
          if (body?.speed) qs.set('speed', String(body.speed));
          const res = await fetch(`${piperUrl}?${qs.toString()}`);
          if (!res.ok) return reply.code(502).send({ error: 'TTS piper failed' });
          reply.header('Content-Type', 'audio/wav');
          reply.header('Cache-Control', 'no-store');
          return reply.send(Buffer.from(await res.arrayBuffer()));
        } catch (e: any) {
          return reply.code(502).send({ error: e?.message || 'TTS piper unreachable' });
        }
      }

      try {
        const coquiUrl = process.env.COQUI_TTS_URL || 'http://tts-uz:5002/api/tts';
        const form = new URLSearchParams();
        form.set('text', text);
        form.set('language-id', language);
        if (body?.voice) form.set('speaker-id', body.voice);
        const res = await fetch(coquiUrl, { method: 'POST', body: form as any });
        if (!res.ok) return reply.code(502).send({ error: 'TTS coqui failed' });
        reply.header('Content-Type', 'audio/wav');
        reply.header('Cache-Control', 'no-store');
        return reply.send(Buffer.from(await res.arrayBuffer()));
      } catch (e: any) {
        return reply.code(502).send({ error: e?.message || 'TTS coqui unreachable' });
      }
    });

    fastify.post(`${base}/stt`, async (request, reply) => {
      let buf: Buffer | null = null;
      if (Buffer.isBuffer(request.body)) {
        buf = request.body as Buffer;
      }
      if (!buf) {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          (request.raw as any)
            .on('data', (c: Buffer) => chunks.push(c))
            .on('end', () => resolve())
            .on('error', reject);
        });
        buf = Buffer.concat(chunks);
      }
      if (!buf || buf.length === 0) {
        return reply.code(400).send({ error: 'Empty audio payload' });
      }

      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'audio/webm' }), 'audio.webm');
      form.append('parameters', JSON.stringify({ batch_size: 1 }));

      const candidates = [
        process.env.STT_SERVICE_URL,
        'http://stt:7860',
        'http://linguatext_stt:7860',
        'http://localhost:7860',
      ].filter(Boolean) as string[];

      let lastErr: any = null;
      for (const baseUrl of candidates) {
        try {
          const json = await tryFetchJson(baseUrl, form);
          const text = json?.text || json?.transcript || '';
          return reply.send({ text });
        } catch (e: any) {
          lastErr = e;
          fastify.log.warn({ err: e }, `STT fetch failed at ${baseUrl}`);
        }
      }
      return reply.code(502).send({ error: lastErr?.message || 'STT unreachable' });
    });

    fastify.post(`${base}/evaluate`, async (request, reply) => {
      const body = request.body as Partial<{
        target: string;
        hypothesis: string;
        language?: string;
        threshold?: number;
      }>;
      const target = (body?.target ?? '').toString();
      const hypothesis = (body?.hypothesis ?? '').toString();
      const lang = (body?.language ?? 'en').toString();
      if (!target) return reply.code(400).send({ error: 'target required' });
      const nt = normalizePerLanguage(target, lang);
      const nh = normalizePerLanguage(hypothesis, lang);
      const dist = levenshtein(nt, nh);
      const maxLen = Math.max(nt.length, 1);
      const similarity = 1 - dist / maxLen;
      const threshold = typeof body?.threshold === 'number' ? body!.threshold! : 0.85;
      return reply.send({
        normalizedTarget: nt,
        normalizedHypothesis: nh,
        distance: dist,
        similarity,
        correct: similarity >= threshold,
        threshold,
      });
    });

    fastify.post(`${base}/review/:id`, async (request, reply) => {
      const userId = (request as any).user?.id || undefined;
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
      const id = Number((request.params as any).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });
      const body = request.body as Partial<{ quality: 0 | 1 | 2 | 3 | 4 | 5 }>;
      const quality = (body?.quality ?? 3) as 0 | 1 | 2 | 3 | 4 | 5;
      const item = await fastify.models.Vocabulary.findOne({ where: { id, userId } });
      if (!item) return reply.code(404).send({ error: 'Not found' });
      const ease = (item as any).easeFactor ?? 2.5;
      const interval = (item as any).intervalDays ?? 0;
      const repetition = (item as any).repetition ?? 0;
      const {
        ease: nextEase,
        interval: nextInterval,
        repetition: nextRep,
      } = sm2Schedule(ease, interval, repetition, quality);
      const now = new Date();
      const next = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);
      await (item as any).update({
        lastReviewedAt: now,
        nextReviewAt: next,
        easeFactor: nextEase,
        intervalDays: nextInterval,
        repetition: nextRep,
        totalReviews: ((item as any).totalReviews ?? 0) + 1,
        totalCorrect: ((item as any).totalCorrect ?? 0) + (quality >= 3 ? 1 : 0),
        correctStreak: quality >= 3 ? ((item as any).correctStreak ?? 0) + 1 : 0,
        lastResult: quality >= 3,
      });
      return reply.send({ ok: true });
    });
  }
};

export default studyRoutes;
