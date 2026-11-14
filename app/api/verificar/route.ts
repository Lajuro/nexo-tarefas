import { inventarioDaPasta, lerTudo } from "@/lib/armazenamento";
import { verificarIntegridade } from "@/lib/integridade";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
// GET: confere os dados e a pasta e devolve o que está estranho. Só lê: nada é consertado sozinho.
export const GET = () => tratar(async () => verificarIntegridade(await lerTudo(), await inventarioDaPasta()));
