export async function postJSON<TRequest extends object, TResponse = unknown>(
  url: string,
  body: TRequest,
  init?: RequestInit
): Promise<TResponse> {
  const userId = localStorage.getItem("userId");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

  const text = await response.text();
  const maybeJson = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (maybeJson && (maybeJson.message || maybeJson.error)) ||
      response.statusText;
    throw new Error(message);
  }

  return maybeJson as TResponse;
}

export async function getJSON<TResponse = unknown>(
  url: string,
  init?: RequestInit
): Promise<TResponse> {
  const userId = localStorage.getItem("userId");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  const maybeJson = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (maybeJson && (maybeJson.message || maybeJson.error)) ||
      response.statusText;
    throw new Error(message);
  }

  return maybeJson as TResponse;
}
