import { AppShell } from "@/components/layout/app-shell";
import { ProjectsProvider } from "@/hooks/use-projects";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <AppShell>{children}</AppShell>
    </ProjectsProvider>
  );
}
