import { moverTarefaParaLixeira, salvarTarefa } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// body: { tarefa, revEsperada }  (revEsperada null = criação)
export const PUT = (req: Request, ctx: Ctx) =>
  tratar(async () => {
    const { id } = await ctx.params;
    const { tarefa, revEsperada } = await req.json();
    if (!tarefa || tarefa.id !== id) throw new Error("Tarefa inválida.");
    return salvarTarefa(tarefa, revEsperada ?? null);
  });

export const DELETE = (_req: Request, ctx: Ctx) =>
  tratar(async () => {
    const { id } = await ctx.params;
    await moverTarefaParaLixeira(id);
    return { ok: true };
  });
