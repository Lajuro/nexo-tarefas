"use client";

// Visor de imagem (3.14.1): clicar numa imagem do texto abre a imagem por cima do app, em vez de trocar a tela
// inteira por ela. Fechar (Esc, o X ou um clique fora) devolve o usuário exatamente aonde estava: mesma tela,
// mesma rolagem, foco de volta na imagem. Montado uma vez no Shell e aberto por evento, de qualquer lugar.
//
// Dentro do visor: setas trocam entre as imagens do mesmo texto, + e - aproximam e afastam, 0 volta a ajustar
// à janela, um clique na imagem alterna entre ajustar e o tamanho real. Dá para baixar e abrir em outra aba.
// Só mostra anexo do próprio app (lib/visor.ts): nenhum endereço de fora é carregado.

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dica } from "@/components/ui/popover";
import { ESCALAS, type ImagemDoVisor, ehNomeDeImagem, ehUrlDeAnexo, imagensValidas, indiceVizinho, proximaEscala, urlParaBaixar } from "@/lib/visor";
import { cn } from "@/lib/utils";

const EVENTO = "nexo:imagem";

interface Pedido {
  lista: ImagemDoVisor[];
  indice: number;
}

/**
 * Abre o visor. `origem` é o elemento clicado: as outras imagens do mesmo texto entram na lista, para as
 * setas passarem de uma para a outra. Devolve false (e não faz nada) se o endereço não é um anexo do app.
 */
export function abrirImagem(url: string, alt = "", origem?: Element | null): boolean {
  if (!ehUrlDeAnexo(url)) return false;
  let lista: ImagemDoVisor[] = [{ url, alt }];
  let indice = 0;
  const texto = origem?.closest(".prosa");
  if (texto) {
    // no leitor a imagem tem o endereço da rota de anexos; no editor também (o <img> aponta para a API local)
    const irmas = imagensValidas([...texto.querySelectorAll("img")].map((i) => ({ url: i.getAttribute("src"), alt: i.getAttribute("alt") ?? "" })));
    const onde = irmas.findIndex((i) => i.url === url);
    if (onde >= 0) {
      lista = irmas;
      indice = onde;
    }
  }
  window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { lista, indice } }));
  return true;
}

/**
 * Para pôr no onClick de um link que leva a um arquivo: se o arquivo é imagem, abre no visor em vez de sair
 * da tela. Com Ctrl, Shift ou o botão do meio, vale o comportamento do link (abrir em outra aba).
 */
export function aoClicarEmArquivo(e: React.MouseEvent, url: string, nome: string, titulo?: string) {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  if (!ehNomeDeImagem(nome) || !ehUrlDeAnexo(url)) return;
  e.preventDefault();
  abrirImagem(url, titulo || nome, e.currentTarget);
}

const BOTAO =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/85 outline-none transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4";

function Botao({ dica, atalho, children, ...props }: React.ComponentProps<"button"> & { dica: string; atalho?: string }) {
  return (
    <Dica texto={dica} atalho={atalho}>
      <button type="button" aria-label={dica} className={BOTAO} {...props}>{children}</button>
    </Dica>
  );
}

