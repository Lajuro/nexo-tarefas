import { entrarNoExemplo, estadoApp, sairDoExemplo } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

// Dados de exemplo (3.22): "entrar" monta o exemplo numa pasta separada e passa a mostrá-la; "sair" volta para
// os dados de verdade. A pasta de dados de verdade nunca é tocada por estas duas ações.
export const POST = (req: Request) =>
  tratar(async () => {
    const { acao } = await req.json();
    if (acao === "entrar") await entrarNoExemplo();
    else if (acao === "sair") await sairDoExemplo();
    else throw new Error("Ação desconhecida.");
    return estadoApp();
  });
