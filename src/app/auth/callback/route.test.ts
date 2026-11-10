import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O callback do link mágico: fluxo PKCE (?code=) e token_hash (?token_hash=&type=).
const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
};
vi.mock("@/data/supabase/servidor", () => ({ obterSupabaseServidor: async () => ({ auth }) }));

const { GET } = await import("./route");
const chamar = async (busca: string) => (await GET(new NextRequest(`https://app.teste/auth/callback${busca}`))).headers.get("location");

beforeEach(() => {
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
});

describe("callback do link mágico", () => {
  it("?code= troca o código por sessão e vai para o app (login pela tela, PKCE)", async () => {
    expect(await chamar("?code=abc")).toBe("https://app.teste/");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("?token_hash=&type=magiclink confere no servidor e vai para o app (qualquer navegador)", async () => {
    expect(await chamar("?token_hash=hash123&type=magiclink")).toBe("https://app.teste/");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash123", type: "magiclink" });
  });

  it("type=email também entra", async () => {
    expect(await chamar("?token_hash=hash123&type=email")).toBe("https://app.teste/");
  });

  it("token inválido ou vencido volta para o login", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: "Email link is invalid or has expired" } });
    expect(await chamar("?token_hash=velho&type=magiclink")).toBe("https://app.teste/login");
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    expect(await chamar("?code=velho")).toBe("https://app.teste/login");
  });

  it("tipos que não são de login (recovery, invite, signup) e pedidos sem nada voltam para o login sem conferir", async () => {
    for (const tipo of ["recovery", "invite", "signup", "email_change"]) {
      expect(await chamar(`?token_hash=hash123&type=${tipo}`)).toBe("https://app.teste/login");
    }
    expect(await chamar("?token_hash=hash123")).toBe("https://app.teste/login");
    expect(await chamar("")).toBe("https://app.teste/login");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
