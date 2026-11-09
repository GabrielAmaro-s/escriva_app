import { EstruturaApp } from "@/components/layout/estrutura-app";
import { ProvedorInterfaceProjeto } from "@/components/projects/interface-projeto";
import { ProvedorClientes } from "@/hooks/use-clientes";
import { ProvedorLembretes } from "@/hooks/use-lembretes";
import { ProvedorProjetos } from "@/hooks/use-projetos";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorProjetos>
      <ProvedorClientes>
        <ProvedorLembretes>
          <ProvedorInterfaceProjeto>
            <EstruturaApp>{children}</EstruturaApp>
          </ProvedorInterfaceProjeto>
        </ProvedorLembretes>
      </ProvedorClientes>
    </ProvedorProjetos>
  );
}
