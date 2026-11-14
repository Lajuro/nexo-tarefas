import { restaurarBackup } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
// POST { nome }: volta os dados ao que eram naquele backup. Antes, tira uma foto do estado de agora
// (_backups/pre-restauracao-*) e o que não existia no backup vai para a lixeira.
export const POST = (req: Request) =>
  tratar(async () => {
    const { nome } = (await req.json()) as { nome?: unknown };
    return restaurarBackup(String(nome ?? ""));
  });
