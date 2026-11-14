"use client";

// Player de vídeo do Nexo: controles próprios (nada do navegador), feito para estudar uma gravação:
// pular 10 segundos, mudar a velocidade, ver os capítulos na barra, legenda vinda da transcrição,
// retomar de onde parou e tirar um quadro como capa. Toca vídeo e áudio da pasta de dados ou de um
// caminho do computador; nada vem de fora.
//
// Atalhos. Em qualquer lugar da página (fora de um campo de texto): Espaço ou K toca e pausa, as setas
// pulam 5 s. Com o player em foco (um clique no vídeo): J e L pulam 10 s, cima e baixo o volume, M o mudo,
// C a legenda, F a tela cheia, < e > a velocidade, 0 a 9 vão para a fração do vídeo.

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  AudioLines, Captions, CaptionsOff, LoaderCircle, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, TriangleAlert, Volume1, Volume2, VolumeX,
} from "lucide-react";
import { Slider } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import { usePref } from "@/lib/preferencias";
import { formatarTempo } from "@/lib/transcricao";
import { cn } from "@/lib/utils";

export interface ControleDoPlayer {
  irPara: (segundos: number, tocar?: boolean) => void;
  tempo: () => number;
  pausar: () => void;
  alternar: () => void;
  /** O quadro que está na tela, como imagem PNG (null se não deu, ou se é só áudio). */
  quadro: () => Promise<Blob | null>;
}

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
interface PrefDoPlayer { velocidade: number; volume: number; mudo: boolean; legendas: boolean }
const PREF_PADRAO: PrefDoPlayer = { velocidade: 1, volume: 1, mudo: false, legendas: true };
function normalizarPref(x: unknown): PrefDoPlayer {
  const p = (x && typeof x === "object" ? x : {}) as Partial<PrefDoPlayer>;
  return {
    velocidade: VELOCIDADES.includes(Number(p.velocidade)) ? Number(p.velocidade) : 1,
    volume: Number.isFinite(Number(p.volume)) ? Math.min(1, Math.max(0, Number(p.volume))) : 1,
    mudo: p.mudo === true,
    legendas: p.legendas !== false,
  };
}
/** Onde cada vídeo parou (segundos), para retomar. Fica no navegador; guarda os 60 mais recentes. */
function normalizarPosicoes(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(-60)) if (/^[a-zA-Z0-9_-]{1,80}$/.test(k) && Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Number(v);
  return out;
}

function Botao({ dica, atalho, aoClicar, ativo, children, slot, className }: { dica: string; atalho?: string; aoClicar: () => void; ativo?: boolean; children: React.ReactNode; slot?: string; className?: string }) {
  return (
    <Dica texto={dica} atalho={atalho} side="top">
      <button type="button" aria-label={dica} aria-pressed={ativo} data-slot={slot} onClick={(e) => { e.stopPropagation(); aoClicar(); }}
        className={cn("inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-white/90 transition-colors outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:size-[18px]", ativo && "text-white", className)}>
        {children}
      </button>
    </Dica>
  );
}

