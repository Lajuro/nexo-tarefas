"use client";

// A visão de uma página de vídeo: o player em cima, as anotações embaixo e, ao lado, a transcrição
// sincronizada, os capítulos e o sumário. O texto da página são as anotações sobre o vídeo; os instantes
// citados nelas ("[12:34]") levam o player até lá.

import { type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus, Camera, Clapperboard, ClockPlus, Copy, Ellipsis, ExternalLink, FileText, FolderOpen, Link2, ListVideo, LoaderCircle, ScrollText, Sparkles, Trash2, Upload,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { copiarTexto, formatarTamanho } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { AreaArquivo } from "@/components/ui/chips";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/diversos";
import { Input, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { nomeDaPagina } from "@/lib/paginas";
import { hrefDoTempo, urlDaImagem } from "@/lib/texto-rico";
import { type Fala, falaNoInstante, formatarTempo, lerTranscricao, partesDaTranscricao, promptDoVideo, temTempos, transcricaoEmTexto } from "@/lib/transcricao";
import type { Pagina, VideoDaPagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import type { AcoesDePagina } from "../pecas";
import { type ControleDoPlayer, Player } from "./Player";
import { Transcricao } from "./Transcricao";

const SO_AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;

/** Escolher de onde vem o vídeo: enviar, apontar para um arquivo do computador ou só guardar o link. */
function FonteDoVideo({ aoEscolher }: { aoEscolher: (v: Partial<VideoDaPagina>) => void }) {
  const { enviarMidia } = useNexo();
  const [enviando, setEnviando] = useState<{ nome: string; parte: number } | null>(null);
  const [caminho, setCaminho] = useState("");
  const [url, setUrl] = useState("");

  const enviar = async (f: File | null) => {
    if (!f) return;
    setEnviando({ nome: f.name, parte: 0 });
    const r = await enviarMidia(f, (parte) => setEnviando({ nome: f.name, parte }));
    setEnviando(null);
    if (r) aoEscolher({ arquivo: r.arquivo, nomeArquivo: r.nomeArquivo, tamanho: r.tamanho, caminho: undefined, url: undefined });
  };

  return (
    <section data-slot="fonte-do-video" className="mb-6 rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight"><Clapperboard className="size-4 text-primary" /> De onde vem o vídeo?</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Vídeo ou áudio (MP4, WebM, MOV, MKV, MP3, M4A, WAV). Nada sai do seu computador.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium"><Upload className="size-3.5 text-muted-foreground" /> Enviar o arquivo</p>
          <p className="text-[11px] leading-snug text-muted-foreground">Uma cópia fica na pasta de dados, junto com o resto (e vai com ela para o OneDrive). Até 4 GB.</p>
          {enviando ? (
            <div role="status" data-slot="enviando-video" className="mt-auto">
              <p className="mb-1 truncate text-xs">{enviando.nome}</p>
              <Progress valor={enviando.parte * 100} />
              <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{Math.round(enviando.parte * 100)}% enviado</p>
            </div>
          ) : (
            <AreaArquivo arquivo={null} aoMudar={enviar} className="mt-auto" />
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium"><FolderOpen className="size-3.5 text-muted-foreground" /> Usar um arquivo deste computador</p>
          <p className="text-[11px] leading-snug text-muted-foreground">Não copia nada: o vídeo toca de onde está. Bom para gravações grandes. Só funciona neste computador.</p>
          <form className="mt-auto flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (caminho.trim()) aoEscolher({ caminho: caminho.trim().replace(/^["']|["']$/g, ""), arquivo: undefined, url: undefined }); }}>
            <Input data-slot="caminho-do-video" value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="C:\Videos\reuniao.mp4" aria-label="Caminho do arquivo de vídeo" className="font-mono text-xs" />
            <Button type="submit" variant="outline" disabled={!caminho.trim()}>Usar</Button>
          </form>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium"><Link2 className="size-3.5 text-muted-foreground" /> Só guardar o link</p>
          <p className="text-[11px] leading-snug text-muted-foreground">Para vídeo que mora em outro lugar. O Nexo não toca vídeo de fora: guarda o link, a transcrição e as anotações.</p>
          <form className="mt-auto flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (/^https?:\/\/\S+$/i.test(url.trim())) aoEscolher({ url: url.trim(), arquivo: undefined, caminho: undefined }); }}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." aria-label="Link do vídeo" className="text-xs" />
            <Button type="submit" variant="outline" disabled={!/^https?:\/\/\S+$/i.test(url.trim())}>Guardar</Button>
          </form>
        </div>
      </div>
    </section>
  );
}

