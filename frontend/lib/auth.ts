export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_token", token);
}

export function removeAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("admin_token");
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(paddedPayload)) as { exp?: number };
    if (typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000) {
      removeAccessToken();
      return false;
    }
    return true;
  } catch {
    removeAccessToken();
    return false;
  }
}

export function logout(): void {
  removeAccessToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
