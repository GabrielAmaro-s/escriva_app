"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase, isSupabaseConfigured } from "@/data/supabase/client";

export interface CurrentUser {
  name: string;
  initial: string;
  plan: string;
}

const LOCAL_USER: CurrentUser = { name: "Você", initial: "V", plan: "Modo local" };

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nome exibido no menu lateral e no campo "Responsável". */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(isSupabaseConfigured ? { name: "", initial: "", plan: "Plano Pessoal" } : LOCAL_USER);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        const meta = u.user_metadata as { full_name?: string; name?: string } | undefined;
        const raw = meta?.full_name || meta?.name || capitalize((u.email ?? "").split("@")[0].split(/[._-]/)[0]);
        const name = raw || "Você";
        setUser({ name, initial: name.charAt(0).toUpperCase(), plan: "Plano Pessoal" });
      });
  }, []);

  return user;
}
