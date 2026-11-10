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
  tipoServico: z.string().max(80).nullable().optional(),
});

const textoOpcional = (max: number) => z.string().max(max).nullable();

const processo = z.object({
  numeroCnj: textoOpcional(40),
  tribunal: textoOpcional(40),
  orgao: textoOpcional(120),
  area: z.enum(["civel", "consumidor", "trabalhista", "previdenciario", "familia", "criminal", "tributario", "administrativo", "outra"]).nullable(),
  fase: z.enum(["administrativa", "inicial", "instrucao", "sentenca", "recurso", "execucao"]).nullable(),
  polo: z.enum(["autor", "reu", "terceiro"]).nullable(),
  parteContraria: textoOpcional(200),
  valorCausa: z.number().nonnegative().nullable(),
  segredoJustica: z.boolean(),
  linkAutos: textoOpcional(2000),
});

export const esquemaDadosCliente = z.object({
  nome: z.string().max(120),
  tipo: z.enum(["pf", "pj"]),
  documento: textoOpcional(30),
  telefone: textoOpcional(30),
  email: textoOpcional(200),
  observacoes: textoOpcional(2000),
});

export const esquemaDadosProjeto = z.object({
  name: z.string().max(120),
  description: z.string().max(2000).nullable(),
  kind: z.enum(["project", "campaign"]),
  status: z.enum(["active", "paused", "done"]),
  color: tom,
  icon: z.enum(["folder", "monitor", "box", "calendar", "chart", "check", "gift", "megaphone", "star", "target", "scales", "briefcase", "gavel", "file"]),
  dueOn: data,
  campaign: campanha.nullable(),
  clienteId: z.uuid({ error: "Cliente inválido." }).nullable().optional(),
  processo: processo.nullable().optional(),
});

export const esquemaNovoProjeto = z.object({
  dados: esquemaDadosProjeto,
  colunas: z
    .array(z.object({ title: z.string().min(1).max(60), kind: z.enum(["todo", "doing", "waiting", "done"]), position: z.number().optional() }))
    .min(1)
    .max(12),
});

export const esquemaAlteracaoProjeto = esquemaDadosProjeto.partial().extend({ archivedAt: z.string().nullable().optional() });

// Etapa 3: tipo da tarefa, prazo fatal, contagem e audiência.
const tipoTarefa = z.enum(["prazo", "providencia", "audiencia"]);
const contagem = z.object({
  inicio: data.unwrap(),
  meio: z.enum(["dje", "portal", "pessoal"]),
  dias: z.number().int().min(1).max(365),
  regra: z.enum(["civel", "trabalhista", "juizado", "penal"]),
  unidade: z.enum(["uteis", "corridos"]),
  emDobro: z.boolean(),
  suspenderNoRecesso: z.boolean(),
  tribunal: z.string().max(10).nullable(),
  margem: z.number().int().min(0).max(30),
  comeco: data.unwrap(),
  vencimento: data.unwrap(),
  excluidos: z.array(z.object({ data: data.unwrap(), ate: data.unwrap().optional(), motivo: z.string().max(200) })).max(400),
  memoria: z.string().max(4000),
});
const instanteOuNulo = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { error: "Data e hora inválidas." })
  .nullable();
const camposDoTipo = {
  tipo: tipoTarefa,
  prazoFatal: data,
  contagem: contagem.nullable(),
  localAudiencia: z.string().max(200).nullable(),
  horarioAudiencia: instanteOuNulo,
};

export const esquemaNovaTarefa = z.object({
  projectId: z.uuid({ error: "Projeto inválido." }),
  columnId: z.uuid({ error: "Coluna inválida." }),
  title: z.string().trim().min(1, { error: "Escreva um título para a tarefa." }).max(200),
  description: z.string().max(10_000).nullable().optional(),
  dueOn: data.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  labelIds: z.array(z.string()).max(50).optional(),
  position: z.number().optional(),
  ...z.object(camposDoTipo).partial().shape,
});

export const esquemaAlteracaoTarefa = z
  .object({
    columnId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    dueOn: data,
    priority: z.enum(["low", "medium", "high", "urgent"]),
    labelIds: z.array(z.string()).max(50),
    checklist: z.array(z.object({ id: z.string(), text: z.string().max(500), done: z.boolean(), doCliente: z.boolean().optional() })).max(200),
    links: z.array(z.object({ id: z.string(), url: z.string().max(2000), title: z.string().max(200).nullable() })).max(100),
    completed: z.boolean(),
    completedAt: z.string().nullable(),
    position: z.number(),
    ...camposDoTipo,
  })
  .partial();

export const esquemaNovaEtiqueta = z.object({ projetoId: z.uuid(), nome: z.string().trim().min(1).max(40), cor: tom });

const instante = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), { error: "Data e hora inválidas." });

export const esquemaNovoLembrete = z.object({
  texto: z.string().max(500),
  quando: instante,
  tarefaId: z.uuid().nullable().optional(),
  projetoId: z.uuid().nullable().optional(),
  automatico: z.enum(["d-3", "d-1", "dia"]).nullable().optional(),
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

export const esquemaNovoFeriado = z.object({
  data: data.unwrap(),
  ate: data.optional(),
  tribunal: z.string().max(10).nullable().optional(),
  tipo: z.enum(["feriado", "suspensao", "expediente_reduzido"]).optional(),
  descricao: z.string().max(120),
});

export const esquemaPreferencias = z.object({ margemPrazoInterno: z.number().int().min(0).max(30) });
