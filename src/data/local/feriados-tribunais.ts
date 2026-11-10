import type { Feriado } from "@/domain/tipos";

// Carga geral de feriados por tribunal para o modo local. É a mesma da migração 0005
// (feriados-tribunais.test.ts compara as duas). Na dúvida, o feriado não entra: um feriado
// a mais empurra o vencimento para depois do real.

type Linha = [tribunal: string, data: string, ate: string | null, descricao: string, fonte: string];

const DATA_MAGNA = "Data Magna do Rio Grande do Sul";
const LEI_RS = "Lei estadual RS";
const RECESSO = "Recesso forense";
const ART62_I = "Lei 5.010/1966, art. 62, I";
const ART62_II = "Lei 5.010/1966, art. 62, II";
const ART62_IV = "Lei 5.010/1966, art. 62, IV";

const LINHAS: Linha[] = [
  ["TJRS", "2026-09-20", null, DATA_MAGNA, LEI_RS],
  ["TJRS", "2027-09-20", null, DATA_MAGNA, LEI_RS],
  ["TRT4", "2026-01-01", "2026-01-06", RECESSO, ART62_I],
  ["TRT4", "2026-04-01", "2026-04-02", "Semana Santa", ART62_II],
  ["TRT4", "2026-08-11", null, "Dia do Magistrado e do Advogado", ART62_IV],
  ["TRT4", "2026-09-20", null, DATA_MAGNA, LEI_RS],
  ["TRT4", "2026-11-01", null, "Todos os Santos", ART62_IV],
  ["TRT4", "2026-12-08", null, "Nossa Senhora da Conceição", ART62_IV],
  ["TRT4", "2026-12-20", "2027-01-06", RECESSO, ART62_I],
  ["TRT4", "2027-03-24", "2027-03-25", "Semana Santa", ART62_II],
  ["TRT4", "2027-08-11", null, "Dia do Magistrado e do Advogado", ART62_IV],
  ["TRT4", "2027-09-20", null, DATA_MAGNA, LEI_RS],
  ["TRT4", "2027-11-01", null, "Todos os Santos", ART62_IV],
  ["TRT4", "2027-12-08", null, "Nossa Senhora da Conceição", ART62_IV],
  ["TRT4", "2027-12-20", "2028-01-06", RECESSO, ART62_I],
  ["TRF4", "2026-01-01", "2026-01-06", RECESSO, ART62_I],
  ["TRF4", "2026-04-01", "2026-04-02", "Semana Santa", ART62_II],
  ["TRF4", "2026-08-11", null, "Dia do Magistrado e do Advogado", ART62_IV],
  ["TRF4", "2026-10-30", null, "Dia do Servidor Público", "Calendário TRF4 2026"],
  ["TRF4", "2026-11-01", null, "Todos os Santos", ART62_IV],
  ["TRF4", "2026-12-08", null, "Nossa Senhora da Conceição", ART62_IV],
  ["TRF4", "2026-12-20", "2027-01-06", RECESSO, ART62_I],
  ["TRF4", "2027-03-24", "2027-03-25", "Semana Santa", ART62_II],
  ["TRF4", "2027-08-11", null, "Dia do Magistrado e do Advogado", ART62_IV],
  ["TRF4", "2027-11-01", null, "Todos os Santos", ART62_IV],
  ["TRF4", "2027-12-08", null, "Nossa Senhora da Conceição", ART62_IV],
  ["TRF4", "2027-12-20", "2028-01-06", RECESSO, ART62_I],
];

export const FERIADOS_DOS_TRIBUNAIS: Feriado[] = LINHAS.map(([tribunal, data, ate, descricao, fonte]) => ({
  id: `geral-${tribunal}-${data}`,
  userId: null,
  tribunal,
  data,
  ate,
  tipo: "feriado",
  descricao,
  fonte,
}));