/** Enviar ou colar a transcrição. */
function AnexarTranscricao({ aoAnexar }: { aoAnexar: (f: File) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const anexar = async (f: File | null) => {
    if (!f || enviando) return;
    setEnviando(true);
    await aoAnexar(f);
    setEnviando(false);
  };
  return (
    <div data-slot="anexar-transcricao" className="flex flex-col gap-3 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Com a transcrição, o texto acompanha o vídeo, dá para buscar o que foi dito e clicar numa fala para ir até ela.
        Aceita <strong>VTT</strong> e <strong>SRT</strong> (o Teams exporta VTT) ou texto com o tempo no começo de cada fala.
      </p>
      <AreaArquivo arquivo={null} aoMudar={anexar} />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground sem-selecao"><span className="h-px flex-1 bg-border" />ou cole o texto<span className="h-px flex-1 bg-border" /></div>
      <Textarea data-slot="colar-transcricao" value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={3000000} aria-label="Colar a transcrição"
        placeholder={"[00:05] Marina: Vamos começar pelo scan.\n[00:20] Bruno: Três achados são críticos."} className="font-mono text-xs" />
      <Button data-slot="usar-transcricao-colada" disabled={!texto.trim() || enviando} onClick={() => anexar(new File([texto], "transcricao.txt", { type: "text/plain" }))}>
        {enviando ? <LoaderCircle className="animate-spin" /> : <ScrollText />} Usar este texto
      </Button>
    </div>
  );
}

export function VisaoDeVideo({
  pagina, acoes, lendo, cabecalho, propriedades, anotacoes, rodape, painelDaPagina, painel, refDoCorpo, aoAnotar, aoCitar, inicio, tempoPedido,
}: {
  pagina: Pagina;
  acoes: AcoesDePagina;
  lendo: boolean;
  cabecalho: ReactNode;
  propriedades: ReactNode;
  /** As anotações (editor ou leitura). No leitor, quem as desenha recebe `aoIrParaTempo` por `refDoTempo`. */
  anotacoes: (aoIrParaTempo: (segundos: number) => void) => ReactNode;
  rodape: ReactNode;
  /** Sumário e citações (aba "Página"). */
  painelDaPagina: ReactNode;
  painel: boolean;
  refDoCorpo: Ref<HTMLDivElement>;
  /** Põe um instante nas anotações. */
  aoAnotar: (rotulo: string, href: string) => void;
  aoCitar: (markdown: string) => void;
  /** Abrir já neste instante (vindo de uma busca). */
  inicio?: number | null;
  /** Pedido de ir a um instante com a página já aberta. */
  tempoPedido?: { tempo: number; vez: number } | null;
}) {
  const { enviarArquivo, toast } = useNexo();
  const confirmar = useConfirmar();
  const id = pagina.id;
  const video = useMemo<VideoDaPagina>(() => pagina.video ?? {}, [pagina.video]);
  const controle = useRef<ControleDoPlayer>(null);
  const [aba, setAba] = useState<"transcricao" | "capitulos" | "pagina">("transcricao");
  const [falas, setFalas] = useState<Fala[] | null>(null);
  const [erroDaTranscricao, setErroDaTranscricao] = useState(false);
  const [ativa, setAtiva] = useState(-1);

  const src = video.arquivo ? `/api/midia?p=${encodeURIComponent(video.arquivo)}` : video.caminho ? `/api/midia?pagina=${encodeURIComponent(id)}&c=${encodeURIComponent(video.caminho.length + video.caminho.slice(-12))}` : null;
  const somenteAudio = SO_AUDIO.test(video.arquivo ?? video.caminho ?? "");
  const mudarVideo = useCallback((parte: Partial<VideoDaPagina>) => acoes.mudar(id, { video: { ...video, ...parte } }), [acoes, id, video]);

  // a transcrição é um arquivo da pasta de dados: lida e interpretada quando a página abre
  useEffect(() => {
    setFalas(null);
    setErroDaTranscricao(false);
    setAtiva(-1);
    if (!video.transcricao) return;
    let vivo = true;
    fetch(`/api/arquivos?p=${encodeURIComponent(video.transcricao)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => vivo && setFalas(lerTranscricao(t)))
      .catch(() => vivo && setErroDaTranscricao(true));
    return () => { vivo = false; };
  }, [video.transcricao]);

  const comTempo = useMemo(() => !!falas && temTempos(falas), [falas]);
  const falasRef = useRef<Fala[] | null>(null);
  falasRef.current = falas;
  const aoTempo = useCallback((t: number) => {
    const f = falasRef.current;
    if (!f) return;
    const i = falaNoInstante(f, t);
    // só vale como "sendo dita" enquanto não passou muito do fim dela
    setAtiva(i >= 0 && t <= f[i].fim + 2 ? i : -1);
  }, []);
  const legendaEm = useCallback((t: number) => {
    const f = falasRef.current;
    if (!f) return "";
    const i = falaNoInstante(f, t);
    return i >= 0 && t <= f[i].fim + 0.4 ? f[i].texto : "";
  }, []);
  const irPara = useCallback((segundos: number) => {
    if (controle.current) controle.current.irPara(segundos, true);
    else toast("Este vídeo não toca dentro do Nexo, então não dá para pular até o instante.", "info");
  }, [toast]);
  useEffect(() => {
    if (tempoPedido) irPara(tempoPedido.tempo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoPedido?.vez]);

  const agora = () => controle.current?.tempo() ?? 0;
  const capitulos = video.capitulos ?? [];
  const marcarCapitulo = () => {
    const t = Math.round(agora());
    if (capitulos.some((c) => c.t === t)) return;
    void mudarVideo({ capitulos: [...capitulos, { t, titulo: "" }].sort((a, b) => a.t - b.t) });
    setAba("capitulos");
  };
  const usarQuadroComoCapa = async () => {
    const blob = await controle.current?.quadro();
    if (!blob) return toast("Não consegui tirar um quadro deste vídeo.", "erro");
    const r = await enviarArquivo(new File([blob], `capa-${id}.png`, { type: "image/png" }));
    if (r) { await mudarVideo({ capa: r.arquivo }); toast("Este quadro virou a capa do vídeo."); }
  };
  const anexarTranscricao = async (f: File) => {
    if (f.size > 4 * 1024 * 1024) return toast("Esse arquivo passa de 4 MB. Uma transcrição é texto: confira se escolheu o arquivo certo.", "erro");
    const r = await enviarArquivo(f);
    if (r) { await mudarVideo({ transcricao: r.arquivo, nomeTranscricao: r.nomeArquivo }); toast("Transcrição anexada."); }
  };
  const tirarVideo = async () => {
    const ok = await confirmar({ titulo: "Tirar o vídeo desta página?", descricao: "A página continua, com as anotações, a transcrição e os capítulos. O arquivo do vídeo não é apagado: fica na pasta de dados (ou onde estava).", confirmar: "Tirar" });
    if (ok) await mudarVideo({ arquivo: undefined, nomeArquivo: undefined, tamanho: undefined, caminho: undefined, url: undefined, duracao: undefined });
  };

  const partes = useMemo(() => (falas ? partesDaTranscricao(falas) : []), [falas]);
  const copiarPrompt = async (i: number) => {
    if (await copiarTexto(promptDoVideo(nomeDaPagina(pagina), partes[i], i + 1, partes.length))) toast(partes.length > 1 ? `Prompt da parte ${i + 1} de ${partes.length} copiado. Cole a resposta nas anotações.` : "Prompt copiado. Cole a resposta do Copilot nas anotações: os tempos viram botões.");
  };

  return (
    <div data-slot="visao-de-video" className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {src && (
          <div className="flex shrink-0 justify-center bg-black">
            <Player
              key={src}
              controle={controle}
              src={src}
              somenteAudio={somenteAudio}
              capa={video.capa ? urlDaImagem(`arquivos/${video.capa}`) : null}
              titulo={nomeDaPagina(pagina)}
              paginaId={id}
              capitulos={capitulos}
              legendaEm={legendaEm}
              comLegenda={comTempo}
              aoTempo={aoTempo}
              inicio={inicio}
              aoDuracao={(d) => { if (Math.abs((video.duracao ?? 0) - d) > 1.5) void mudarVideo({ duracao: Math.round(d) }); }}
              className={cn("w-full rounded-none", somenteAudio ? "h-40" : "aspect-video max-w-[78vh]")}
            />
          </div>
        )}

        <div ref={refDoCorpo} data-slot="corpo-da-pagina" className="min-h-0 flex-1 overflow-y-auto scroll-pt-4">
          <div className="mx-auto w-full max-w-[860px] px-8 pt-5 pb-24"
            // no editor, clicar num instante citado também leva o vídeo até lá
            onClick={(e) => {
              const link = (e.target as HTMLElement).closest?.('a[href^="nexo:tempo/"]');
              if (link) { e.preventDefault(); irPara(Number((link.getAttribute("href") ?? "").split("/")[1]) || 0); }
            }}>
            {!src && !video.url && !pagina.arquivadaEm && <FonteDoVideo aoEscolher={(v) => mudarVideo(v)} />}
            {!src && video.url && (
              <section data-slot="video-de-fora" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
                <Clapperboard className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-[13px] font-medium">Este vídeo está em um link de fora</p>
                  <p className="truncate text-xs text-muted-foreground">{video.url}</p>
                </div>
                <Button asChild variant="outline"><a href={video.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink /> Abrir o vídeo</a></Button>
                <Button variant="ghost" size="icon" aria-label="Tirar o link" onClick={tirarVideo}><Trash2 /></Button>
              </section>
            )}

            {cabecalho}
            {propriedades}

            {src && (
              <div data-slot="acoes-do-video" className="mt-3 flex flex-wrap items-center gap-1.5">
                <Dica texto="Põe nas anotações o instante em que o vídeo está, para voltar a ele com um clique">
                  <Button size="sm" data-slot="anotar-instante" disabled={lendo && !!pagina.arquivadaEm} onClick={() => { const t = agora(); aoAnotar(formatarTempo(t), hrefDoTempo(t)); }}><ClockPlus /> Anotar neste instante</Button>
                </Dica>
                <Dica texto="Marca um capítulo aqui. Os capítulos aparecem na barra do vídeo.">
                  <Button size="sm" variant="outline" data-slot="marcar-capitulo" onClick={marcarCapitulo}><BookmarkPlus /> Capítulo aqui</Button>
                </Dica>
                <span className="ml-auto hidden min-w-0 truncate text-[11px] text-muted-foreground tabular-nums sem-selecao xl:inline">
                  {video.nomeArquivo ?? (video.caminho ? video.caminho.split(/[\\/]/).pop() : "")}{video.tamanho ? ` · ${formatarTamanho(video.tamanho)}` : ""}{video.duracao ? ` · ${formatarTempo(video.duracao)}` : ""}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="ml-auto shrink-0 xl:ml-0" aria-label="Mais ações do vídeo" data-slot="menu-do-video"><Ellipsis /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    {!somenteAudio && <DropdownMenuItem onSelect={usarQuadroComoCapa}><Camera /> Usar este quadro como capa</DropdownMenuItem>}
                    <DropdownMenuItem onSelect={async () => { const t = agora(); if (await copiarTexto(`[${formatarTempo(t)}](${hrefDoTempo(t)})`)) toast("Instante copiado. Cole em qualquer anotação desta página.", "info"); }}><Copy /> Copiar o instante atual</DropdownMenuItem>
                    {video.caminho && <DropdownMenuItem onSelect={async () => { if (await copiarTexto(video.caminho ?? "")) toast("Caminho copiado.", "info"); }}><FolderOpen /> Copiar o caminho do arquivo</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem perigo onSelect={tirarVideo}><Trash2 /> Tirar o vídeo da página</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="mt-4">{anotacoes(irPara)}</div>
            {rodape}
          </div>
        </div>
      </div>

      {painel && (
        <aside data-slot="painel-do-video" className="hidden w-[372px] shrink-0 flex-col border-l lg:flex">
          <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-full shrink-0 px-3">
              <TabsTrigger value="transcricao"><ScrollText /> Transcrição</TabsTrigger>
              <TabsTrigger value="capitulos"><ListVideo /> Capítulos{capitulos.length > 0 && <span className="text-[11px] font-normal text-muted-foreground tabular-nums">{capitulos.length}</span>}</TabsTrigger>
              <TabsTrigger value="pagina"><FileText /> Página</TabsTrigger>
            </TabsList>

            <TabsContent value="transcricao" className="flex min-h-0 flex-1 flex-col">
              {!video.transcricao ? (
                <div className="overflow-y-auto"><AnexarTranscricao aoAnexar={anexarTranscricao} /></div>
              ) : erroDaTranscricao ? (
                <div className="p-3 text-xs leading-relaxed">
                  <p className="text-destructive">Não consegui ler o arquivo da transcrição ({video.nomeTranscricao ?? video.transcricao}).</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => mudarVideo({ transcricao: undefined, nomeTranscricao: undefined })}>Anexar outra</Button>
                </div>
              ) : !falas ? (
                <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" /> Lendo a transcrição...</p>
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground sem-selecao">{falas.length} {falas.length === 1 ? "fala" : "falas"} · {video.nomeTranscricao ?? "transcrição"}</span>
                    {partes.length <= 1 ? (
                      <Dica texto="Copia um prompt com a transcrição, para o Copilot resumir com os tempos">
                        <Button variant="ghost" size="sm" data-slot="prompt-do-video" onClick={() => copiarPrompt(0)}><Sparkles className="text-primary" /> Resumir</Button>
                      </Dica>
                    ) : (
                      <DropdownMenu>
                        <Dica texto="A transcrição é longa: o prompt sai em partes, uma de cada vez">
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" data-slot="prompt-do-video"><Sparkles className="text-primary" /> Resumir ({partes.length} partes)</Button></DropdownMenuTrigger>
                        </Dica>
                        <DropdownMenuContent align="end">
                          {partes.map((_, i) => <DropdownMenuItem key={i} onSelect={() => copiarPrompt(i)}><Copy /> Copiar o prompt da parte {i + 1}</DropdownMenuItem>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Mais ações da transcrição"><Ellipsis /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={async () => { if (await copiarTexto(transcricaoEmTexto(falas))) toast("Transcrição copiada."); }}><Copy /> Copiar a transcrição inteira</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => mudarVideo({ transcricao: undefined, nomeTranscricao: undefined })}><Upload /> Trocar a transcrição</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Transcricao falas={falas} ativa={ativa} aoIrPara={irPara} aoCitar={pagina.arquivadaEm ? undefined : aoCitar} aoAvisar={(t) => toast(t, "info")} />
                </>
              )}
            </TabsContent>

            <TabsContent value="capitulos" className="min-h-0 flex-1 overflow-y-auto p-3">
              {capitulos.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">Nenhum capítulo ainda. Toque o vídeo e use <strong>Capítulo aqui</strong> nos pontos em que o assunto muda: eles viram marcas na barra do player.</p>
              ) : (
                <ul data-slot="capitulos" className="flex flex-col gap-1.5">
                  {capitulos.map((c, i) => (
                    <li key={c.t} className="flex items-center gap-1.5">
                      <button type="button" onClick={() => irPara(c.t)} className="shrink-0 rounded px-1.5 py-1 text-xs font-medium tabular-nums text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40">{formatarTempo(c.t)}</button>
                      <Input defaultValue={c.titulo} placeholder="Nome do capítulo" aria-label={`Nome do capítulo em ${formatarTempo(c.t)}`} maxLength={200} className="h-7 text-xs" autoFocus={!c.titulo && i === capitulos.length - 1}
                        onBlur={(e) => { if (e.target.value.trim() !== c.titulo) void mudarVideo({ capitulos: capitulos.map((x) => (x.t === c.t ? { ...x, titulo: e.target.value.trim() } : x)) }); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                      <Dica texto="Tirar o capítulo"><Button variant="ghost" size="icon-sm" aria-label="Tirar o capítulo" onClick={() => mudarVideo({ capitulos: capitulos.filter((x) => x.t !== c.t) })}><Trash2 /></Button></Dica>
                    </li>
                  ))}
                </ul>
              )}
              {src && <Button variant="outline" size="sm" className="mt-3" onClick={marcarCapitulo}><BookmarkPlus /> Capítulo no instante atual</Button>}
            </TabsContent>

            <TabsContent value="pagina" className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">{painelDaPagina}</TabsContent>
          </Tabs>
        </aside>
      )}
    </div>
  );
}
