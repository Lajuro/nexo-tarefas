"use client";

// Ajuda desta tela (3.22): o painel que abre com a tecla ?, no lugar da antiga janela só de atalhos.
// Desliza pela direita e NÃO escurece o app, como o Personalizar: a graça é ler e usar a tela ao mesmo tempo.
// Mostra para que a tela serve, como usar em poucos passos, o que dá para "mostrar na tela" (o holofote),
// os atalhos desta tela, os atalhos gerais e um glossário curto. O conteúdo é de lib/ajuda.ts.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Kbd } from "@/components/ui/diversos";
import { GLOSSARIO, ajudaDaRota } from "@/lib/ajuda";
import { mostrarOnde } from "./Holofote";
import { ATALHOS } from "./navegacao";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-tight sem-selecao">{titulo}</h3>
      {children}
    </section>
  );
}

function ListaDeAtalhos({ atalhos }: { atalhos: { teclas: string[]; descricao: string }[] }) {
  return (
    <ul className="flex flex-col">
      {atalhos.map((a) => (
        <li key={a.descricao} className="flex items-center justify-between gap-4 border-b py-1.5 text-[13px] last:border-0">
          <span className="min-w-0">{a.descricao}</span>
          <span className="flex shrink-0 items-center gap-1">
            {a.teclas.map((t, i) => (
              <span key={t + i} className="flex items-center gap-1">
                {i > 0 && a.teclas[0] === "G" && <span className="text-xs text-muted-foreground">depois</span>}
                <Kbd>{t}</Kbd>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Ajuda({ aberta, fechar }: { aberta: boolean; fechar: () => void }) {
  const pathname = usePathname();
  const ajuda = ajudaDaRota(pathname);

  // Em tela larga o app encolhe para o painel caber ao lado (app/globals.css), como no Personalizar.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ajudando", aberta);
    return () => document.documentElement.removeAttribute("data-ajudando");
  }, [aberta]);

  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={(a) => !a && fechar()} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          data-slot="ajuda"
          data-rota={ajuda.rota}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className="fixed inset-y-0 right-0 z-40 flex w-[384px] max-w-[calc(100vw-3rem)] flex-col border-l bg-popover text-popover-foreground shadow-2xl outline-none duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-8 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-8"
        >
          <header className="flex shrink-0 items-start gap-2 border-b px-4 pt-3.5 pb-3 pr-11">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[15px] leading-tight font-semibold tracking-tight">Ajuda: {ajuda.titulo}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-snug text-muted-foreground">{ajuda.paraQue}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label="Fechar"
              className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>
          <div key={ajuda.rota} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 animate-in duration-200 fade-in-0 slide-in-from-bottom-1">
            <Secao titulo="Como usar">
              <ol data-slot="ajuda-como" className="flex flex-col gap-2">
                {ajuda.como.map((passo, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-snug">
                    <span aria-hidden className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0">{passo}</span>
                  </li>
                ))}
              </ol>
            </Secao>

            {ajuda.mostrar.length > 0 && (
              <Secao titulo="Mostrar na tela">
                <div data-slot="ajuda-mostrar" className="flex flex-wrap gap-1.5">
                  {ajuda.mostrar.map((m) => (
                    <Button key={m.rotulo} variant="outline" size="sm" onClick={() => mostrarOnde(m.alvo)}><Crosshair /> {m.rotulo}</Button>
                  ))}
                </div>
              </Secao>
            )}

            {ajuda.atalhos.length > 0 && (
              <Secao titulo="Atalhos desta tela">
                <ListaDeAtalhos atalhos={ajuda.atalhos} />
              </Secao>
            )}

            <Secao titulo="Atalhos de qualquer tela">
              <div data-slot="ajuda-atalhos"><ListaDeAtalhos atalhos={ATALHOS} /></div>
            </Secao>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-slot="ajuda-glossario" className="-ml-2 self-start">As palavras do Nexo</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <dl className="mt-2 flex flex-col gap-2.5">
                  {GLOSSARIO.map((g) => (
                    <div key={g.termo} className="text-[13px] leading-snug">
                      <dt className="font-medium">{g.termo}</dt>
                      <dd className="text-muted-foreground">{g.explicacao}</dd>
                    </div>
                  ))}
                </dl>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">A tecla <Kbd>?</Kbd> abre esta ajuda em qualquer tela.</span>
            <Button size="sm" onClick={fechar}>Fechar</Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
