"use client";

import { useEffect, useState } from "react";
import { obterSupabaseNavegador, supabaseConfigurado } from "@/data/supabase/cliente";

export interface UsuarioAtual {
  nome: string;
  inicial: string;
  plano: string;
}

const USUARIO_LOCAL: UsuarioAtual = { nome: "Você", inicial: "V", plano: "Modo local" };

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nome exibido no menu lateral e no campo "Responsável". */
export function useUsuarioAtual(): UsuarioAtual {
  const [usuario, setUsuario] = useState<UsuarioAtual>(supabaseConfigurado ? { nome: "", inicial: "", plano: "Plano Pessoal" } : USUARIO_LOCAL);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    obterSupabaseNavegador()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        const meta = u.user_metadata as { full_name?: string; name?: string } | undefined;
        const bruto = meta?.full_name || meta?.name || capitalizar((u.email ?? "").split("@")[0].split(/[._-]/)[0]);
        const nome = bruto || "Você";
        setUsuario({ nome, inicial: nome.charAt(0).toUpperCase(), plano: "Plano Pessoal" });
      });
  }, []);

  return usuario;
}
