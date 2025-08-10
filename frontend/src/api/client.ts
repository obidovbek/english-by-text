export async function postJSON<TRequest extends object, TResponse = unknown>(
  url: string,
  body: TRequest,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
