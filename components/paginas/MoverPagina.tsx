"use client";

// "Mover para dentro de outra página...": para levar uma página longe na árvore sem arrastar pela tela inteira.
// A lista mostra a árvore com recuo (para saber onde cada uma fica), a raiz no topo, e não oferece a própria
// página nem as que estão dentro dela. Escolher já move (para o fim da escolhida) e o aviso tem Desfazer.
// Aberta por pedirMoverPagina(id) (components/paginas/pecas.tsx), de qualquer menu de página.

import { useEffect, useMemo, useState } from "react";
import { CornerDownRight, House } from "lucide-react";
import { Modal } from "@/components/comum";
import { useNexo } from "@/components/Provider";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, filtroSemAcento } from "@/components/ui/command";
import { descendentes, emOrdemDeLeitura, montarArvore, nomeDaPagina, posicaoNaArvore } from "@/lib/paginas";
import { type AcoesDePagina, IconePagina } from "./pecas";

export function JanelaMoverPagina({ acoes }: { acoes: AcoesDePagina }) {
  const { dados } = useNexo();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => setId(String((e as CustomEvent<string>).detail || "") || null);
    window.addEventListener("nexo:mover-pagina", abrir);
    return () => window.removeEventListener("nexo:mover-pagina", abrir);
  }, []);

  const paginas = useMemo(() => dados?.paginas?.items ?? [], [dados?.paginas?.items]);
  const pagina = id ? paginas.find((p) => p.id === id && !p.arquivadaEm) : undefined;
  const ativas = useMemo(() => paginas.filter((p) => !p.arquivadaEm), [paginas]);
  const maeAtual = pagina ? posicaoNaArvore(paginas, pagina.id)?.mae ?? null : null;
  const opcoes = useMemo(() => {
    if (!pagina) return [];
    const fora = new Set([pagina.id, ...descendentes(ativas, pagina.id)]);
    return emOrdemDeLeitura(montarArvore(ativas)).filter((n) => !fora.has(n.pagina.id));
  }, [pagina, ativas]);

  const fechar = () => setId(null);
  const escolher = async (mae: string | null) => {
    if (!pagina) return;
    fechar();
    await acoes.mover(pagina.id, mae);
  };

  return (
    <Modal
      titulo="Mover para dentro de outra página"
      descricao={pagina ? `“${nomeDaPagina(pagina)}” vai para o fim da página escolhida, com o que estiver dentro dela.` : undefined}
      aberto={!!pagina}
      fechar={fechar}
    >
      {/* a busca olha só o nome (o valor de cada item é o id, para dois nomes iguais não virarem uma opção só) */}
      <Command data-slot="mover-pagina" className="rounded-lg border" filter={(_v, busca, palavras) => filtroSemAcento("", busca, palavras)}>
        <CommandInput placeholder="Buscar a página de destino..." autoFocus />
        <CommandList className="max-h-[min(52vh,420px)]">
          <CommandEmpty>Nenhuma página com esse nome.</CommandEmpty>
          {maeAtual !== null && (
            <CommandGroup>
              <CommandItem value="__raiz__" keywords={["raiz", "fora de todas as páginas"]} data-destino="raiz" onSelect={() => void escolher(null)}>
                <House className="text-muted-foreground" /> Raiz <span className="text-xs text-muted-foreground">(fora de todas as páginas)</span>
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Páginas">
            {opcoes.map((n) => {
              const atual = n.pagina.id === maeAtual;
              return (
                <CommandItem
                  key={n.pagina.id}
                  value={n.pagina.id}
                  keywords={[nomeDaPagina(n.pagina)]}
                  data-destino={n.pagina.id}
                  disabled={atual}
                  onSelect={() => void escolher(n.pagina.id)}
                  style={{ paddingLeft: 8 + n.nivel * 16 }}
                >
                  {n.nivel > 0 && <CornerDownRight className="size-3 text-muted-foreground/80" />}
                  <IconePagina pagina={n.pagina} temFilhas={n.filhos.length > 0} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{nomeDaPagina(n.pagina)}</span>
                  {atual && <span className="text-xs text-muted-foreground">onde está agora</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </Modal>
  );
}
