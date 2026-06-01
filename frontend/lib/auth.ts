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
  return !!getAccessToken();
}

export function logout(): void {
  removeAccessToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
