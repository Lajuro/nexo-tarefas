import { lerVersao, listarVersoes } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
// GET ?id=<página>: as versões guardadas. Com &v=<versão>: o título e o texto daquela versão. Só lê.
export const GET = (req: Request) =>
  tratar(async () => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    const v = url.searchParams.get("v");
    return v ? { versao: await lerVersao(id, v) } : { versoes: await listarVersoes(id) };
  });
