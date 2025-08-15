export const lastGreetingAt = new Map<number, number>();

export function shouldSendGreetingNow(telegramId: number, debounceMs = 5000): boolean {
  const now = Date.now();
  const prev = lastGreetingAt.get(telegramId) || 0;
  if (now - prev < debounceMs) return false;
  lastGreetingAt.set(telegramId, now);
  return true;
}

export type SupportedLocale = 'uz' | 'ru' | 'en' | 'ko' | 'tr' | 'de';

export function pickSupportedLocale(lang?: string): SupportedLocale {
  if (!lang) return 'uz';
  const l = lang.toLowerCase();
  if (l.startsWith('uz')) return 'uz';
  if (l.startsWith('ru')) return 'ru';
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('ko') || l.startsWith('kr')) return 'ko';
  if (l.startsWith('tr')) return 'tr';
  return 'uz';
}

const GREETINGS: Record<SupportedLocale, string[]> = {
  en: [
    '👋 Hello, {name}!\nI will stay active by greeting you when you open the app. You can mute me anytime.',
    '🌟 Welcome back, {name}!\nOpening the app keeps me active. You can mute me whenever you like.',
    '💬 Hi {name}!\nJust a friendly ping when you open the app. Mute me anytime.',
  ],
  uz: [
    '👋 Salom, {name}!\nDastur ochilganda salom yuborib turaman. Istasangiz meni o‘chirib qo‘yishingiz mumkin.',
    '🌟 Xush kelibsiz, {name}!\nDastur ochilganida faol bo‘lib turaman. Hohlasangiz meni o‘chirishingiz mumkin.',
    '💬 Salom, {name}!\nDastur ochilganida xabar yuboraman. Istalgan vaqtda meni o‘chirishingiz mumkin.',
  ],
  ru: [
    '👋 Привет, {name}!\nЯ буду отправлять привет при открытии приложения. Вы можете отключить меня в любой момент.',
    '🌟 С возвращением, {name}!\nКогда вы открываете приложение, я активен. Можете отключить меня в любой момент.',
    '💬 Привет, {name}!\nНебольшое напоминание при открытии приложения. Можете отключить меня.',
  ],
  ko: [
    '👋 안녕하세요, {name}님!\n앱을 열 때마다 인사 메시지를 보내드려요. 언제든지 저를 음소거할 수 있어요.',
    '🌟 다시 오신 걸 환영해요, {name}님!\n앱을 열면 제가 활성 상태가 돼요. 언제든지 음소거 가능해요.',
    '💬 안녕하세요, {name}님!\n앱을 열 때 간단히 인사드려요. 필요하시면 음소거하세요.',
  ],
  tr: [
    '👋 Merhaba, {name}!\nUygulamayı açtığınızda selam göndereceğim. İsterseniz beni dilediğiniz zaman sessize alabilirsiniz.',
    '🌟 Tekrar hoş geldiniz, {name}!\nUygulamayı açtığınızda aktif kalırım. İstediğiniz zaman sessize alabilirsiniz.',
    '💬 Merhaba, {name}!\nUygulama açıldığında küçük bir selam. İstediğiniz zaman sessize alabilirsiniz.',
  ],
  de: [
    '👋 Hallo, {name}!\nIch melde mich, wenn du die App öffnest. Du kannst mich jederzeit stummschalten.',
    '🌟 Willkommen zurück, {name}!\nWenn du die App öffnest, bleibe ich aktiv. Du kannst mich jederzeit stummschalten.',
    '💬 Hi {name}!\nNur ein kurzer Gruß beim Öffnen der App. Du kannst mich jederzeit stummschalten.',
  ],
};

export function nextGreeting(locale: SupportedLocale, name: string, lastVariant?: number | null) {
  const list = GREETINGS[locale] ?? GREETINGS.en;
  const nextIndex = Number.isFinite(lastVariant as number)
    ? ((lastVariant as number) + 1) % list.length
    : 0;
  const template = list[nextIndex];
  const text = template.split('{name}').join(name || 'there');
  return { text, index: nextIndex };
}

export function makeGreeting(firstName: string, locale: SupportedLocale): string {
  // Deprecated single-variant helper; keep for compatibility
  return nextGreeting(locale, firstName, null).text;
}
