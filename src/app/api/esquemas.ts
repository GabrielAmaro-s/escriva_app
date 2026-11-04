import { z } from "zod";

// Formato das entradas das rotas /api. O navegador já valida, mas o servidor não confia.

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use datas no formato AAAA-MM-DD." }).nullable();
const tom = z.enum(["violet", "blue", "green", "amber", "red", "pink", "gray"]);

const campanha = z.object({
  objective: z.string().nullable(),
  startsOn: data,
  endsOn: data,
  channels: z.array(z.string().max(40)).max(20),
  deliverables: z.array(z.object({ id: z.string(), title: z.string().max(200), done: z.boolean() })).max(100),
});

export const esquemaDadosProjeto = z.object({
  name: z.string().max(120),
  description: z.string().max(2000).nullable(),
  kind: z.enum(["project", "campaign"]),
  status: z.enum(["active", "paused", "done"]),
  color: tom,
  icon: z.enum(["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target"]),
  dueOn: data,
  campaign: campanha.nullable(),
});

export const esquemaNovoProjeto = z.object({
  dados: esquemaDadosProjeto,
  colunas: z
    .array(z.object({ title: z.string().min(1).max(60), kind: z.enum(["todo", "doing", "waiting", "done"]), position: z.number().optional() }))
    .min(1)
    .max(12),
});

export const esquemaAlteracaoProjeto = esquemaDadosProjeto.partial().extend({ archivedAt: z.string().nullable().optional() });

export const esquemaNovaTarefa = z.object({
  projectId: z.uuid({ error: "Projeto inválido." }),
  columnId: z.uuid({ error: "Coluna inválida." }),
  title: z.string().trim().min(1, { error: "Escreva um título para a tarefa." }).max(200),
  description: z.string().max(10_000).nullable().optional(),
  dueOn: data.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  labelIds: z.array(z.string()).max(50).optional(),
  position: z.number().optional(),
});

export const esquemaAlteracaoTarefa = z
  .object({
    columnId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    dueOn: data,
    priority: z.enum(["low", "medium", "high", "urgent"]),
    labelIds: z.array(z.string()).max(50),
    checklist: z.array(z.object({ id: z.string(), text: z.string().max(500), done: z.boolean() })).max(200),
    links: z.array(z.object({ id: z.string(), url: z.string().max(2000), title: z.string().max(200).nullable() })).max(100),
    completed: z.boolean(),
    completedAt: z.string().nullable(),
    position: z.number(),
  })
  .partial();

export const esquemaNovaEtiqueta = z.object({ projetoId: z.uuid(), nome: z.string().trim().min(1).max(40), cor: tom });

const instante = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), { error: "Data e hora inválidas." });

export const esquemaNovoLembrete = z.object({
  texto: z.string().max(500),
  quando: instante,
  tarefaId: z.uuid().nullable().optional(),
  projetoId: z.uuid().nullable().optional(),
});

export const esquemaAlteracaoLembrete = z
  .object({
    texto: z.string().trim().min(1).max(500),
    quando: instante,
    status: z.enum(["pendente", "agendado", "enviado", "cancelado"]),
  })
  .partial();

export const esquemaNovoToken = z.object({
  nome: z.string().max(60),
  escopo: z.enum(["leitura", "escrita"]),
});
