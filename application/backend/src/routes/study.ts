import { FastifyPluginAsync } from 'fastify';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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

// Normalize Uzbek Latin apostrophes to the proper character for better TTS (oʻ, gʻ)
function normalizeUzbekTextForTTS(input: string): string {
  if (!input) return input;
  // Replace o' / O' (and common apostrophe variants) with oʻ / Oʻ (U+02BB)
  const apos = "['’ʻʼ]";
  return input
    .replace(new RegExp(`(o)${apos}`, 'gi'), (m) => (m[0] === 'O' ? 'Oʻ' : 'oʻ'))
    .replace(new RegExp(`(g)${apos}`, 'gi'), (m) => (m[0] === 'G' ? 'Gʻ' : 'gʻ'));
}

// For espeak-ng, prefer plain ASCII apostrophes in Uzbek Latin
function normalizeUzbekTextForEspeak(input: string): string {
  if (!input) return input;
  return input.replace(/[ʻ’ʼ]/g, "'");
}

function guessUzbekFromText(input: string): boolean {
  const s = input || '';
  if (!s) return false;
  // Cyrillic Uzbek letters
  if (/[ўқғҳЎҚҒҲ]/.test(s)) return true;
  // Latin o'/g' patterns including various apostrophes or precomposed oʻ/gʻ
  if (/(o[\u02BB'’ʼʻ]|g[\u02BB'’ʼʻ])/i.test(s)) return true;
  return false;
}

