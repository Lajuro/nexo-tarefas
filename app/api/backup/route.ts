import { backupManual, listarBackups } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
export const GET = () => tratar(async () => ({ backups: await listarBackups() }));
export const POST = () => tratar(async () => ({ pasta: await backupManual() }));
