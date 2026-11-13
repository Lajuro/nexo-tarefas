"use client";

// Bloco de notas: folhas de texto livre, escritas sem escolher tarefa nem campo.
// Depois, "Organizar com o Copilot" transforma a folha em registros, tarefas e passos concluídos
// (com prévia e confirmação) e a folha é arquivada. Nada é apagado: excluir manda para a lixeira.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, NotebookPen, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { Contador, Pagina, Vazio } from "@/components/comum";
import { EditorNota } from "@/components/notas/EditorNota";
import { OrganizarNota } from "@/components/notas/OrganizarNota";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { dataLocal, dataRelativa } from "@/lib/lembretes";
import { apagarNotaPendente } from "@/lib/rascunhos";
import { Nota, agoraISO, formatarData, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Aba = "abertas" | "arquivadas";

const nomeDaFolha = (n: Nota) => n.titulo.trim() || n.texto.trim().split("\n")[0].slice(0, 80) || "Folha sem título";

export default function Notas() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados, salvarNotas, toast } = useNexo();
  const router = useRouter();
  const pedida = useSearchParams().get("n");
  const confirmar = useConfirmar();
  const [aba, setAba] = useState<Aba>("abertas");
  const [sel, setSel] = useState<string | null>(null);
  // Id reservado para a próxima folha em branco. Ela só passa a existir na pasta quando ganha texto.
  const [nova, setNova] = useState(() => novoId("n"));
  const [organizar, setOrganizar] = useState<Nota | null>(null);

  const notas = useMemo(() => dados?.notas?.items ?? [], [dados?.notas]);
  const abertas = useMemo(() => notas.filter((n) => !n.arquivadaEm).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)), [notas]);
  const arquivadas = useMemo(
    () => notas.filter((n) => n.arquivadaEm).sort((a, b) => (b.arquivadaEm ?? "").localeCompare(a.arquivadaEm ?? "")),
    [notas],
  );
  const lista = aba === "abertas" ? abertas : arquivadas;

  // /notas?n=<id> (link "abrir a folha original" na timeline): abre a folha na aba certa e limpa o endereço.
  useEffect(() => {
    if (!pedida || !dados) return;
    const n = notas.find((x) => x.id === pedida);
    if (n) {
      setAba(n.arquivadaEm ? "arquivadas" : "abertas");
      setSel(n.id);
    }
    router.replace("/notas");
  }, [pedida, dados, notas, router]);

  // Folha em tela: a escolhida, se ainda estiver nesta aba; senão a primeira (ou uma em branco).
  const idAtual = lista.some((n) => n.id === sel)
    ? sel!
    : aba === "abertas" ? (sel === nova ? nova : abertas[0]?.id ?? nova) : arquivadas[0]?.id ?? null;
  const atual = notas.find((n) => n.id === idAtual) ?? null;

  const novaFolha = () => {
    const id = novoId("n");
    setNova(id);
    setSel(id);
    setAba("abertas");
  };

  const arquivarFolha = async (id: string) => {
    const agora = agoraISO();
    if (await salvarNotas((items) => items.map((n) => (n.id === id ? { ...n, arquivadaEm: agora, atualizadaEm: agora } : n))))
      toast("Folha arquivada. Ela continua em Arquivadas.", "info");
  };
  const reabrir = async (id: string) => {
    if (await salvarNotas((items) => items.map((n) => (n.id === id ? { ...n, arquivadaEm: null, atualizadaEm: agoraISO() } : n)))) {
      setAba("abertas");
      setSel(id);
    }
  };
  const excluir = async (n: Nota) => {
    const ok = await confirmar({
      titulo: "Excluir esta folha?",
      descricao: `“${nomeDaFolha(n)}” sai do bloco de notas e vai para a lixeira da pasta de dados. O que ela já criou nas tarefas continua lá.`,
      confirmar: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    if (await salvarNotas((items) => items.filter((x) => x.id !== n.id))) {
      apagarNotaPendente(n.id);
      toast("Folha excluída (foi para a lixeira da pasta de dados).", "info");
    }
  };

  return (
    <>
      <Pagina
        semRolagem
        titulo="Notas"
        descricao="Escreva solto, sem escolher tarefa nem campo. Depois o Copilot organiza e você confere."
        acoes={<Button data-slot="nova-folha" onClick={novaFolha}><Plus /> Nova folha</Button>}
      >
        <div className="mx-auto flex h-full w-full max-w-[1360px] min-h-0">
          <aside data-slot="lista-notas" className="flex w-[280px] shrink-0 flex-col border-r">
            <div className="px-3 pt-4 pb-2">
              <Segmentado
                aria-label="Quais folhas mostrar"
                tamanho="sm"
                valor={aba}
                aoMudar={setAba}
                className="flex w-full [&>button]:flex-1"
                opcoes={[
                  { valor: "abertas", rotulo: `Abertas${abertas.length ? ` ${abertas.length}` : ""}` },
                  { valor: "arquivadas", rotulo: `Arquivadas${arquivadas.length ? ` ${arquivadas.length}` : ""}` },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {aba === "abertas" && idAtual === nova && !atual && (
                <div className="mb-1 rounded-lg bg-accent px-2.5 py-2 text-[13px] font-medium">Folha nova</div>
              )}
              {lista.map((n) => (
                <button key={n.id} type="button" data-slot="item-nota" data-ativa={n.id === idAtual || undefined} onClick={() => setSel(n.id)}
                  className={cn(
                    "mb-1 block w-full rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35",
                    n.id === idAtual && "bg-accent",
                  )}>
                  <span className="block truncate text-[13px] font-medium">{nomeDaFolha(n)}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {n.arquivadaEm ? `arquivada ${dataRelativa(n.arquivadaEm)}` : `criada ${dataRelativa(n.criadaEm)}`}
                    {!!n.gerou?.length && <Contador n={n.gerou.length} />}
                    {!!n.sobras && <TriangleAlert aria-label="Tem anotações que não foram encaixadas" className="size-3 text-alerta" />}
                  </span>
                </button>
              ))}
              {aba === "arquivadas" && arquivadas.length === 0 && (
                <p className="px-2.5 py-3 text-xs leading-snug text-muted-foreground">Folhas organizadas ou guardadas aparecem aqui, com o que cada uma criou.</p>
              )}
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {aba === "abertas" && idAtual && (
              <EditorNota key={idAtual} id={idAtual} nota={atual} aoOrganizar={setOrganizar} aoArquivar={arquivarFolha} aoExcluir={excluir} />
            )}
            {aba === "arquivadas" && !atual && (
              <div className="p-6">
                <Vazio titulo="Nenhuma folha arquivada" icone={<NotebookPen />}>
                  <p>Quando você organizar uma folha com o Copilot, ela vem para cá junto com a lista do que criou.</p>
                </Vazio>
              </div>
            )}
            {aba === "arquivadas" && atual && (
              <div data-slot="nota-arquivada" className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-4">
                  <h2 className="text-sm font-semibold tracking-tight">{nomeDaFolha(atual)}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Escrita em {formatarData(dataLocal(atual.criadaEm))} · arquivada em {formatarData(dataLocal(atual.arquivadaEm))}
                  </p>
                  {!!atual.gerou?.length && (
                    <div data-slot="frutos" className="mt-3 rounded-xl border bg-card px-3.5 py-3 shadow-xs">
                      <p className="text-xs font-medium sem-selecao">O que esta folha criou</p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {atual.gerou.map((f, i) => {
                          const existe = dados?.tarefas.some((t) => t.id === f.tarefaId);
                          return (
                            <li key={i} className="text-[13px] leading-snug">
                              {existe
                                ? <Link href={`/tarefas/${f.tarefaId}`} className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">{f.rotulo}</Link>
                                : <span className="text-muted-foreground">{f.rotulo} (tarefa não está mais na lista)</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {atual.sobras && (
                    <div data-slot="sobras-guardadas" className="mt-3 rounded-xl border border-alerta/40 bg-alerta/8 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-medium sem-selecao"><TriangleAlert className="size-3.5 text-alerta" /> Ficou de fora ao organizar</p>
                      <p className="mt-1 text-[13px] leading-snug texto-pre">{atual.sobras}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">A IA não encaixou este trecho em nenhuma tarefa. Para aproveitar, reabra a folha e organize de novo, ou registre à mão.</p>
                    </div>
                  )}
                  <p className="mt-4 text-xs font-medium text-muted-foreground sem-selecao">Texto original da folha</p>
                  <p className="mt-1 max-w-[80ch] text-sm leading-relaxed texto-pre">{atual.texto || "(folha sem texto)"}</p>
                </div>
                <footer className="flex items-center justify-end gap-2 px-6 py-3">
                  <Button variant="ghost" onClick={() => excluir(atual)}><Trash2 /> Excluir</Button>
                  <Button variant="outline" onClick={() => reabrir(atual.id)}><ArchiveRestore /> Reabrir folha</Button>
                </footer>
              </div>
            )}
          </section>
        </div>
      </Pagina>

      <OrganizarNota nota={organizar} fechar={() => setOrganizar(null)} />
    </>
  );
}
