import { Suspense } from "react";
import { ProjectsView } from "@/components/projects/projects-view";

export default function HomePage() {
  return (
    <Suspense>
      <ProjectsView />
    </Suspense>
  );
}
