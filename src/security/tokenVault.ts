export class TokenVault {
  private token: string | undefined;

  setToken(token: string): void {
    if (!token || token.trim().length < 8) {
      throw new Error("invalid token");
    }
    this.token = token;
  }

  getToken(): string | undefined {
    return this.token;
  }

  clear(): void {
    this.token = undefined;
  }
}
