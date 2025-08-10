// Minimal Telegram WebApp SDK typings used by this app
// Reference: https://core.telegram.org/bots/webapps

interface TelegramWebAppUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
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
    themeParams?: TelegramThemeParams;
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
