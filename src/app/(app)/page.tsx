import { Suspense } from "react";
import { TelaProjetos } from "@/components/projects/tela-projetos";

export default function PaginaInicial() {
  return (
    <Suspense>
      <TelaProjetos />
    </Suspense>
  );
}
