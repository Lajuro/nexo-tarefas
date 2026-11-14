"use client";

// Páginas de conhecimento: o que não é tarefa nem reunião, mas vale guardar (processos, passo a passo, contatos).
// Escritas no editor rico, podem citar tarefas, pessoas e outras páginas com "@", e mostram quem aponta para elas.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BookText, Plus, Search } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { Pagina, PontoCor, Vazio } from "@/components/comum";
import { EditorPagina } from "@/components/paginas/EditorPagina";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Input } from "@/components/ui/input";
import { dataRelativa } from "@/lib/lembretes";
import { apagarNotaPendente } from "@/lib/rascunhos";
import { paraTextoPlano } from "@/lib/texto-rico";
import { type Pagina as TipoPagina, agoraISO, novoId, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Aba = "ativas" | "arquivadas";
const nome = (p: TipoPagina) => p.titulo.trim() || paraTextoPlano(p.texto).split("\n")[0].slice(0, 80) || "Página sem título";

export default function Paginas() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados, salvarPaginas, toast } = useNexo();
  const router = useRouter();
  const params = useSearchParams();
  const pedida = params.get("p");
  const catPedida = params.get("cat");
  // categoria com que a próxima página nova nasce (vem de "Nova página deste assunto", na tela da categoria)
  const [catNova, setCatNova] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const [aba, setAba] = useState<Aba>("ativas");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  // Id reservado para a próxima página em branco: ela só passa a existir na pasta quando ganha texto.
  const [nova, setNova] = useState(() => ({ id: novoId("pg"), aberta: false }));

  const paginas = useMemo(() => dados?.paginas?.items ?? [], [dados?.paginas]);
  const cats = useMemo(() => new Map((dados?.categorias.items ?? []).map((c) => [c.id, c])), [dados?.categorias.items]);
  const lista = useMemo(() => {
    const q = semAcento(busca.trim());
    return paginas
      .filter((p) => (aba === "arquivadas" ? !!p.arquivadaEm : !p.arquivadaEm))
      .filter((p) => !q || semAcento(`${p.titulo} ${paraTextoPlano(p.texto)} ${cats.get(p.categoriaId ?? "")?.nome ?? ""}`).includes(q))
      .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
  }, [paginas, aba, busca, cats]);

  // /paginas?p=<id> (link interno ou citação): abre a página na aba certa. ?cat=<id> começa uma página nova naquele assunto.
  useEffect(() => {
    if (!dados) return;
    if (pedida) {
      const p = paginas.find((x) => x.id === pedida);
      if (p) {
        setAba(p.arquivadaEm ? "arquivadas" : "ativas");
        setSel(p.id);
        setNova((n) => ({ ...n, aberta: false }));
      }
      router.replace("/paginas");
    } else if (catPedida) {
      setCatNova(catPedida);
      setAba("ativas");
      setNova({ id: novoId("pg"), aberta: true });
      router.replace("/paginas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, catPedida, dados]);

  const idAtual = nova.aberta ? nova.id : lista.some((p) => p.id === sel) ? sel : lista[0]?.id ?? null;
  const atual = paginas.find((p) => p.id === idAtual) ?? null;
  // a página em branco acabou de ser gravada: passa a ser uma página como as outras
  useEffect(() => {
    if (nova.aberta && paginas.some((p) => p.id === nova.id)) {
      setSel(nova.id);
      setNova({ id: novoId("pg"), aberta: false });
    }
  }, [nova, paginas]);

  const novaPagina = () => {
    setAba("ativas");
    setBusca("");
    setCatNova(null);
    setNova({ id: novoId("pg"), aberta: true });
  };
  const arquivar = async (p: TipoPagina, sim: boolean) => {
    const agora = agoraISO();
    if (await salvarPaginas((items) => items.map((x) => (x.id === p.id ? { ...x, arquivadaEm: sim ? agora : null, atualizadaEm: agora } : x)))) {
      toast(sim ? "Página arquivada. Os links para ela continuam funcionando." : "Página de volta às ativas.", "info");
      if (!sim) {
        setAba("ativas");
        setSel(p.id);
      }
    }
  };
  const excluir = async (p: TipoPagina) => {
    const ok = await confirmar({
      titulo: "Excluir esta página?",
      descricao: `“${nome(p)}” vai para a lixeira da pasta de dados. Quem cita esta página fica com um link que não abre mais nada.`,
      confirmar: "Excluir",
      perigo: true,
    });
    if (ok && (await salvarPaginas((items) => items.filter((x) => x.id !== p.id)))) {
      apagarNotaPendente(p.id);
      toast("Página excluída (foi para a lixeira da pasta de dados).", "info");
    }
  };

  return (
    <Pagina
      semRolagem
      titulo="Páginas"
      descricao="O que vale guardar além das tarefas: processos, passo a passo, quem procurar. Cite tarefas e pessoas com @."
      acoes={<Button data-slot="nova-pagina" onClick={novaPagina}><Plus /> Nova página</Button>}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1480px]">
        <aside data-slot="lista-paginas" className="flex w-[280px] shrink-0 flex-col border-r">
          <div className="flex flex-col gap-2 px-3 pt-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas páginas" aria-label="Buscar nas páginas" className="pl-8" />
            </div>
            <Segmentado aria-label="Quais páginas mostrar" tamanho="sm" valor={aba} aoMudar={(a) => { setAba(a); setNova((n) => ({ ...n, aberta: false })); }} className="flex w-full [&>button]:flex-1"
              opcoes={[{ valor: "ativas", rotulo: "Ativas" }, { valor: "arquivadas", rotulo: "Arquivadas" }]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {nova.aberta && <div className="mb-1 rounded-lg bg-accent px-2.5 py-2 text-[13px] font-medium">Página nova</div>}
            {lista.map((p) => {
              const c = cats.get(p.categoriaId ?? "");
              return (
                <button key={p.id} type="button" data-slot="item-pagina" data-ativa={p.id === idAtual || undefined}
                  onClick={() => { setSel(p.id); setNova((n) => ({ ...n, aberta: false })); }}
                  className={cn(
                    "mb-1 block w-full rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35",
                    p.id === idAtual && "bg-accent",
                  )}>
                  <span className="block truncate text-[13px] font-medium">{nome(p)}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    {c && <span className="inline-flex min-w-0 items-center gap-1"><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></span>}
                    <span className="shrink-0">editada {dataRelativa(p.atualizadaEm)}</span>
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && !nova.aberta && (
              <p className="px-2.5 py-3 text-xs leading-snug text-muted-foreground">
                {busca ? "Nenhuma página com esse texto." : aba === "arquivadas" ? "Nenhuma página arquivada." : "Nenhuma página ainda."}
              </p>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {idAtual ? (
            <EditorPagina key={idAtual} id={idAtual} pagina={atual} categoriaInicial={nova.aberta ? catNova : null} aoArquivar={arquivar} aoExcluir={excluir} />
          ) : (
            <div className="p-6">
              <Vazio titulo="Seu conhecimento, num lugar só" icone={<BookText />}>
                <p className="max-w-[52ch]">
                  Uma página é para o que você explicaria de novo daqui a três meses: como funciona um processo, o passo a passo de um pedido, quem resolve o quê.
                  Dentro dela, digite @ para citar uma tarefa, uma pessoa ou outra página.
                </p>
                <Button className="mt-2" onClick={novaPagina}><Plus /> Criar a primeira página</Button>
              </Vazio>
            </div>
          )}
        </section>
      </div>
    </Pagina>
  );
}