export function VisorDeImagem() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  /** null = ajustada à janela; número = em relação ao tamanho real (1 = 100%). */
  const [escala, setEscala] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ l: number; a: number } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  /** Quem estava com o foco quando o visor abriu (a imagem clicada, o editor): é para lá que o foco volta ao fechar. */
  const foco = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<Pedido>).detail;
      const lista = imagensValidas(d?.lista);
      if (!lista.length) return;
      foco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setEscala(null);
      setNatural(null);
      setFalhou(false);
      setPedido({ lista, indice: Math.min(Math.max(0, Number(d.indice) || 0), lista.length - 1) });
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const atual = pedido?.lista[pedido.indice] ?? null;
  const varias = (pedido?.lista.length ?? 0) > 1;

  const andar = useCallback((passo: 1 | -1) => {
    setPedido((p) => (p && p.lista.length > 1 ? { ...p, indice: indiceVizinho(p.indice, p.lista.length, passo) } : p));
    setEscala(null);
    setNatural(null);
    setFalhou(false);
  }, []);

  /** A escala em que a imagem está sendo desenhada agora (quando ajustada, sai da medida na tela). */
  const escalaNaTela = useCallback(() => {
    if (escala !== null) return escala;
    const el = img.current;
    return el && natural && natural.l > 0 ? el.getBoundingClientRect().width / natural.l : 1;
  }, [escala, natural]);

  const zoom = useCallback((sentido: 1 | -1) => setEscala(proximaEscala(escalaNaTela(), sentido)), [escalaNaTela]);
  const alternar = () => setEscala((e) => (e === null ? 1 : null));

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight") andar(1);
    else if (e.key === "ArrowLeft") andar(-1);
    else if (e.key === "+" || e.key === "=") zoom(1);
    else if (e.key === "-" || e.key === "_") zoom(-1);
    else if (e.key === "0") setEscala(null);
    else return;
    e.preventDefault();
  };

  const rotuloDaEscala = escala === null ? "Ajustada" : `${Math.round(escala * 100)}%`;
  const noMaximo = escala !== null && escala >= ESCALAS[ESCALAS.length - 1];
  const noMinimo = escala !== null && escala <= ESCALAS[0];

  return (
    <DialogPrimitive.Root open={!!atual} onOpenChange={(a) => { if (!a) setPedido(null); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-[3px] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-slot="visor-de-imagem"
          aria-describedby={undefined}
          onKeyDown={aoTeclar}
          // o foco vai para a janela, não para o primeiro botão: as teclas já valem e nenhuma dica aparece sozinha
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
          // o visor não tem um botão que o abre (vem por evento), então o Radix não sabe para onde devolver o foco: devolvemos nós
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (foco.current?.isConnected) foco.current.focus({ preventScroll: true });
            foco.current = null;
          }}
          className="fixed inset-0 z-50 flex flex-col outline-none duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DialogPrimitive.Title className="sr-only">{atual?.alt ? `Imagem: ${atual.alt}` : "Imagem"}</DialogPrimitive.Title>

          <header data-slot="visor-barra" className="flex h-12 shrink-0 items-center gap-1 bg-black/40 pr-2 pl-4 text-white sem-selecao">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {atual?.alt || "Imagem"}
              {varias && pedido && <span data-slot="visor-posicao" className="ml-2 font-normal text-white/65 tabular-nums">{pedido.indice + 1} de {pedido.lista.length}</span>}
            </p>
            <Botao dica="Afastar" atalho="-" disabled={noMinimo || falhou} onClick={() => zoom(-1)}><ZoomOut /></Botao>
            <Dica texto={escala === null ? "Ver no tamanho real" : "Ajustar à janela"} atalho={escala === null ? undefined : "0"}>
              <button type="button" data-slot="visor-escala" data-escala={escala ?? "ajustada"} disabled={falhou} onClick={alternar}
                className="inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-white/85 tabular-nums outline-none transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-35">
                {escala === null && <Maximize className="size-3.5" />}
                {rotuloDaEscala}
              </button>
            </Dica>
            <Botao dica="Aproximar" atalho="+" disabled={noMaximo || falhou} onClick={() => zoom(1)}><ZoomIn /></Botao>
            <span aria-hidden className="mx-1.5 h-5 w-px bg-white/20" />
            {atual && (
              <>
                <Dica texto="Baixar a imagem">
                  <a href={urlParaBaixar(atual.url)} aria-label="Baixar a imagem" data-slot="visor-baixar" className={BOTAO}><Download /></a>
                </Dica>
                <Dica texto="Abrir em outra aba">
                  <a href={atual.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir em outra aba" className={BOTAO}><ExternalLink /></a>
                </Dica>
              </>
            )}
            <span aria-hidden className="mx-1.5 h-5 w-px bg-white/20" />
            <Dica texto="Fechar" atalho="Esc">
              <DialogPrimitive.Close aria-label="Fechar" data-slot="visor-fechar" className={BOTAO}><X /></DialogPrimitive.Close>
            </Dica>
          </header>

          {/* clicar fora da imagem fecha; a imagem ajustada cabe inteira, a ampliada rola dentro desta área */}
          <div data-slot="visor-area" className="relative min-h-0 flex-1 overflow-auto"
            onClick={(e) => { if (!(e.target as HTMLElement).closest("img, button, a")) setPedido(null); }}>
            <div className={cn("flex min-h-full min-w-full p-6", escala === null ? "h-full items-center justify-center" : "w-max")}>
              {atual && !falhou && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={img}
                  key={atual.url}
                  src={atual.url}
                  alt={atual.alt}
                  draggable={false}
                  data-slot="visor-imagem"
                  onLoad={(e) => setNatural({ l: e.currentTarget.naturalWidth, a: e.currentTarget.naturalHeight })}
                  onError={() => setFalhou(true)}
                  onClick={alternar}
                  style={escala !== null && natural ? { width: Math.round(natural.l * escala), height: "auto" } : undefined}
                  className={cn(
                    "m-auto rounded-md bg-white/5 shadow-2xl sem-selecao",
                    escala === null ? "max-h-full max-w-full cursor-zoom-in object-contain" : "max-w-none cursor-zoom-out",
                  )}
                />
              )}
              {falhou && (
                <p role="status" className="m-auto max-w-sm rounded-lg bg-white/10 px-4 py-3 text-center text-[13px] text-white">
                  Não consegui abrir esta imagem. O arquivo pode ter saído da pasta de dados.
                </p>
              )}
            </div>
          </div>

          {varias && (
            <>
              <Dica texto="Imagem anterior" atalho="←">
                <button type="button" aria-label="Imagem anterior" data-slot="visor-anterior" onClick={() => andar(-1)}
                  className="absolute top-1/2 left-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white outline-none transition-colors hover:bg-black/75 focus-visible:ring-[3px] focus-visible:ring-white/50 [&_svg]:size-5">
                  <ChevronLeft />
                </button>
              </Dica>
              <Dica texto="Próxima imagem" atalho="→">
                <button type="button" aria-label="Próxima imagem" data-slot="visor-proxima" onClick={() => andar(1)}
                  className="absolute top-1/2 right-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white outline-none transition-colors hover:bg-black/75 focus-visible:ring-[3px] focus-visible:ring-white/50 [&_svg]:size-5">
                  <ChevronRight />
                </button>
              </Dica>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
