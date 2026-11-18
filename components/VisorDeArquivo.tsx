"use client";

// Visor de arquivos (3.15): ver um arquivo por dentro do app, numa janela por cima da tela, sem baixar e sem
// trocar de tela. Montado uma vez no Shell e aberto por evento, de qualquer lugar em que um arquivo aparece.
//
//   PDF                    leitor do próprio navegador, embutido (zoom, busca e impressão são os dele)
//   planilha (xlsx, xlsm)  grade com abas, busca e cópia (lib/planilha.ts)
//   tabela (csv, tsv)      a mesma grade
//   Word (docx)            o texto: títulos, parágrafos, listas e tabelas (lib/documento.ts)
//   PowerPoint (pptx)      o texto de cada slide
//   Markdown               desenhado pelo leitor do app, ou o texto cru
//   texto, log, código     com número de linha e as cores do bloco de código
//   zip                    a lista do que tem dentro
//   áudio e vídeo          o player do app
//   imagem                 vai para o VisorDeImagem
//
// Nenhuma dependência nova: XLSX, DOCX e PPTX são ZIPs com XML, lidos por código do próprio app (lib/zip.ts).
// O arquivo é entrada não confiável: o que sai dos leitores é texto, desenhado como texto pelo React. HTML e SVG
// aparecem como código-fonte, nunca interpretados. Só abre anexo do próprio app (lib/visor.ts), e arquivo grande
// demais para ler na memória do navegador não é baixado.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Copy, Download, ExternalLink, File as ArquivoGenerico, FileArchive, FileCode, FileSpreadsheet, FileText, FileType, FileVideo, LoaderCircle,
  type LucideIcon, Presentation, TriangleAlert, WrapText, X,
} from "lucide-react";
import { toast as sonner } from "sonner";
import { abrirImagem } from "@/components/VisorDeImagem";
import { copiarTexto } from "@/components/comum";
import { Player } from "@/components/paginas/video/Player";
import { TextoRico } from "@/components/tarefa/Texto";
import { TabelaDeDados } from "@/components/visor/TabelaDeDados";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Dica } from "@/components/ui/popover";
import { type Apresentacao, type Documento, apresentacaoComoTexto, documentoComoTexto, lerDocx, lerPptx } from "@/lib/documento";
import { decodificarArquivo } from "@/lib/importar-pessoas";
import { type Planilha, lerTabelaDeTexto, lerXlsx } from "@/lib/planilha";
import { realcar } from "@/lib/realce";
import {
  type JeitoDeVer, NOME_DO_JEITO, TETO_DO_TEXTO, TETO_PARA_LER, avisoDeFormatoAntigo, ehSoAudio, ehUrlDeAnexo, extensaoDe, jeitoDeVer, linguagemDoArquivo,
  tamanhoLegivel, urlDaMidia, urlDoPdf, urlParaBaixar,
} from "@/lib/visor";
import { type EntradaZip, lerZip } from "@/lib/zip";
import { cn } from "@/lib/utils";

const EVENTO = "nexo:arquivo";

interface Pedido {
  url: string;
  /** Nome do arquivo (é dele que sai o tipo). */
  nome: string;
  /** Como o arquivo é chamado na tela (o título no banco de links, o texto do link). */
  titulo: string;
}

/**
 * Abre um arquivo por dentro do app. Imagem vai para o visor de imagem. Devolve false (e não faz nada) se o
 * endereço não é um anexo do app ou se o tipo não dá para ver por dentro: aí quem chamou segue com o link normal.
 */
export function abrirArquivo(url: string, nome: string, titulo = "", origem?: Element | null): boolean {
  if (!ehUrlDeAnexo(url)) return false;
  const jeito = jeitoDeVer(nome);
  if (!jeito) return false;
  if (jeito === "imagem") return abrirImagem(url, titulo || nome, origem);
  window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { url, nome, titulo: titulo || nome } }));
  return true;
}

/**
 * Para pôr no onClick de um link que leva a um arquivo: se dá para ver por dentro do app, abre no visor em vez de
 * sair da tela. Com Ctrl, Shift ou o botão do meio, vale o comportamento do link (abrir em outra aba).
 */
