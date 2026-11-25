// Quem pode falar com o servidor do Nexo. Uma regra só, usada em dois lugares:
//   1) proxy.ts, que vale para quase todas as rotas (telas e API);
//   2) as rotas que recebem arquivo grande (ROTAS_DE_ENVIO), que ficam FORA do proxy e chamam recusaDaRota().
//
// Por que essas rotas ficam fora: com o proxy ativo, o Next copia o corpo de todo pedido para a memória e para
// em 10 MB (experimental.proxyClientMaxBodySize). Passou disso, o resto do corpo é descartado em silêncio e a
// rota recebe só o começo: até a 3.24.1, vídeo enviado acima de 10 MB era gravado cortado (e não tocava), e anexo
// ou export acima disso dava erro. Subir o limite não serve: a cópia é na memória, e um vídeo pode ter 4 GB.
//
// O que a regra garante:
//   - só aceita Host localhost/127.0.0.1/[::1] (barra DNS rebinding);
//   - na API, recusa o pedido que o navegador diz ter vindo de outro site ou de outra porta (Sec-Fetch-Site):
//     em escrita isso barra CSRF, em leitura impede outra página aberta no navegador de pedir os dados;
//   - em escrita, confere também o Origin (navegador antigo, que não manda Sec-Fetch-Site).

export const HOSTS_OK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Rotas que recebem arquivo grande: não passam pelo proxy (ver o matcher em proxy.ts) e se protegem sozinhas. */
export const ROTAS_DE_ENVIO = ["/api/midia", "/api/arquivos", "/api/importar"] as const;

/** Por que recusar este pedido (o texto do erro), ou null se ele pode seguir. */
export function motivoDaRecusa(cabecalhos: Headers, metodo: string, ehApi: boolean): string | null {
  const host = cabecalhos.get("host") || "";
  if (!HOSTS_OK.test(host)) return "Acesso permitido só pela própria máquina.";
  if (!ehApi) return null;
  // "same-origin": o próprio app. "none": endereço digitado, favorito ou ferramenta sem navegador (curl, testes).
  const site = cabecalhos.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return "Origem não permitida.";
  if (metodo !== "GET" && metodo !== "HEAD") {
    const origin = cabecalhos.get("origin");
    if (origin) {
      let outra = true;
      try {
        outra = new URL(origin).host !== host;
      } catch {
        outra = true;
      }
      if (outra) return "Origem não permitida.";
    }
  }
  return null;
}

/** Para as rotas de ROTAS_DE_ENVIO: a mesma recusa do proxy, já como resposta (ou null se pode seguir). */
export function recusaDaRota(req: Request): Response | null {
  const motivo = motivoDaRecusa(req.headers, req.method, true);
  return motivo ? Response.json({ erro: motivo }, { status: 403 }) : null;
}
