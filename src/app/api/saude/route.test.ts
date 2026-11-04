import { afterEach, describe, expect, it, vi } from "vitest";

// /api/saude não pode expor nada além de ok, modoLocal e banco.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
  vi.resetModules();
});

async function chamar() {
  const { GET } = await import("./route");
  const resposta = await GET();
  return { status: resposta.status, corpo: await resposta.json() };
}

describe("/api/saude", () => {
  it("modo local: só os três campos", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(await chamar()).toEqual({ status: 200, corpo: { ok: true, modoLocal: true, banco: "erro" } });
  });

  it("banco com erro: não vaza a mensagem, a chave nem a URL", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://segredo-do-projeto.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_nao_pode_vazar");
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from: () => ({ select: () => ({ limit: async () => ({ error: { message: "password authentication failed for user postgres" } }) }) }),
      }),
    }));
    const erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await chamar();
    expect(r).toEqual({ status: 503, corpo: { ok: false, modoLocal: false, banco: "erro" } });
    expect(JSON.stringify(r.corpo)).not.toMatch(/password|sb_secret|segredo-do-projeto/);
    erroNoConsole.mockRestore();
  });

  it("banco respondendo: banco ok", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) }),
    }));
    expect(await chamar()).toEqual({ status: 200, corpo: { ok: true, modoLocal: false, banco: "ok" } });
  });
});