export function Player({
  src, somenteAudio, capa, titulo, paginaId, capitulos = [], legendaEm, comLegenda, aoTempo, aoDuracao, aoErro, controle, inicio, className,
}: {
  src: string;
  /** Arquivo de áudio: em vez da imagem, mostra um painel com o título. */
  somenteAudio?: boolean;
  /** Imagem mostrada antes de tocar (endereço local). */
  capa?: string | null;
  titulo: string;
  /** Para lembrar onde este vídeo parou. */
  paginaId: string;
  capitulos?: { t: number; titulo: string }[];
  /** O que está sendo dito no instante t (da transcrição), para a legenda e para a dica da barra. */
  legendaEm?: (segundos: number) => string;
  comLegenda?: boolean;
  /** Avisado umas 4 vezes por segundo enquanto toca, e a cada pulo. */
  aoTempo?: (segundos: number) => void;
  aoDuracao?: (segundos: number) => void;
  aoErro?: () => void;
  controle?: React.Ref<ControleDoPlayer>;
  /** Começar neste instante (vindo de uma busca na transcrição, por exemplo). */
  inicio?: number | null;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  const [prefBruta, setPref] = usePref<unknown>("player", PREF_PADRAO);
  const pref = useMemo(() => normalizarPref(prefBruta), [prefBruta]);
  const [posicoesBrutas, setPosicoes] = usePref<unknown>("videoPosicoes", {});
  const posicoes = useRef(normalizarPosicoes(posicoesBrutas));

  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [carregado, setCarregado] = useState(0);
  const [esperando, setEsperando] = useState(true);
  const [erro, setErro] = useState(false);
  const [cheia, setCheia] = useState(false);
  const [parado, setParado] = useState(false); // ponteiro parado: esconde os controles enquanto toca
  const [sobre, setSobre] = useState<{ x: number; t: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const relogioDoAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = (texto: string) => {
    setAviso(texto);
    if (relogioDoAviso.current) clearTimeout(relogioDoAviso.current);
    relogioDoAviso.current = setTimeout(() => setAviso(""), 900);
  };

  const aoTempoRef = useRef(aoTempo);
  aoTempoRef.current = aoTempo;

  // ---------- ações ----------
  const irPara = useCallback((segundos: number, tocar?: boolean) => {
    const v = video.current;
    if (!v) return;
    const fim = Number.isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(segundos, fim - 0.05));
    setTempo(v.currentTime);
    aoTempoRef.current?.(v.currentTime);
    if (tocar) void v.play().catch(() => {});
  }, []);
  const alternar = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);
  const pular = useCallback((delta: number) => {
    const v = video.current;
    if (!v) return;
    irPara(v.currentTime + delta);
    avisar(`${delta > 0 ? "+" : "−"}${Math.abs(delta)} s`);
  }, [irPara]);
  const mudarVelocidade = useCallback((passo: number) => {
    setPref((atual: unknown) => {
      const p = normalizarPref(atual);
      const i = Math.min(VELOCIDADES.length - 1, Math.max(0, VELOCIDADES.indexOf(p.velocidade) + passo));
      avisar(`${String(VELOCIDADES[i]).replace(".", ",")}x`);
      return { ...p, velocidade: VELOCIDADES[i] };
    });
  }, [setPref]);
  const mudarVolume = useCallback((volume: number) => setPref((atual: unknown) => ({ ...normalizarPref(atual), volume: Math.min(1, Math.max(0, volume)), mudo: volume <= 0 })), [setPref]);
  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void caixa.current?.requestFullscreen?.().catch(() => {});
  }, []);
  const quadro = useCallback(async (): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const tela = document.createElement("canvas");
    const escala = Math.min(1, 960 / v.videoWidth);
    tela.width = Math.round(v.videoWidth * escala);
    tela.height = Math.round(v.videoHeight * escala);
    tela.getContext("2d")?.drawImage(v, 0, 0, tela.width, tela.height);
    return new Promise((ok) => tela.toBlob((b) => ok(b), "image/png"));
  }, []);

  useImperativeHandle(controle, () => ({ irPara, tempo: () => video.current?.currentTime ?? 0, pausar: () => video.current?.pause(), alternar, quadro }), [irPara, alternar, quadro]);

  // velocidade, volume e mudo valem para todos os vídeos
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = pref.velocidade;
    v.volume = pref.volume;
    v.muted = pref.mudo;
  }, [pref.velocidade, pref.volume, pref.mudo, src]);

  // enquanto toca, o tempo anda a cada quadro de animação (barra suave); para fora vai umas 4 vezes por segundo
  useEffect(() => {
    if (!tocando) return;
    let quadroAtual = 0;
    let ultimoAviso = 0;
    let ultimoSalvo = 0;
    const andar = () => {
      const v = video.current;
      if (v) {
        setTempo(v.currentTime);
        const agora = performance.now();
        if (agora - ultimoAviso > 240) { ultimoAviso = agora; aoTempoRef.current?.(v.currentTime); }
        if (agora - ultimoSalvo > 5000) { ultimoSalvo = agora; posicoes.current = { ...posicoes.current, [paginaId]: Math.floor(v.currentTime) }; setPosicoes(posicoes.current); }
      }
      quadroAtual = requestAnimationFrame(andar);
    };
    quadroAtual = requestAnimationFrame(andar);
    return () => cancelAnimationFrame(quadroAtual);
  }, [tocando, paginaId, setPosicoes]);

  // tela cheia e ponteiro parado
  useEffect(() => {
    const aoMudar = () => setCheia(document.fullscreenElement === caixa.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);
  const relogioDoPonteiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mexeu = () => {
    setParado(false);
    if (relogioDoPonteiro.current) clearTimeout(relogioDoPonteiro.current);
    relogioDoPonteiro.current = setTimeout(() => setParado(true), 2600);
  };

  // atalhos: valem com o player em foco ou quando não se está digitando em nenhum campo
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      const noPlayer = !!alvo && !!caixa.current?.contains(alvo);
      if (!noPlayer && alvo?.closest("input, textarea, select, button, a, [contenteditable=true], [role=dialog], [role=menu], [role=listbox], [role=tab], [role=slider]")) return;
      if (noPlayer && alvo?.closest("[role=slider]") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const v = video.current;
      if (!v) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      // fora do player só valem tocar/pausar e as setas: as letras são atalhos do resto do app (G depois L, por exemplo)
      if (!noPlayer && ![" ", "k", "ArrowLeft", "ArrowRight"].includes(k)) return;
      let feito = true;
      if (k === " " || k === "k") { if (noPlayer && alvo?.closest("button") && k === " ") return; alternar(); }
      else if (k === "j") pular(-10);
      else if (k === "l") pular(10);
      else if (k === "ArrowLeft") pular(-5);
      else if (k === "ArrowRight") pular(5);
      else if (k === "ArrowUp") { mudarVolume(normalizarPref(prefRef.current).volume + 0.1); avisar("volume +"); }
      else if (k === "ArrowDown") { mudarVolume(normalizarPref(prefRef.current).volume - 0.1); avisar("volume −"); }
      else if (k === "m") setPref((a: unknown) => { const p = normalizarPref(a); return { ...p, mudo: !p.mudo }; });
      else if (k === "c") setPref((a: unknown) => { const p = normalizarPref(a); return { ...p, legendas: !p.legendas }; });
      else if (k === "f") alternarTelaCheia();
      else if (k === ">" || k === ".") mudarVelocidade(1);
      else if (k === "<" || k === ",") mudarVelocidade(-1);
      else if (k === "Home") irPara(0);
      else if (k === "End" && Number.isFinite(v.duration)) irPara(v.duration);
      else if (/^[0-9]$/.test(k) && Number.isFinite(v.duration)) irPara((v.duration * Number(k)) / 10);
      else feito = false;
      if (feito) e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alternar, pular, mudarVolume, mudarVelocidade, alternarTelaCheia, irPara, setPref]);
  const prefRef = useRef(prefBruta);
  prefRef.current = prefBruta;

  // ---------- barra de progresso ----------
  const total = duracao || 0;
  const tempoDoPonteiro = (clientX: number) => {
    const r = barra.current?.getBoundingClientRect();
    if (!r || !total) return 0;
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total));
  };
  const arrastando = useRef(false);
  const aoPressionar = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!total) return;
    arrastando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    irPara(tempoDoPonteiro(e.clientX));
  };
  const aoMover = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = barra.current?.getBoundingClientRect();
    if (!r || !total) return;
    const t = tempoDoPonteiro(e.clientX);
    setSobre({ x: Math.min(r.width - 8, Math.max(8, e.clientX - r.left)), t });
    if (arrastando.current) irPara(t);
  };

  const capituloAtual = useMemo(() => [...capitulos].reverse().find((c) => c.t <= tempo + 0.25), [capitulos, tempo]);
  const legenda = comLegenda && pref.legendas && legendaEm ? legendaEm(tempo) : "";
  const escondidos = tocando && parado && !sobre;
  const IconeVolume = pref.mudo || pref.volume === 0 ? VolumeX : pref.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={caixa} data-slot="player" data-tocando={tocando || undefined} data-audio={somenteAudio || undefined} tabIndex={0}
      aria-label={`Player: ${titulo}`}
      onPointerMove={mexeu} onPointerLeave={() => setParado(true)}
      className={cn("group/player relative isolate flex select-none items-center justify-center overflow-hidden bg-black text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", cheia ? "h-screen w-screen" : "rounded-xl", escondidos && "cursor-none", className)}>
      <video
        ref={video}
        src={src}
        poster={capa ?? undefined}
        playsInline
        preload="metadata"
        className={cn("h-full w-full object-contain", somenteAudio && "invisible absolute")}
        onClick={alternar}
        onDoubleClick={alternarTelaCheia}
        onPlay={() => setTocando(true)}
        onPause={() => {
          setTocando(false);
          const v = video.current;
          if (v) { posicoes.current = { ...posicoes.current, [paginaId]: Math.floor(v.currentTime) }; setPosicoes(posicoes.current); aoTempoRef.current?.(v.currentTime); }
        }}
        onEnded={() => { posicoes.current = { ...posicoes.current, [paginaId]: 0 }; setPosicoes(posicoes.current); }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setErro(false);
          if (Number.isFinite(v.duration)) { setDuracao(v.duration); aoDuracao?.(v.duration); }
          // começa no instante pedido; senão, de onde parou (se não estava no fim)
          const guardado = posicoes.current[paginaId] ?? 0;
          const comeco = inicio != null ? inicio : guardado > 3 && guardado < v.duration - 5 ? guardado : 0;
          if (comeco > 0) { v.currentTime = comeco; setTempo(comeco); aoTempoRef.current?.(comeco); }
        }}
        onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuracao(e.currentTarget.duration); }}
        onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setCarregado(b.end(b.length - 1)); }}
        onWaiting={() => setEsperando(true)}
        onCanPlay={() => setEsperando(false)}
        onPlaying={() => setEsperando(false)}
        onSeeked={(e) => { setTempo(e.currentTarget.currentTime); aoTempoRef.current?.(e.currentTarget.currentTime); }}
        onError={() => { setErro(true); setEsperando(false); aoErro?.(); }}
      />

      {somenteAudio && (
        <button type="button" onClick={alternar} aria-label={tocando ? "Pausar" : "Tocar"} className="flex h-full w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-primary/35 via-black to-black px-6 pb-16 text-center outline-none">
          <span className={cn("inline-flex size-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20", tocando && "animate-pulse")}><AudioLines className="size-7" /></span>
          <span className="line-clamp-2 max-w-[60ch] text-sm font-medium text-white/90">{titulo}</span>
        </button>
      )}

      {erro && (
        <div role="alert" data-slot="player-erro" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/85 px-8 text-center">
          <TriangleAlert className="size-7 text-alerta" />
          <p className="text-sm font-medium">Não consegui tocar este vídeo</p>
          <p className="max-w-[52ch] text-xs leading-relaxed text-white/70">
            O arquivo pode não estar neste computador (vídeo apontado por caminho só toca onde ele existe), o OneDrive pode ainda não ter baixado, ou o formato não é um que o navegador toque.
            MP4 (H.264) e WebM são os mais garantidos.
          </p>
        </div>
      )}
      {esperando && !erro && <LoaderCircle className="pointer-events-none absolute z-10 size-9 animate-spin text-white/80" />}
      {!tocando && !esperando && !erro && !somenteAudio && (
        <button type="button" aria-label="Tocar" onClick={alternar} className="absolute z-10 inline-flex size-16 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/25 backdrop-blur-sm transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-white">
          <Play className="ml-1 size-7 fill-white" />
        </button>
      )}
      {aviso && <div aria-hidden className="pointer-events-none absolute top-4 z-20 rounded-md bg-black/65 px-2.5 py-1 text-sm font-medium tabular-nums backdrop-blur-sm">{aviso}</div>}

      {/* legenda vinda da transcrição */}
      {legenda && !erro && (
        <div data-slot="player-legenda" aria-live="off" className={cn("pointer-events-none absolute inset-x-0 z-10 flex justify-center px-6 transition-[bottom] duration-200", escondidos ? "bottom-4" : "bottom-[72px]")}>
          <span className={cn("max-w-[86%] rounded-md bg-black/75 px-2.5 py-1 text-center leading-snug text-white [text-wrap:balance]", cheia ? "text-xl" : "text-[13px]")}>{legenda}</span>
        </div>
      )}

      {/* controles */}
      <div data-slot="player-controles" onClick={(e) => e.stopPropagation()}
        className={cn("absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-8 pb-2 transition-opacity duration-200", escondidos ? "pointer-events-none opacity-0" : "opacity-100")}>
        <div ref={barra} data-slot="player-barra" role="slider" tabIndex={0} aria-label="Posição no vídeo" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(tempo)} aria-valuetext={`${formatarTempo(tempo)} de ${formatarTempo(total)}`}
          className="group/barra relative flex h-4 cursor-pointer touch-none items-center outline-none"
          onPointerDown={aoPressionar} onPointerMove={aoMover}
          onPointerUp={(e) => { arrastando.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
          onPointerLeave={() => { if (!arrastando.current) setSobre(null); }}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); pular(-5); } else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); pular(5); } }}>
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-[height] group-hover/barra:h-1.5 group-focus-visible/barra:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: total ? `${Math.min(100, (carregado / total) * 100)}%` : 0 }} />
            <div data-slot="player-progresso" className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: total ? `${Math.min(100, (tempo / total) * 100)}%` : 0 }} />
            {total > 0 && capitulos.map((c) => (
              <span key={c.t} data-slot="player-marca" aria-hidden className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-white" style={{ left: `${Math.min(100, (c.t / total) * 100)}%` }} />
            ))}
            <span aria-hidden className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/barra:opacity-100 group-focus-visible/barra:opacity-100" style={{ left: total ? `${Math.min(100, (tempo / total) * 100)}%` : 0 }} />
          </div>
          {sobre && total > 0 && (
            <div aria-hidden className="pointer-events-none absolute bottom-5 z-30 flex max-w-64 -translate-x-1/2 flex-col items-center gap-0.5 rounded-md bg-black/85 px-2 py-1 text-center text-[11px] leading-snug backdrop-blur-sm" style={{ left: sobre.x }}>
              <span className="font-semibold tabular-nums">{formatarTempo(sobre.t)}</span>
              {[...capitulos].reverse().find((c) => c.t <= sobre.t)?.titulo && <span className="text-white/80">{[...capitulos].reverse().find((c) => c.t <= sobre.t)?.titulo}</span>}
              {legendaEm?.(sobre.t) && <span className="line-clamp-2 text-white/65">{legendaEm(sobre.t)}</span>}
            </div>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-0.5">
          <Botao dica={tocando ? "Pausar" : "Tocar"} atalho="Espaço" aoClicar={alternar} slot="player-tocar">{tocando ? <Pause className="fill-white" /> : <Play className="fill-white" />}</Botao>
          <Botao dica="Voltar 10 segundos" atalho="J" aoClicar={() => pular(-10)}><RotateCcw /></Botao>
          <Botao dica="Avançar 10 segundos" atalho="L" aoClicar={() => pular(10)}><RotateCw /></Botao>
          <span data-slot="player-tempo" className="ml-1.5 shrink-0 text-xs tabular-nums text-white/90">{formatarTempo(tempo)} <span className="text-white/55">/ {formatarTempo(total)}</span></span>
          {capituloAtual?.titulo && <span className="ml-2 hidden min-w-0 truncate text-xs text-white/70 sm:inline">· {capituloAtual.titulo}</span>}
          <span className="flex-1" />
          <Dica texto="Velocidade (clique para acelerar, Shift e clique para reduzir)" atalho="< >" side="top">
            <button type="button" data-slot="player-velocidade" aria-label={`Velocidade: ${pref.velocidade}x`} onClick={(e) => { e.stopPropagation(); if (pref.velocidade === 2 && !e.shiftKey) setPref((a: unknown) => ({ ...normalizarPref(a), velocidade: 0.5 })); else mudarVelocidade(e.shiftKey ? -1 : 1); }}
              className={cn("inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums text-white/90 transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70", pref.velocidade !== 1 && "text-primary-foreground ring-1 ring-white/40")}>
              {String(pref.velocidade).replace(".", ",")}x
            </button>
          </Dica>
          {comLegenda && (
            <Botao dica={pref.legendas ? "Esconder a legenda" : "Mostrar a legenda (da transcrição)"} atalho="C" ativo={pref.legendas} slot="player-legendas"
              aoClicar={() => setPref((a: unknown) => { const p = normalizarPref(a); return { ...p, legendas: !p.legendas }; })}>
              {pref.legendas ? <Captions /> : <CaptionsOff className="opacity-60" />}
            </Botao>
          )}
          <div className="group/volume flex items-center">
            <Botao dica={pref.mudo ? "Ligar o som" : "Mudo"} atalho="M" aoClicar={() => setPref((a: unknown) => { const p = normalizarPref(a); return { ...p, mudo: !p.mudo, volume: p.mudo && p.volume === 0 ? 0.5 : p.volume }; })}><IconeVolume /></Botao>
            <div className="w-0 overflow-hidden transition-[width] duration-200 group-focus-within/volume:w-20 group-hover/volume:w-20">
              <Slider aria-label="Volume" min={0} max={100} step={5} value={[pref.mudo ? 0 : Math.round(pref.volume * 100)]} onValueChange={([v]) => mudarVolume(v / 100)}
                className="mx-1.5 w-[68px] [&_[data-orientation=horizontal]>span]:bg-white [&>span:first-child]:bg-white/30 [&_[role=slider]]:size-3 [&_[role=slider]]:border-white [&_[role=slider]]:bg-white" />
            </div>
          </div>
          {!somenteAudio && typeof document !== "undefined" && document.pictureInPictureEnabled && (
            <Botao dica="Janela flutuante" aoClicar={() => { if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {}); else void video.current?.requestPictureInPicture?.().catch(() => {}); }}><PictureInPicture2 /></Botao>
          )}
          <Botao dica={cheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F" aoClicar={alternarTelaCheia}>{cheia ? <Minimize /> : <Maximize />}</Botao>
        </div>
      </div>
    </div>
  );
}
