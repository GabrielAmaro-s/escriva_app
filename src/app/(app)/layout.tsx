import { EstruturaApp } from "@/components/layout/estrutura-app";
import { ProvedorInterfaceProjeto } from "@/components/projects/interface-projeto";
import { ProvedorLembretes } from "@/hooks/use-lembretes";
import { ProvedorProjetos } from "@/hooks/use-projetos";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorProjetos>
      <ProvedorLembretes>
        <ProvedorInterfaceProjeto>
          <EstruturaApp>{children}</EstruturaApp>
        </ProvedorInterfaceProjeto>
      </ProvedorLembretes>
    </ProvedorProjetos>
  );
}
