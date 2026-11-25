"use client";

// O lugar das tags (3.16): a aba "Tags" da tela de Categorias. Antes não havia onde ver quais tags existem, nem
// como consertar uma escrita de dois jeitos: a única saída era abrir item por item.
//
// Aqui: todas as tags do app com a contagem de uso, o que tem cada uma (tarefas, links, páginas, pessoas e
// modelos), e as três trocas em lote: renomear, juntar em outra e tirar de tudo. As tags que parecem a mesma
// (acento, plural, hífen) aparecem em cima, com "Juntar" a um clique.
//
// Nada de cadastro de tags: a tag continua sendo um texto dentro de cada item. Trocar é regravar os itens que
// a usam, cada um pela gravação normal (tarefa por tarefa, coleção por coleção, com rev). Toda troca tem
// desfazer, que devolve as tags de antes só nos itens que ninguém mexeu depois (lib/tags.ts, comPlano).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, LayoutTemplate, ListFilter, ListTodo, Merge, PencilLine, Tag, Tags, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { hrefLink } from "@/components/LinkForm";
import { pedirModelo } from "@/components/Modelos";
import { aoClicarEmArquivo } from "@/components/VisorDeArquivo";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { AvatarPessoa, Campo, Contador, IconeStatus, Painel, Vazio } from "@/components/comum";
import { oferecerDesfazer } from "@/components/desfazer";
import { IconeLink } from "@/components/links/IconeLink";
import { IconePagina } from "@/components/paginas/pecas";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { nomeDaPagina } from "@/lib/paginas";
import { usePref } from "@/lib/preferencias";
import {
  MAX_TAG, type OndeTemTag, type PlanoDeTags, type TagDoInventario, chaveDaTag, comPlano, inventarioDeTags, itensDaTag, limparTag,
  planoDaTroca, porId, resumoDeUso, tagsComOTexto, tagsParecidas, tamanhoDoPlano,
} from "@/lib/tags";
import { cn } from "@/lib/utils";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Grupos de tags parecidas que o usuário já disse que são diferentes (preferência: é gosto, não dado). */
function normalizarDispensadas(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 600).slice(0, 200) : [];
}
const chaveDoGrupo = (g: TagDoInventario[]) => g.map((t) => t.chave).sort().join("\u0001");

/** Grava uma troca de tag no app inteiro e oferece o desfazer. Devolve quantos itens mudaram. */
export function useTrocarTag() {
  const { dadosAtuais, atualizarTarefa, salvarLinks, salvarPaginas, salvarPessoas, salvarModelos, toast } = useNexo();

  const gravar = async (plano: PlanoDeTags, sentido: "ida" | "volta") => {
    let falhas = 0;
    const tarefas = porId(plano.tarefas);
    for (const m of plano.tarefas) if (!(await atualizarTarefa(m.id, (t) => comPlano(t, tarefas, sentido)))) falhas++;
    // cada coleção é gravada inteira, uma vez, só se tem algo a mudar
    const naColecao = <T extends { id: string; tags?: string[] }>(onde: Exclude<OndeTemTag, "tarefas">) => {
      const mapa = porId(plano[onde]);
      return (items: T[]) => items.map((x) => comPlano(x, mapa, sentido));
    };
    if (plano.links.length && !(await salvarLinks(naColecao("links")))) falhas++;
    if (plano.paginas.length && !(await salvarPaginas(naColecao("paginas")))) falhas++;
    if (plano.pessoas.length && !(await salvarPessoas(naColecao("pessoas")))) falhas++;
    if (plano.modelos.length && !(await salvarModelos(naColecao("modelos")))) falhas++;
    return falhas;
  };

  return async (de: string, para: string | null, texto: (n: number) => string): Promise<number> => {
    const plano = planoDaTroca(dadosAtuais(), de, para);
    const n = tamanhoDoPlano(plano);
    if (!n) return 0;
    const falhas = await gravar(plano, "ida");
    if (falhas) toast("Parte da troca não foi gravada. Confira a lista e tente de novo no que faltou.", "erro");
    oferecerDesfazer(texto(n), async () => {
      if (await gravar(plano, "volta")) toast("Parte não voltou: algum item mudou depois ou não pôde ser gravado.", "info");
    });
    return n;
  };
}

function LinhaDaTag({ tag, ativa, aoEscolher }: { tag: TagDoInventario; ativa: boolean; aoEscolher: () => void }) {
  return (
    <li>
      <button type="button" data-slot="tag-do-inventario" data-tag={tag.nome} aria-current={ativa || undefined} onClick={aoEscolher}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none transition-colors sem-selecao hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35",
          ativa && "bg-accent font-medium",
        )}>
        <Tag className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{tag.nome}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{resumoDeUso(tag.em)}</span>
        </span>
        <Contador n={tag.total} />
      </button>
    </li>
  );
}

