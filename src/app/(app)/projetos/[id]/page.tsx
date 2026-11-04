import { Suspense } from "react";
import { TelaQuadro } from "@/components/board/tela-quadro";

export default async function PaginaQuadro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TelaQuadro projetoId={id} />
    </Suspense>
  );
}
