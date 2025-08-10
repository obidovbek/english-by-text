// Minimal Telegram WebApp SDK typings used by this app
// Reference: https://core.telegram.org/bots/webapps

interface TelegramWebAppUser {
  first_name?: string;
}

interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser;
}

type TelegramColorScheme = "light" | "dark";

declare namespace Telegram {
  interface WebApp {
    ready: () => void;
    expand: () => void;
    colorScheme: TelegramColorScheme;
    onEvent: (event: "themeChanged", handler: () => void) => void;
    offEvent?: (event: "themeChanged", handler: () => void) => void;
    initDataUnsafe: TelegramWebAppInitDataUnsafe;
    initData: string;
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: Telegram.WebApp;
    };
  }
}

export {};
