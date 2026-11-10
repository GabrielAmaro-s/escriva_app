import { iniciarConsulta } from "@/services/captura-djen";
import { rotaComToken } from "../../rota-com-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A VPS pergunta se deve consultar o DJEN agora e com que janela; a tentativa fica registrada. */
export const POST = rotaComToken("escrita", ({ repo, fuso }) => iniciarConsulta(repo, { fuso }));
