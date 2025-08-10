import { useCallback, useMemo, useState } from "react";
import { postJSON } from "../api/client";

export interface TelegramAuthUser {
  id: number;
  telegramId: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
}

export interface TelegramAuthState {
  user: TelegramAuthUser | null;
  isLoading: boolean;
  error: string | null;
  isTelegram: boolean;
  login: () => Promise<void>;
}

export function useTelegramAuth(): TelegramAuthState {
  const isTelegram = Boolean(window.Telegram?.WebApp);
  const [user, setUser] = useState<TelegramAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async () => {
    if (!isTelegram) {
      setError("Not running inside Telegram");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const wa = window.Telegram!.WebApp as any;
      const unsafe = wa?.initDataUnsafe;
      const tgUser = unsafe?.user;
      if (!tgUser?.id || !tgUser?.first_name) {
        throw new Error("Missing Telegram user data");
      }

      // Optional: phone may be requested via wa.requestPhoneNumber()?. For now, omit.
      const payload = {
        telegramId: Number(tgUser.id),
        firstName: String(tgUser.first_name),
        lastName: tgUser.last_name ? String(tgUser.last_name) : null,
        username: tgUser.username ? String(tgUser.username) : null,
        languageCode: tgUser.language_code
          ? String(tgUser.language_code)
          : null,
        photoUrl: tgUser.photo_url ? String(tgUser.photo_url) : null,
        phone: null as string | null,
      };

      type LoginResponse = { ok: boolean; user: TelegramAuthUser };
      const result = await postJSON<typeof payload, LoginResponse>(
        "/api/auth/telegram",
        payload
      );

      if (!result.ok || !result.user) {
        throw new Error("Login failed");
      }

      setUser(result.user);
      // Persist user id for API header
      localStorage.setItem("userId", String(result.user.id));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError(message);
      setUser(null);
      localStorage.removeItem("userId");
    } finally {
      setIsLoading(false);
    }
  }, [isTelegram]);

  return useMemo(
    () => ({ user, isLoading, error, isTelegram, login }),
    [user, isLoading, error, isTelegram, login]
  );
}