function Grupo({ icone: Icone, titulo, n, children, naLista }: { icone: LucideIcon; titulo: string; n: number; children: React.ReactNode; naLista?: string }) {
  if (!n) return null;
  return (
    <section data-slot="itens-da-tag" data-onde={titulo}>
      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao">
        <Icone className="size-3.5" /> {titulo} <span className="font-normal tabular-nums">{n}</span>
        {/* a mesma lista, na tela dela, onde dá para ordenar, selecionar e agir em lote (3.17) */}
        {naLista && (
          <Link href={naLista} data-slot="ver-na-lista" className="ml-auto inline-flex items-center gap-1 rounded px-1 text-xs font-medium tracking-normal text-primary normal-case outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
            <ListFilter className="size-3.5" /> Ver na lista
          </Link>
        )}
      </h4>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

const ITEM = "flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35";

function DetalheDaTag({ tag, inventario, aoMudarNome }: { tag: TagDoInventario; inventario: TagDoInventario[]; aoMudarNome: (nome: string | null) => void }) {
  const { dados, estado } = useNexo();
  const confirmar = useConfirmar();
  const trocar = useTrocarTag();
  const [nome, setNome] = useState(tag.nome);
  const [fazendo, setFazendo] = useState(false);
  // O campo acompanha a grafia da tag nos dados, mas só enquanto a pessoa não mexeu nele: logo depois de um
  // "Juntar" os itens são regravados um por um e a grafia oscila, e o que acabou de ser digitado era apagado.
  // Trocar de tag recomeça o campo.
  const grafiaMostrada = useRef(tag.nome);
  useEffect(() => {
    setNome((atual) => (atual === grafiaMostrada.current ? tag.nome : atual));
    grafiaMostrada.current = tag.nome;
  }, [tag.nome]);
  useEffect(() => {
    setNome(tag.nome);
    grafiaMostrada.current = tag.nome;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag.chave]);

  const itens = useMemo(() => itensDaTag(dados, tag.chave), [dados, tag.chave]);
  const somenteLeitura = !!estado?.somenteLeitura;
  const limpo = limparTag(nome);
  const outra = limpo && chaveDaTag(limpo) !== tag.chave ? inventario.find((t) => t.chave === chaveDaTag(limpo)) : undefined;
  // dá para renomear se o nome mudou, ou se há mais de uma grafia para acertar ("Pipeline" e "pipeline")
  const mudou = !!limpo && (limpo !== tag.nome || tag.grafias.length > 1);
  const outras = inventario.filter((t) => t.chave !== tag.chave).map((t) => ({ valor: t.chave, rotulo: t.nome, detalhe: String(t.total) }));

  const renomear = async () => {
    if (!mudou || fazendo) return;
    if (outra) {
      const ok = await confirmar({
        titulo: `Juntar “${tag.nome}” em “${outra.nome}”?`,
        descricao: `Já existe a tag “${outra.nome}”. ${plural(tag.total, "item passa", "itens passam")} a usar essa, e “${tag.nome}” deixa de existir. Dá para desfazer logo em seguida.`,
        confirmar: "Juntar",
      });
      if (!ok) return;
    }
    setFazendo(true);
    const destino = outra ? outra.nome : limpo;
    const n = await trocar(tag.chave, destino, (q) => (outra ? `“${tag.nome}” juntada em “${destino}” (${plural(q, "item", "itens")}).` : `Tag renomeada para “${destino}” (${plural(q, "item", "itens")}).`));
    setFazendo(false);
    if (n) aoMudarNome(destino);
  };

  const juntarEm = async (chave: string) => {
    const alvo = inventario.find((t) => t.chave === chave);
    if (!alvo || fazendo) return;
    const ok = await confirmar({
      titulo: `Juntar “${tag.nome}” em “${alvo.nome}”?`,
      descricao: `${plural(tag.total, "item passa", "itens passam")} a usar “${alvo.nome}”, e “${tag.nome}” deixa de existir. Dá para desfazer logo em seguida.`,
      confirmar: "Juntar",
    });
    if (!ok) return;
    setFazendo(true);
    const n = await trocar(tag.chave, alvo.nome, (q) => `“${tag.nome}” juntada em “${alvo.nome}” (${plural(q, "item", "itens")}).`);
    setFazendo(false);
    if (n) aoMudarNome(alvo.nome);
  };

  const tirar = async () => {
    if (fazendo) return;
    const ok = await confirmar({
      titulo: `Tirar a tag “${tag.nome}” de tudo?`,
      descricao: `Ela sai de ${resumoDeUso(tag.em).replace(/ · /g, ", ")}. Os itens continuam onde estão, só perdem a tag. Dá para desfazer logo em seguida.`,
      confirmar: "Tirar a tag",
      perigo: true,
    });
    if (!ok) return;
    setFazendo(true);
    const n = await trocar(tag.chave, null, (q) => `Tag “${tag.nome}” tirada de ${plural(q, "item", "itens")}.`);
    setFazendo(false);
    if (n) aoMudarNome(null);
  };

  return (
    <Painel
      className="min-w-0"
      icone={<Tag />}
      titulo={<span data-slot="tag-aberta" className="truncate">{tag.nome}</span>}
      contagem={tag.total}
      acoes={
        <Dica texto="Tira a tag de tudo o que a usa (os itens ficam)">
          <Button variant="destructive-ghost" size="sm" data-slot="tirar-tag" disabled={somenteLeitura || fazendo} onClick={tirar}><Trash2 /> Tirar de tudo</Button>
        </Dica>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome" dica={tag.grafias.length > 1 ? `Está escrita de ${tag.grafias.length} jeitos: ${tag.grafias.join(", ")}. Renomear deixa um só.` : undefined}>
            <div className="flex gap-1.5">
              <Input value={nome} maxLength={MAX_TAG} aria-label="Nome da tag" data-slot="nome-da-tag" disabled={somenteLeitura}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void renomear(); } }} />
              <Button variant="outline" data-slot="renomear-tag" disabled={!mudou || fazendo || somenteLeitura} onClick={renomear}>
                {outra ? <Merge /> : <PencilLine />} {outra ? "Juntar" : "Renomear"}
              </Button>
            </div>
          </Campo>
          <Campo rotulo="Juntar em outra tag" dica="Tudo o que usa esta passa a usar a outra.">
            <Combobox valor="" aoMudar={(v) => v && void juntarEm(v)} opcoes={outras} permitirLimpar={false}
              placeholder={outras.length ? "Escolher a tag que fica..." : "Não há outra tag"} buscaPlaceholder="Buscar tag..." vazio="Nenhuma tag com esse nome."
              aria-label="Juntar em outra tag" />
          </Campo>
        </div>
        {outra && (
          <p role="status" className="-mt-2 text-xs text-muted-foreground">
            Já existe a tag “{outra.nome}” ({resumoDeUso(outra.em)}): renomear vai juntar as duas.
          </p>
        )}

        <div className="flex flex-col gap-3 border-t pt-3">
          <Grupo icone={ListTodo} titulo="Tarefas" n={itens.tarefas.length} naLista={`/tarefas?status=todas&tag=${encodeURIComponent(tag.nome)}`}>
            {itens.tarefas.map((t) => (
              <li key={t.id}><Link href={`/tarefas/${t.id}`} className={ITEM}><IconeStatus status={t.status} /><span className="min-w-0 flex-1 truncate">{t.titulo}</span></Link></li>
            ))}
          </Grupo>
          <Grupo icone={FileText} titulo="Links e documentos" n={itens.links.length}>
            {itens.links.map((l) => (
              <li key={l.id}>
                <a href={hrefLink(l)} target="_blank" rel="noreferrer" className={ITEM}
                  onClick={l.tipo === "arquivo" ? (e) => aoClicarEmArquivo(e, hrefLink(l), l.nomeArquivo || l.arquivo || "", l.titulo) : undefined}>
                  <IconeLink link={l} className="size-5" /><span className="min-w-0 flex-1 truncate">{l.titulo}</span>
                </a>
              </li>
            ))}
          </Grupo>
          <Grupo icone={FileText} titulo="Páginas" n={itens.paginas.length} naLista={`/paginas?tag=${encodeURIComponent(tag.nome)}`}>
            {itens.paginas.map((p) => (
              <li key={p.id}>
                <Link href={`/paginas?p=${p.id}`} className={ITEM}>
                  <IconePagina pagina={p} className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{nomeDaPagina(p)}</span>
                  {p.arquivadaEm && <span className="shrink-0 text-xs text-muted-foreground">arquivada</span>}
                </Link>
              </li>
            ))}
          </Grupo>
          <Grupo icone={UserRound} titulo="Pessoas" n={itens.pessoas.length}>
            {itens.pessoas.map((p) => (
              <li key={p.id}><Link href={`/pessoas?p=${encodeURIComponent(p.nome)}`} className={ITEM}><AvatarPessoa nome={p.nome} tamanho="sm" /><span className="min-w-0 flex-1 truncate">{p.nome}</span></Link></li>
            ))}
          </Grupo>
          <Grupo icone={LayoutTemplate} titulo="Modelos de tarefa" n={itens.modelos.length}>
            {itens.modelos.map((m) => (
              <li key={m.id}><button type="button" className={ITEM} onClick={() => pedirModelo({ modeloId: m.id })}><LayoutTemplate className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{m.nome}</span></button></li>
            ))}
          </Grupo>
        </div>
      </div>
    </Painel>
  );
}

