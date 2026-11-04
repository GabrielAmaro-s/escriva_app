import { AppShell } from "@/components/layout/app-shell";
import { ProjectUiProvider } from "@/components/projects/project-ui";
import { ProjectsProvider } from "@/hooks/use-projects";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <ProjectUiProvider>
        <AppShell>{children}</AppShell>
      </ProjectUiProvider>
    </ProjectsProvider>
  );
}
