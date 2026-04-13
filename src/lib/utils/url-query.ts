export function replaceCurrentUrlQueryParams(params: Record<string, string | null | undefined>) {
  if (typeof window === "undefined") {
    return;
  }

  const query = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      query.set(key, value);
    } else {
      query.delete(key);
    }
  }

  const queryString = query.toString();
  const nextUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  window.history.replaceState(window.history.state, "", nextUrl);
}