export function aoClicarEmArquivo(e: React.MouseEvent, url: string, nome: string, titulo?: string) {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  if (abrirArquivo(url, nome, titulo, e.currentTarget)) e.preventDefault();
  else {
    // formato antigo do Office (.xls, .doc, .ppt): o link segue (baixa o arquivo) e um aviso diz como ver aqui
    const aviso = avisoDeFormatoAntigo(nome);
    if (aviso) sonner(aviso, { duration: 6000 });
  }
}

const ICONE: Record<JeitoDeVer, LucideIcon> = {
  imagem: ArquivoGenerico, pdf: FileType, planilha: FileSpreadsheet, tabela: FileSpreadsheet, documento: FileText, slides: Presentation,
  markdown: FileText, texto: FileCode, zip: FileArchive, midia: FileVideo,
};

type Conteudo =
  | { t: "planilha"; planilha: Planilha }
  | { t: "documento"; documento: Documento }
  | { t: "slides"; apresentacao: Apresentacao }
  | { t: "texto"; texto: string }
  | { t: "zip"; entradas: EntradaZip[] }
  | { t: "direto" }; // PDF e mídia: quem carrega é o navegador

type Estado = { fase: "carregando" } | { fase: "erro"; mensagem: string } | { fase: "pronto"; conteudo: Conteudo; tamanho: number };

/** Texto com muitos bytes nulos não é texto: é um binário com extensão enganosa. */
const pareceBinario = (b: Uint8Array) => {
  const n = Math.min(b.length, 4000);
  let nulos = 0;
  for (let i = 0; i < n; i++) if (b[i] === 0) nulos++;
  // UTF-16 tem um nulo a cada dois bytes e é texto: só conta como binário sem a marca de ordem (BOM)
  const utf16 = (b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff);
  return !utf16 && nulos > n / 50;
};

async function carregar(p: Pedido, jeito: JeitoDeVer, sinal: AbortSignal): Promise<Estado> {
  if (jeito === "pdf" || jeito === "midia") return { fase: "pronto", conteudo: { t: "direto" }, tamanho: 0 };
  const r = await fetch(p.url, { signal: sinal });
  if (!r.ok) return { fase: "erro", mensagem: r.status === 404 ? "O arquivo não está mais na pasta de dados." : "Não consegui abrir o arquivo. Tente de novo ou baixe para abrir fora." };
  const declarado = Number(r.headers.get("x-nexo-tamanho") || r.headers.get("content-length"));
  if (declarado > TETO_PARA_LER) {
    await r.body?.cancel().catch(() => {});
    return { fase: "erro", mensagem: `O arquivo tem ${tamanhoLegivel(declarado)}: é grande demais para abrir aqui dentro. Baixe para abrir no programa dele.` };
  }
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > TETO_PARA_LER) return { fase: "erro", mensagem: `O arquivo tem ${tamanhoLegivel(bytes.length)}: é grande demais para abrir aqui dentro. Baixe para abrir no programa dele.` };
  const pronto = (conteudo: Conteudo): Estado => ({ fase: "pronto", conteudo, tamanho: bytes.length });
  if (jeito === "planilha") return pronto({ t: "planilha", planilha: await lerXlsx(bytes) });
  if (jeito === "documento") return pronto({ t: "documento", documento: await lerDocx(bytes) });
  if (jeito === "slides") return pronto({ t: "slides", apresentacao: await lerPptx(bytes) });
  if (jeito === "zip") return pronto({ t: "zip", entradas: lerZip(bytes) });
  if (pareceBinario(bytes)) return { fase: "erro", mensagem: "Este arquivo não é texto (parece um arquivo binário com outra extensão). Baixe para abrir no programa dele." };
  const texto = decodificarArquivo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  if (jeito === "tabela") return pronto({ t: "planilha", planilha: lerTabelaDeTexto(texto, p.nome) });
  return pronto({ t: "texto", texto });
}