/** A aba "Tags" da tela de Categorias. `aberta` é a tag do endereço (?tag=). */
export function GerenciarTags({ aberta }: { aberta: string | null }) {
  const { dados, estado } = useNexo();
  const router = useRouter();
  const confirmar = useConfirmar();
  const trocar = useTrocarTag();
  const [busca, setBusca] = useState("");
  const [bruto, setDispensadas] = usePref<unknown>("tagsDiferentes", []);
  const dispensadas = useMemo(() => normalizarDispensadas(bruto), [bruto]);

  const inventario = useMemo(() => inventarioDeTags(dados), [dados]);
  const visiveis = useMemo(() => tagsComOTexto(inventario, busca), [inventario, busca]);
  const parecidas = useMemo(() => tagsParecidas(inventario).filter((g) => !dispensadas.includes(chaveDoGrupo(g))), [inventario, dispensadas]);
  const atual = inventario.find((t) => t.chave === chaveDaTag(aberta ?? "")) ?? null;
  const somenteLeitura = !!estado?.somenteLeitura;

  const abrir = (nome: string | null) => router.replace(nome ? `/categorias?aba=tags&tag=${encodeURIComponent(nome)}` : "/categorias?aba=tags", { scroll: false });

  const juntarGrupo = async (grupo: TagDoInventario[]) => {
    const [fica, ...saem] = grupo;
    const ok = await confirmar({
      titulo: `Juntar em “${fica.nome}”?`,
      descricao: `${saem.map((t) => `“${t.nome}”`).join(" e ")} ${saem.length === 1 ? "deixa" : "deixam"} de existir: tudo passa a usar “${fica.nome}”. Dá para desfazer logo em seguida.`,
      confirmar: "Juntar",
    });
    if (!ok) return;
    for (const t of saem) await trocar(t.chave, fica.nome, (q) => `“${t.nome}” juntada em “${fica.nome}” (${plural(q, "item", "itens")}).`);
    abrir(fica.nome);
  };

  if (inventario.length === 0)
    return (
      <Vazio titulo="Nenhuma tag ainda" icone={<Tags />}>
        <p>
          Tag é uma etiqueta livre que atravessa as categorias, como “auditoria” ou “urgente”. Ela nasce quando você
          escreve uma no campo Tags de uma tarefa, de um link, de uma página, de uma pessoa ou de um modelo, e passa a aparecer aqui.
        </p>
      </Vazio>
    );

  return (
    <div data-slot="gerenciar-tags" className="flex flex-col gap-4">
      {parecidas.length > 0 && (
        <Painel icone={<Merge />} titulo="Parecem a mesma tag" contagem={parecidas.length} corpoClassName="flex flex-col gap-2">
          {parecidas.slice(0, 6).map((g) => (
            <div key={chaveDoGrupo(g)} data-slot="tags-parecidas" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {g.map((t) => (
                  <button key={t.chave} type="button" onClick={() => abrir(t.nome)}
                    className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    {t.nome} <span className="font-normal text-muted-foreground tabular-nums">{t.total}</span>
                  </button>
                ))}
              </span>
              <Button variant="outline" size="sm" data-slot="juntar-parecidas" disabled={somenteLeitura} onClick={() => void juntarGrupo(g)}><Merge /> Juntar em “{g[0].nome}”</Button>
              <Button variant="ghost" size="sm" onClick={() => setDispensadas([...dispensadas, chaveDoGrupo(g)].slice(-200))}>São diferentes</Button>
            </div>
          ))}
          {parecidas.length > 6 && <p className="text-xs text-muted-foreground">E mais {parecidas.length - 6}. Aparecem conforme você resolve estas.</p>}
        </Painel>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <Painel icone={<Tags />} titulo="Todas as tags" contagem={inventario.length} corpoClassName="p-2">
          <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar tag..." aria-label="Buscar tag" className="mb-2" />
          {visiveis.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-muted-foreground">Nenhuma tag com esse nome.</p>
          ) : (
            <ul data-slot="lista-de-tags" className="flex max-h-[min(34rem,60vh)] flex-col gap-px overflow-y-auto">
              {visiveis.map((t) => <LinhaDaTag key={t.chave} tag={t} ativa={t.chave === atual?.chave} aoEscolher={() => abrir(t.nome)} />)}
            </ul>
          )}
        </Painel>

        {atual ? (
          <DetalheDaTag key={atual.chave} tag={atual} inventario={inventario} aoMudarNome={abrir} />
        ) : (
          <Vazio compacto titulo="Escolha uma tag" icone={<Tag />}>
            <p>À esquerda estão todas as tags do app, da mais usada para a menos. Abra uma para ver o que tem ela, renomear, juntar em outra ou tirar de tudo.</p>
          </Vazio>
        )}
      </div>
    </div>
  );
}
