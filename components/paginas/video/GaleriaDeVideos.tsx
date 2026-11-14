"use client";

// Galeria das páginas de vídeo: a capa, a duração e o que cada vídeo já tem (transcrição, capítulos).

import { Clapperboard, ListVideo, Plus, ScrollText } from "lucide-react";
import { PontoCor, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { dataRelativa } from "@/lib/lembretes";
import { nomeDaPagina } from "@/lib/paginas";
import { urlDaImagem } from "@/lib/texto-rico";
import { formatarTempo } from "@/lib/transcricao";
import type { Categoria, Pagina } from "@/lib/tipos";
import { type AcoesDePagina, MenuContextoPagina } from "../pecas";

export function GaleriaDeVideos({ paginas, categorias, acoes, aoAbrir, aoNova }: { paginas: Pagina[]; categorias: Categoria[]; acoes: AcoesDePagina; aoAbrir: (id: string) => void; aoNova: () => void }) {
  const videos = paginas.filter((p) => p.tipo === "video" && !p.arquivadaEm).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
  const cats = new Map(categorias.map((c) => [c.id, c]));
  if (videos.length === 0) {
    return (
      <div className="p-6">
        <Vazio titulo="Nenhuma página de vídeo ainda" icone={<Clapperboard />}>
          <p className="max-w-[56ch]">
            Uma página de vídeo guarda a gravação de uma reunião ou de um treinamento com um player próprio, a transcrição que acompanha o que está sendo dito e as suas anotações, com o instante de cada uma.
          </p>
          <Button className="mt-2" onClick={aoNova}><Plus /> Nova página de vídeo</Button>
        </Vazio>
      </div>
    );
  }
  return (
    <div data-slot="galeria-de-videos" className="h-full overflow-y-auto p-4">
      <div className="mx-auto grid max-w-[1360px] gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((p) => {
          const v = p.video ?? {};
          const capa = v.capa ? urlDaImagem(`arquivos/${v.capa}`) : null;
          const cat = cats.get(p.categoriaId ?? "");
          return (
            <MenuContextoPagina key={p.id} pagina={p} acoes={acoes} aoAbrir={aoAbrir}>
              <button type="button" data-slot="cartao-de-video" data-id={p.id} onClick={() => aoAbrir(p.id)}
                className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-[border-color,box-shadow,transform] outline-none hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <div className="relative aspect-video w-full overflow-hidden bg-linear-to-br from-primary/25 via-muted to-muted">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-primary/60"><Clapperboard className="size-9" /></span>
                  )}
                  {v.duracao ? <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">{formatarTempo(v.duracao)}</span> : null}
                  {!v.arquivo && !v.caminho && <span className="absolute top-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">{v.url ? "link de fora" : "sem vídeo ainda"}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 px-3 py-2.5">
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium">{nomeDaPagina(p)}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                    {cat && <span className="inline-flex min-w-0 items-center gap-1"><PontoCor cor={cat.cor} /><span className="truncate">{cat.nome}</span></span>}
                    {v.transcricao && <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> transcrição</span>}
                    {(v.capitulos?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1"><ListVideo className="size-3" /> {v.capitulos?.length}</span>}
                    <span className="ml-auto shrink-0">{dataRelativa(p.atualizadaEm)}</span>
                  </span>
                </div>
              </button>
            </MenuContextoPagina>
          );
        })}
      </div>
    </div>
  );
}
