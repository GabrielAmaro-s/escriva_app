import { Suspense } from "react";
import { BoardView } from "@/components/board/board-view";

export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <BoardView projectId={id} />
    </Suspense>
  );
}
