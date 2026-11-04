import { EstruturaApp } from "@/components/layout/estrutura-app";
import { ProvedorInterfaceProjeto } from "@/components/projects/interface-projeto";
import { ProvedorProjetos } from "@/hooks/use-projetos";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorProjetos>
      <ProvedorInterfaceProjeto>
        <EstruturaApp>{children}</EstruturaApp>
      </ProvedorInterfaceProjeto>
    </ProvedorProjetos>
  );
}
