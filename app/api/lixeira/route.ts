import { listarLixeira, restaurarDaLixeira } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
export const GET = () => tratar(async () => ({ itens: await listarLixeira() }));
export const POST = (req: Request) =>
  tratar(async () => {
    const { arquivo } = await req.json();
    return restaurarDaLixeira(String(arquivo));
  });
