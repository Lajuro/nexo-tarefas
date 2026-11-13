import { definirDataDir, estadoApp } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
export const POST = (req: Request) =>
  tratar(async () => {
    const { dataDir } = await req.json();
    if (typeof dataDir !== "string" || !dataDir.trim()) throw new Error("Informe o caminho da pasta.");
    if (process.env.NEXO_DATA_DIR) throw new Error("A pasta está fixada pela variável NEXO_DATA_DIR.");
    await definirDataDir(dataDir);
    return estadoApp();
  });
