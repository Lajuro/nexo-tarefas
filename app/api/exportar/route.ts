import { estadoApp, lerTudo } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { hojeISO } from "@/lib/tipos";
export const dynamic = "force-dynamic";
export const GET = () =>
  tratar(async () => {
    const [estado, dados] = await Promise.all([estadoApp(), lerTudo()]);
    const corpo = JSON.stringify({ exportadoEm: new Date().toISOString(), schema: estado.schemaDados, ...dados }, null, 2);
    return new Response(corpo, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexo-export-${hojeISO()}.json"`,
      },
    });
  });