const studyRoutes: FastifyPluginAsync = async (fastify) => {
  const bases = ['/api', ''];
  for (const base of bases) {
    fastify.post(`${base}/tts`, async (request, reply) => {
      const body = request.body as Partial<{
        text: string;
        language?: string;
        provider?: 'piper' | 'coqui' | 'espeak';
        voice?: string;
        speed?: number;
        speakerWav?: string;
        pitch?: number;
        amplitude?: number;
        gap?: number;
        format?: 'audio' | 'ipa';
      }>;
      const text = (body?.text ?? '').toString();
      if (!text) return reply.code(400).send({ error: 'text required' });
      const rawLanguage = (body?.language ?? (guessUzbekFromText(text) ? 'uz' : 'en')).toString();
      const language = rawLanguage.toLowerCase().startsWith('uz')
        ? 'uz'
        : rawLanguage.toLowerCase().startsWith('ru')
          ? 'ru'
          : rawLanguage.toLowerCase().startsWith('tr')
            ? 'tr'
            : rawLanguage.toLowerCase().startsWith('ko')
              ? 'ko'
              : rawLanguage.toLowerCase().startsWith('ja')
                ? 'ja'
                : rawLanguage.toLowerCase().startsWith('zh')
                  ? 'zh'
                  : rawLanguage.toLowerCase().startsWith('ar')
                    ? 'ar'
                    : rawLanguage.toLowerCase().startsWith('de')
                      ? 'de'
                      : rawLanguage.toLowerCase().startsWith('fr')
                        ? 'fr'
                        : rawLanguage.toLowerCase().startsWith('es')
                          ? 'es'
                          : 'en';

      const envFor = (prefix: string, lang: string): string | undefined => {
        const upper = lang.toUpperCase().replace(/[-]/g, '_');
        return (
          process.env[`${prefix}_${upper}`] ||
          process.env[`${prefix}_${lang}`] ||
          process.env[prefix]
        );
      };

      const preferredProvider = (body?.provider || envFor('PREFERRED_TTS_PROVIDER', language)) as
        | 'piper'
        | 'coqui'
        | 'espeak';

      // Prepare text for TTS (Uzbek-specific normalization)
      const textForTts = language === 'uz' ? normalizeUzbekTextForTTS(text) : text;

      const tryPiper = async (voiceHint?: string) => {
        const piperUrl = process.env.PIPER_TTS_URL || 'http://tts-piper:8080/api/tts';
        const qs = new URLSearchParams({ text: textForTts });
        const chosenVoice = (body?.voice || voiceHint || envFor('PIPER_VOICE', language)) ?? '';
        const speed = body?.speed || Number(envFor('PIPER_SPEED', language) || '') || undefined;
        if (chosenVoice) qs.set('voice', chosenVoice);
        if (speed) qs.set('speed', String(speed));
        const res = await fetch(`${piperUrl}?${qs.toString()}`);
        if (!res.ok) throw new Error(`Piper not ok (${res.status})`);
        reply.header('Content-Type', 'audio/wav');
        reply.header('Cache-Control', 'no-store');
        return Buffer.from(await res.arrayBuffer());
      };

      const tryCoqui = async (langHint?: string, speakerHint?: string) => {
        const coquiUrl = process.env.COQUI_TTS_URL || 'http://tts-coqui:5000/tts';
        const form = new URLSearchParams();
        form.set('text', textForTts);
        const langParam = langHint || envFor('COQUI_LANGUAGE', language) || language;
        // Send both common variants for compatibility
        form.set('language_id', langParam);
        form.set('language', langParam);
        const speaker = body?.voice || speakerHint || envFor('COQUI_SPEAKER', language);
        if (speaker) {
          form.set('speaker_id', speaker);
          form.set('speaker', speaker);
        }
        const speakerWav = body?.speakerWav || envFor('COQUI_SPEAKER_WAV', language);
        if (speakerWav) {
          form.set('speaker_wav', speakerWav);
        }
        const res = await fetch(coquiUrl, { method: 'POST', body: form as any });
        if (!res.ok) throw new Error(`Coqui not ok (${res.status})`);
        reply.header('Content-Type', 'audio/wav');
        reply.header('Cache-Control', 'no-store');
        return Buffer.from(await res.arrayBuffer());
      };

      const tryEspeak = async () => {
        const voice = (body?.voice || envFor('ESPEAK_VOICE', language) || language || 'uz').trim();
        const speed = body?.speed || Number(envFor('ESPEAK_SPEED', language) || '') || undefined;
        const pitch = body?.pitch || Number(envFor('ESPEAK_PITCH', language) || '') || undefined;
        const amplitude =
          body?.amplitude || Number(envFor('ESPEAK_AMPLITUDE', language) || '') || undefined;
        const gap = body?.gap || Number(envFor('ESPEAK_GAP', language) || '') || undefined;
        const isIpa = (body?.format || '').toLowerCase() === 'ipa';
        const args = ['-v', voice, isIpa ? '--ipa' : '--stdout'];
        const espeakDataPath = process.env.ESPEAK_DATA_PATH || '';
        if (espeakDataPath && existsSync(espeakDataPath)) {
          args.push('--path', espeakDataPath);
        }
        if (speed && Number.isFinite(speed)) {
          args.push('-s', String(Math.max(80, Math.min(300, Math.round(speed)))));
        }
        if (pitch && Number.isFinite(pitch)) {
          args.push('-p', String(Math.max(0, Math.min(99, Math.round(pitch)))));
        }
        if (amplitude && Number.isFinite(amplitude)) {
          args.push('-a', String(Math.max(0, Math.min(200, Math.round(amplitude)))));
        }
        if (gap && Number.isFinite(gap)) {
          args.push('-g', String(Math.max(0, Math.min(1000, Math.round(gap)))));
        }
        const proc = spawn('espeak-ng', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        const textForEspeak = language === 'uz' ? normalizeUzbekTextForEspeak(text) : text;
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        proc.stdout.on('data', (d) => stdoutChunks.push(Buffer.from(d)));
        proc.stderr.on('data', (d) => stderrChunks.push(Buffer.from(d)));
        const done: Promise<Buffer> = new Promise((resolve, reject) => {
          proc.on('error', reject);
          proc.on('close', (code) => {
            if (code === 0 && stdoutChunks.length > 0) {
              resolve(Buffer.concat(stdoutChunks));
            } else {
              const msg = Buffer.concat(stderrChunks).toString('utf8') || `espeak-ng exit ${code}`;
              reject(new Error(msg));
            }
          });
        });
        proc.stdin.write(textForEspeak);
        proc.stdin.end();
        const out = await done;
        if (isIpa) {
          reply.header('Content-Type', 'text/plain; charset=utf-8');
          reply.header('Cache-Control', 'no-store');
          return out.toString('utf8');
        }
        reply.header('Content-Type', 'audio/wav');
        reply.header('Cache-Control', 'no-store');
        return out;
      };

      const provider = preferredProvider ?? (language === 'uz' ? 'espeak' : 'piper');

      if (provider === 'piper') {
        try {
          const buf = await tryPiper();
          return reply.send(buf);
        } catch (e: any) {
          try {
            const buf2 = await tryCoqui();
            return reply.send(buf2);
          } catch (e2: any) {
            if (language === 'uz') {
              try {
                const buf3 = await tryEspeak();
                return reply.send(buf3);
              } catch (e3: any) {
                return reply.code(502).send({ error: e3?.message || 'TTS providers unreachable' });
              }
            }
            return reply.code(502).send({ error: e2?.message || 'TTS providers unreachable' });
          }
        }
      }

      if (provider === 'coqui') {
        try {
          const buf = await tryCoqui();
          return reply.send(buf);
        } catch (e: any) {
          try {
            const buf2 = await tryPiper();
            return reply.send(buf2);
          } catch (e2: any) {
            if (language === 'uz') {
              try {
                const buf3 = await tryEspeak();
                return reply.send(buf3);
              } catch (e3: any) {
                return reply.code(502).send({ error: e3?.message || 'TTS providers unreachable' });
              }
            }
            return reply.code(502).send({ error: e2?.message || 'TTS providers unreachable' });
          }
        }
      }

      // espeak (default for Uzbek)
      try {
        const buf = await tryEspeak();
        return reply.send(buf);
      } catch (e: any) {
        try {
          const buf2 = await tryCoqui();
          return reply.send(buf2);
        } catch (e2: any) {
          try {
            const buf3 = await tryPiper();
            return reply.send(buf3);
          } catch (e3: any) {
            return reply.code(502).send({ error: e3?.message || 'TTS providers unreachable' });
          }
        }
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
          fastify.log.info({ baseUrl, success: true }, `STT request succeeded`);
          return reply.send({ text });
        } catch (e: any) {
          lastErr = e;
          fastify.log.error(
            {
              err: e,
              baseUrl,
              status: e?.status,
              message: e?.message,
            },
            `STT fetch failed at ${baseUrl}`,
          );
        }
      }
      const errorMsg = `STT unreachable. Tried: ${candidates.join(', ')}. Last error: ${lastErr?.message || 'Unknown'}`;
      fastify.log.error({ candidates, lastErr }, errorMsg);
      return reply.code(502).send({ error: errorMsg });
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
      const language = (body?.language ?? 'en').toString();

      const normalizedTarget = normalizePerLanguage(target, language);
      const normalizedHypothesis = normalizePerLanguage(hypothesis, language);
      const distance = levenshtein(normalizedTarget, normalizedHypothesis);
      const maxLen = Math.max(normalizedTarget.length, normalizedHypothesis.length) || 1;
      const similarity = 1 - distance / maxLen;
      const correct = similarity >= (body?.threshold ?? 0.8);
      return reply.send({ correct, similarity });
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
