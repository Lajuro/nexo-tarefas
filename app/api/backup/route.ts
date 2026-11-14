import { backupManual, listarBackups, previaDoBackup } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
// GET sem parâmetro: lista. GET ?nome=<backup>: o que mudaria se ele fosse restaurado (só lê).
export const GET = (req: Request) =>
  tratar(async () => {
    const nome = new URL(req.url).searchParams.get("nome");
    return nome ? { previa: await previaDoBackup(nome) } : { backups: await listarBackups() };
  });
export const POST = () => tratar(async () => ({ pasta: await backupManual() }));