export function VisorDeArquivo() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aba, setAba] = useState(0);
  const [cru, setCru] = useState(false);
  const [quebrar, setQuebrar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const foco = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<Pedido>).detail;
      if (!d || !ehUrlDeAnexo(d.url) || typeof d.nome !== "string") return;
      const jeito = jeitoDeVer(d.nome);
      if (!jeito || jeito === "imagem") return;
      foco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAba(0);
      setCru(false);
      setQuebrar(false);
      setEstado({ fase: "carregando" });
      setPedido({ url: d.url, nome: d.nome.slice(0, 300), titulo: String(d.titulo || d.nome).replace(/\s+/g, " ").trim().slice(0, 300) });
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const jeito = pedido ? jeitoDeVer(pedido.nome) : null;

  useEffect(() => {
    if (!pedido || !jeito) return;
    const controle = new AbortController();
    carregar(pedido, jeito, controle.signal)
      .then((e) => { if (!controle.signal.aborted) setEstado(e); })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return;
        setEstado({ fase: "erro", mensagem: e instanceof Error && e.message ? e.message : "Não consegui ler o arquivo." });
      });
    return () => controle.abort();
  }, [pedido, jeito]);

  const fechar = useCallback(() => setPedido(null), []);
  const conteudo = estado.fase === "pronto" ? estado.conteudo : null;

  /** O que o botão Copiar leva (texto do documento, dos slides ou do arquivo). A planilha tem o copiar dela. */
  const paraCopiar = useMemo(() => {
    if (!conteudo) return "";
    if (conteudo.t === "documento") return documentoComoTexto(conteudo.documento);
    if (conteudo.t === "slides") return apresentacaoComoTexto(conteudo.apresentacao);
    if (conteudo.t === "texto") return conteudo.texto;
    return "";
  }, [conteudo]);
  const copiar = async () => {
    if (!(await copiarTexto(paraCopiar))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const Icone = jeito ? ICONE[jeito] : ArquivoGenerico;
  const detalhe = !jeito ? "" : [
    NOME_DO_JEITO[jeito],
    conteudo?.t === "planilha" && conteudo.planilha.abas.length > 1 ? `${conteudo.planilha.abas.length} abas` : "",
    conteudo?.t === "slides" ? `${conteudo.apresentacao.slides.length} ${conteudo.apresentacao.slides.length === 1 ? "slide" : "slides"}` : "",
    conteudo?.t === "zip" ? `${conteudo.entradas.filter((e) => !e.pasta).length} arquivos` : "",
    estado.fase === "pronto" && estado.tamanho ? tamanhoLegivel(estado.tamanho) : "",
  ].filter(Boolean).join(" · ");
  const ehMarkdown = jeito === "markdown" && conteudo?.t === "texto";

  return (
    <Dialog open={!!pedido} onOpenChange={(a) => { if (!a) fechar(); }}>
      <DialogContent
        semFechar
        data-slot="visor-de-arquivo"
        data-jeito={jeito || undefined}
        aria-describedby={undefined}
        className="h-[calc(100vh-3rem)] max-w-[min(1500px,calc(100vw-2rem))] gap-0"
        // o foco vai para a janela (não para o primeiro botão) e, ao fechar, volta para o link que abriu o arquivo
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (foco.current?.isConnected) foco.current.focus({ preventScroll: true });
          foco.current = null;
        }}>
        <header className="flex shrink-0 items-center gap-2.5 border-b py-2 pr-2.5 pl-4">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary [&_svg]:size-4"><Icone /></span>
          <div className="min-w-0 flex-1">
            <DialogTitle data-slot="visor-nome" className="truncate text-sm">{pedido?.titulo}</DialogTitle>
            <DialogDescription data-slot="visor-detalhe" className="truncate text-xs">
              {pedido && pedido.titulo !== pedido.nome ? `${pedido.nome.split("/").pop()} · ` : ""}{detalhe}
            </DialogDescription>
          </div>
          {ehMarkdown && (
            <Segmentado aria-label="Como mostrar o Markdown" tamanho="sm" valor={cru ? "cru" : "lido"} aoMudar={(v) => setCru(v === "cru")}
              opcoes={[{ valor: "lido", rotulo: "Formatado" }, { valor: "cru", rotulo: "Texto cru" }]} />
          )}
          {conteudo?.t === "texto" && (!ehMarkdown || cru) && (
            <Dica texto={quebrar ? "Não quebrar as linhas compridas" : "Quebrar as linhas compridas"}>
              <Button variant="ghost" size="icon-sm" aria-label="Quebrar as linhas compridas" aria-pressed={quebrar} onClick={() => setQuebrar((q) => !q)}><WrapText className={cn(quebrar && "text-primary")} /></Button>
            </Dica>
          )}
          {paraCopiar && (
            <Dica texto="Copiar o texto">
              <Button variant="outline" size="sm" data-slot="visor-copiar" onClick={() => void copiar()}>{copiado ? <Check /> : <Copy />} Copiar</Button>
            </Dica>
          )}
          {pedido && (
            <>
              {jeito === "pdf" && (
                <Dica texto="Abrir em outra aba">
                  <Button asChild variant="ghost" size="icon-sm"><a href={urlDoPdf(pedido.url)} target="_blank" rel="noopener noreferrer" aria-label="Abrir em outra aba"><ExternalLink /></a></Button>
                </Dica>
              )}
              <Dica texto="Baixar o arquivo">
                <Button asChild variant="ghost" size="icon-sm"><a href={urlParaBaixar(pedido.url)} aria-label="Baixar o arquivo" data-slot="visor-baixar-arquivo"><Download /></a></Button>
              </Dica>
            </>
          )}
          <Dica texto="Fechar" atalho="Esc">
            <DialogClose asChild><Button variant="ghost" size="icon-sm" aria-label="Fechar" data-slot="visor-fechar-arquivo"><X /></Button></DialogClose>
          </Dica>
        </header>

        <div data-slot="visor-corpo" data-fase={estado.fase} className="flex min-h-0 flex-1 flex-col">
          {estado.fase === "carregando" && (
            <p role="status" className="m-auto flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Abrindo o arquivo...</p>
          )}
          {estado.fase === "erro" && pedido && (
            <div role="alert" data-slot="visor-erro" className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
              <TriangleAlert className="size-6 text-alerta" />
              <p className="text-[13px]">{estado.mensagem}</p>
              <Button asChild variant="outline" size="sm"><a href={urlParaBaixar(pedido.url)}><Download /> Baixar o arquivo</a></Button>
            </div>
          )}
          {estado.fase === "pronto" && pedido && jeito && (
            <Corpo pedido={pedido} jeito={jeito} conteudo={estado.conteudo} aba={aba} aoMudarAba={setAba} cru={cru} quebrar={quebrar} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Corpo({ pedido, jeito, conteudo, aba, aoMudarAba, cru, quebrar }: {
  pedido: Pedido; jeito: JeitoDeVer; conteudo: Conteudo; aba: number; aoMudarAba: (i: number) => void; cru: boolean; quebrar: boolean;
}) {
  if (conteudo.t === "direto" && jeito === "pdf")
    // o leitor de PDF é o do navegador: é ele que dá zoom, busca e impressão. A rota só deixa embutir PDF, e só pelo app
    return <iframe data-slot="visor-pdf" src={urlDoPdf(pedido.url)} title={pedido.titulo} className="min-h-0 w-full flex-1 border-0 bg-muted" />;

  if (conteudo.t === "direto") {
    const audio = ehSoAudio(pedido.nome);
    return (
      <div data-slot="visor-midia" className="flex min-h-0 flex-1 items-center justify-center bg-black p-4">
        <Player
          src={urlDaMidia(pedido.url)}
          somenteAudio={audio}
          titulo={pedido.titulo}
          // para o player lembrar onde este arquivo parou (a chave tem que ter a forma de um id)
          paginaId={`anexo-${pedido.nome.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 80)}
          className={cn("w-full", audio ? "h-48 max-w-2xl" : "max-h-full aspect-video max-w-[min(100%,calc((100vh-12rem)*16/9))]")}
        />
      </div>
    );
  }

  if (conteudo.t === "planilha") {
    const abas = conteudo.planilha.abas;
    const atual = abas[Math.min(aba, abas.length - 1)];
    return (
      <>
        {/* a chave faz cada aba ter o próprio filtro e a própria célula escolhida: o filtro de uma não esvazia a outra */}
        <TabelaDeDados key={abas.indexOf(atual)} aba={atual} className="flex-1" />
        {abas.length > 1 && (
          <div role="tablist" aria-label="Abas da planilha" data-slot="abas-da-planilha" className="flex shrink-0 items-center gap-1 overflow-x-auto border-t bg-muted/40 px-3 py-1.5 esmaece-fim-x">
            {abas.map((a, i) => (
              <button key={i} type="button" role="tab" aria-selected={a === atual} data-slot="aba-da-planilha" onClick={() => aoMudarAba(i)}
                className={cn(
                  "inline-flex h-7 max-w-56 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none transition-colors sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35",
                  a === atual ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}>
                <span className="truncate">{a.nome}</span>
                {a.oculta && <span className="shrink-0 text-[11px] font-normal text-muted-foreground">oculta</span>}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  if (conteudo.t === "documento") {
    const { blocos, cortado } = conteudo.documento;
    return (
      <div data-slot="visor-documento" className="min-h-0 flex-1 overflow-y-auto bg-card">
        <Aviso>Só o texto do documento, sem a formatação, as imagens e os comentários. Para ver como ele é, baixe e abra no Word.</Aviso>
        <div className="prosa mx-auto w-full max-w-[820px] px-8 py-6 text-[15px] leading-relaxed">
          {blocos.length === 0 && <p className="text-muted-foreground">O documento não tem texto.</p>}
          {blocos.map((b, i) => {
            if (b.t === "titulo") return b.nivel === 1 ? <h1 key={i}>{b.texto}</h1> : b.nivel === 2 ? <h2 key={i}>{b.texto}</h2> : <h3 key={i}>{b.texto}</h3>;
            if (b.t === "item") return <p key={i} className="!my-1 flex gap-2" style={{ paddingLeft: b.nivel * 20 + 4 }}><span aria-hidden className="text-muted-foreground">•</span><span className="texto-pre">{b.texto}</span></p>;
            if (b.t === "tabela")
              return (
                <div key={i} className="overflow-x-auto">
                  <table><tbody>{b.linhas.map((l, r) => <tr key={r}>{l.map((c, k) => <td key={k} className="texto-pre align-top">{c}</td>)}</tr>)}</tbody></table>
                </div>
              );
            return <p key={i} className="texto-pre">{b.texto}</p>;
          })}
          {cortado && <p className="text-xs text-alerta">O documento é maior do que o Nexo mostra aqui: o fim ficou de fora.</p>}
        </div>
      </div>
    );
  }

  if (conteudo.t === "slides") {
    const { slides } = conteudo.apresentacao;
    return (
      <div data-slot="visor-slides" className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
        <Aviso>Só o texto de cada slide, sem o desenho e as imagens. Para ver a apresentação, baixe e abra no PowerPoint.</Aviso>
        <ol className="mx-auto flex w-full max-w-[820px] flex-col gap-3 px-6 py-5">
          {slides.map((s) => (
            <li key={s.numero} data-slot="slide" className="rounded-xl border bg-card px-5 py-4 shadow-xs">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase sem-selecao">Slide {s.numero}</p>
              {s.titulo && <h3 className="mt-0.5 text-[15px] leading-snug font-semibold tracking-tight">{s.titulo}</h3>}
              {s.linhas.length > 0 && <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">{s.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              {!s.titulo && s.linhas.length === 0 && <p className="mt-1 text-[13px] text-muted-foreground">Sem texto (só imagem ou desenho).</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (conteudo.t === "zip") return <ListaDoZip entradas={conteudo.entradas} />;

  if (jeito === "markdown" && !cru)
    return (
      <div data-slot="visor-markdown" className="min-h-0 flex-1 overflow-y-auto bg-card">
        <TextoRico texto={conteudo.texto} ancoras className="mx-auto w-full max-w-[820px] px-8 py-6 text-[15px] leading-relaxed" />
      </div>
    );

  return <TextoComLinhas texto={conteudo.texto} linguagem={jeito === "markdown" ? "" : linguagemDoArquivo(pedido.nome)} quebrar={quebrar} html={/^(html?|xhtml|svg)$/.test(extensaoDe(pedido.nome))} />;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="border-b bg-muted/50 px-4 py-1.5 text-center text-xs text-muted-foreground sem-selecao">{children}</p>;
}

/** Texto, log ou código: número de linha, cores quando a linguagem é conhecida, e o resto atrás de "mostrar mais". */
function TextoComLinhas({ texto, linguagem, quebrar, html }: { texto: string; linguagem: string; quebrar: boolean; html: boolean }) {
  const [limite, setLimite] = useState(TETO_DO_TEXTO);
  useEffect(() => setLimite(TETO_DO_TEXTO), [texto]);
  // corta no fim de uma linha, para não mostrar meia linha
  const visivel = useMemo(() => {
    if (texto.length <= limite) return texto;
    const fim = texto.lastIndexOf("\n", limite);
    return texto.slice(0, fim > 0 ? fim : limite);
  }, [texto, limite]);
  const linhas = useMemo(() => realcar(visivel, linguagem), [visivel, linguagem]);
  const largura = String(linhas.length).length;
  return (
    <div data-slot="visor-texto" className="min-h-0 flex-1 overflow-auto bg-card">
      {html && <Aviso>O código-fonte do arquivo. O Nexo não abre páginas HTML nem desenhos SVG de anexos, por segurança.</Aviso>}
      {texto.length === 0 && <p className="p-6 text-[13px] text-muted-foreground">O arquivo está vazio.</p>}
      <pre data-slot="visor-codigo" className={cn("m-0 min-w-full rounded-none border-0 bg-transparent py-3 font-mono text-[12.5px] leading-[1.55]", quebrar ? "w-full" : "w-max")}>
        {linhas.map((l, i) => (
          <div key={i} className="flex hover:bg-accent/40">
            <span aria-hidden style={{ minWidth: `${largura + 2}ch` }} className="sticky left-0 shrink-0 border-r bg-card pr-2 pl-3 text-right text-muted-foreground tabular-nums sem-selecao">{i + 1}</span>
            <code className={cn("min-w-0 flex-1 rounded-none border-0 bg-transparent pr-4 pl-3 text-[length:inherit]", quebrar ? "break-words whitespace-pre-wrap" : "whitespace-pre")}>
              {l.length === 0 ? "\n" : l.map((p, j) => (p.t ? <span key={j} data-rc={p.t}>{p.v}</span> : <Fragment key={j}>{p.v}</Fragment>))}
            </code>
          </div>
        ))}
      </pre>
      {visivel.length < texto.length && (
        <div className="sticky left-0 flex items-center gap-3 border-t px-4 py-3">
          <span className="text-xs text-muted-foreground">Mostrando o começo: {tamanhoLegivel(visivel.length)} de {tamanhoLegivel(texto.length)}.</span>
          <Button variant="outline" size="sm" onClick={() => setLimite((n) => n * 4)}>Mostrar mais</Button>
        </div>
      )}
    </div>
  );
}

/** O que tem dentro de um ZIP: nome e tamanho de cada arquivo. Só lista: nada é extraído para o disco. */
function ListaDoZip({ entradas }: { entradas: EntradaZip[] }) {
  const [limite, setLimite] = useState(500);
  const arquivos = useMemo(() => entradas.filter((e) => !e.pasta), [entradas]);
  const total = arquivos.reduce((n, e) => n + e.tamanho, 0);
  return (
    <div data-slot="visor-zip" className="min-h-0 flex-1 overflow-y-auto bg-card">
      <Aviso>A lista do que tem dentro. Para abrir um dos arquivos, baixe o ZIP e descompacte.</Aviso>
      <div className="mx-auto w-full max-w-[900px] px-6 py-4">
        <p className="mb-2 text-xs text-muted-foreground tabular-nums">{arquivos.length} {arquivos.length === 1 ? "arquivo" : "arquivos"} · {tamanhoLegivel(total)} descompactado</p>
        <ul className="divide-y rounded-xl border">
          {arquivos.slice(0, limite).map((e, i) => (
            <li key={i} data-slot="entrada-do-zip" className="flex items-center gap-3 px-3 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{e.nome}</span>
              {e.cifrada && <span className="shrink-0 text-xs text-alerta">com senha</span>}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{tamanhoLegivel(e.tamanho)}</span>
            </li>
          ))}
          {arquivos.length === 0 && <li className="px-3 py-3 text-[13px] text-muted-foreground">O ZIP está vazio.</li>}
        </ul>
        {limite < arquivos.length && <Button variant="outline" size="sm" className="mt-3" onClick={() => setLimite((n) => n + 2000)}>Mostrar mais {Math.min(2000, arquivos.length - limite)}</Button>}
      </div>
    </div>
  );
}
