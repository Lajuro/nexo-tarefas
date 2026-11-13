"use client";

// Aba Pessoas: cadastradas (com times, categorias, com o que ajudam) e, abaixo, os nomes que
// apareceram nos registros mas ainda não têm cadastro (cadastrar ou juntar como apelido).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  HandHelping, Hourglass, Import, Merge, SearchX, UserRoundPlus, Users,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { AvatarPessoa, CatTag, Destaque, PontoCor, Secao, Vazio, Pagina } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CampoSwitch, Segmentado } from "@/components/ui/controles";
import { Badge } from "@/components/ui/diversos";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { itemLista, lista as cascata, mola } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { type EntradaPessoa, plural } from "@/lib/pessoas";
import { usePref } from "@/lib/preferencias";
import { type Categoria, type Pessoa, formatarData, semAcento } from "@/lib/tipos";
import { ImportarPessoas } from "./ImportarPessoas";
import { PessoaForm } from "./PessoaForm";
import { AbasPessoas } from "./AbasPessoas";
import {
  BotaoMenu, EtiquetaTime, MenuContexto, acoesDaPessoa, cargoArea, hrefPessoa, pessoasParecidas, porNome, primeiraLinha, useAcoesPessoa,
} from "./pecas";

type Ordem = "contato" | "nome" | "pendencias";

const COLUNAS = "grid grid-cols-[minmax(0,8fr)_minmax(0,5fr)_6.5rem_6.5rem_1.75rem] items-center gap-4 px-4";

function textoDaEntrada(e: EntradaPessoa) {
  const p = e.pessoa;
  return semAcento([e.nome, ...(p ? [...p.apelidos, p.cargo, p.area, p.ajudaCom, p.email, ...p.tags] : [])].join(" "));
}

function ordenar(lista: EntradaPessoa[], ordem: Ordem) {
  const porContato = (a: EntradaPessoa, b: EntradaPessoa) => (b.ultimoContato ?? "").localeCompare(a.ultimoContato ?? "") || porNome(a, b);
  const comparar =
    ordem === "nome" ? porNome
      : ordem === "pendencias" ? (a: EntradaPessoa, b: EntradaPessoa) => b.passosAbertos.length - a.passosAbertos.length || porContato(a, b)
        : porContato;
  return [...lista].sort(comparar);
}

export function ListaPessoas({ diretorio, totalTimes }: { diretorio: EntradaPessoa[]; totalTimes: number }) {
  const { dados } = useNexo();
  const router = useRouter();
  const acoes = useAcoesPessoa();
  const [busca, setBusca] = useState("");
  const [timeId, setTimeId] = useState("");
  const [catId, setCatId] = useState("");
  const [ordem, setOrdem, carregado] = usePref<Ordem>("pessoas-ordem", "contato");
  const [mostrarArquivadas, setMostrarArquivadas] = usePref("pessoas-arquivadas", false);
  const [form, setForm] = useState<{ pessoa?: Pessoa; nomeInicial?: string } | null>(null);
  const [importar, setImportar] = useState(false);

  const categorias = dados!.categorias.items;
  const times = dados!.times.items;
  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const cadastradas = useMemo(() => diretorio.filter((e) => e.cadastrada), [diretorio]);
  const ativas = cadastradas.filter((e) => !e.pessoa!.arquivada);
  const arquivadas = cadastradas.length - ativas.length;
  const soltos = useMemo(() => diretorio.filter((e) => !e.cadastrada), [diretorio]);

  const termo = semAcento(busca.trim());
  const bateTexto = (e: EntradaPessoa) => !termo || termo.split(/\s+/).every((t) => textoDaEntrada(e).includes(t));
  const filtroEstrutural = Boolean(timeId || catId);

  const lista = useMemo(() => {
    const base = cadastradas.filter((e) => mostrarArquivadas || !e.pessoa!.arquivada);
    const filtradas = base.filter((e) => {
      if (!bateTexto(e)) return false;
      if (timeId && !e.times.some((t) => t.id === timeId)) return false;
      if (catId) {
        const direto = e.pessoa!.categoriaIds.includes(catId);
        const porTime = e.times.some((t) => !t.arquivado && t.categoriaIds.includes(catId));
        if (!direto && !porTime) return false;
      }
      return true;
    });
    return ordenar(filtradas, ordem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastradas, mostrarArquivadas, termo, timeId, catId, ordem]);

  const soltosVisiveis = useMemo(
    () => (filtroEstrutural ? [] : ordenar(soltos.filter(bateTexto), ordem === "nome" ? "nome" : ordem)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [soltos, termo, filtroEstrutural, ordem],
  );

  const filtrando = Boolean(termo || filtroEstrutural);
  const limpar = () => { setBusca(""); setTimeId(""); setCatId(""); };
  const nada = cadastradas.length === 0 && soltos.length === 0;

  return (
    <Pagina
      titulo="Pessoas"
      descricao="Quem é quem, com o que cada um pode ajudar, de que time faz parte e o que ficou com cada um."
      acoes={
        <>
          <Button variant="outline" onClick={() => setImportar(true)}><Import /> Importar do Outlook</Button>
          <Button onClick={() => setForm({})}><UserRoundPlus /> Nova pessoa</Button>
        </>
      }
      barra={
        <>
          <AbasPessoas aba="pessoas" pessoas={ativas.length} times={totalTimes} />
          {!nada && (
            <>
              <CampoBusca
                valor={busca}
                aoMudar={setBusca}
                placeholder="Nome, cargo, área, ajuda..."
                aria-label="Buscar pessoas"
                className="w-64 max-w-full"
              />
              <Combobox
                aria-label="Filtrar por time"
                valor={timeId}
                aoMudar={setTimeId}
                placeholder="Todos os times"
                rotuloLimpar="Todos os times"
                buscaPlaceholder="Buscar time..."
                className="w-44"
                opcoes={[...times].sort(porNome).map((t) => ({
                  valor: t.id, rotulo: t.nome,
                  render: <><PontoCor cor={t.cor} /><span className="truncate">{t.nome}</span></>,
                }))}
              />
              <Combobox
                aria-label="Filtrar por categoria"
                valor={catId}
                aoMudar={setCatId}
                placeholder="Todas as categorias"
                rotuloLimpar="Todas as categorias"
                buscaPlaceholder="Buscar categoria..."
                className="w-48"
                opcoes={categorias.map((c) => ({
                  valor: c.id, rotulo: c.nome,
                  render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></>,
                }))}
              />
              <Segmentado
                aria-label="Ordenar por"
                tamanho="sm"
                valor={ordem}
                aoMudar={setOrdem}
                opcoes={[
                  { valor: "contato", rotulo: "Último contato" },
                  { valor: "nome", rotulo: "Nome" },
                  { valor: "pendencias", rotulo: "Pendências" },
                ]}
              />
              <span className="ml-auto flex items-center gap-3">
                {arquivadas > 0 && (
                  <CampoSwitch marcado={mostrarArquivadas} aoMudar={setMostrarArquivadas} className="[&_label]:text-xs">
                    Mostrar arquivadas ({arquivadas})
                  </CampoSwitch>
                )}
                <span data-slot="contagem" className="text-xs text-muted-foreground tabular-nums sem-selecao">
                  {filtrando ? `${lista.length} de ${ativas.length}` : plural(ativas.length, "cadastrada", "cadastradas")}
                </span>
              </span>
            </>
          )}
        </>
      }
    >
      {nada ? (
        <Vazio titulo="Ninguém por aqui ainda" icone={<Users />}>
          <p>
            Cadastre as pessoas com quem você trabalha para lembrar com o que cada uma pode ajudar e de que time faz parte.
            Os nomes que aparecerem nos registros também surgem aqui sozinhos.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setImportar(true)}><Import /> Importar do Outlook</Button>
            <Button onClick={() => setForm({})}><UserRoundPlus /> Nova pessoa</Button>
          </div>
        </Vazio>
      ) : (
        carregado && (
          <>
            {cadastradas.length === 0 ? (
              <Vazio compacto titulo="Nenhuma pessoa cadastrada ainda" icone={<UserRoundPlus />}>
                <p>Comece pelos nomes abaixo, que já apareceram nos seus registros, ou traga os contatos do Outlook.</p>
                <Button variant="outline" onClick={() => setImportar(true)}><Import /> Importar do Outlook</Button>
              </Vazio>
            ) : lista.length === 0 ? (
              <Vazio compacto titulo="Ninguém encontrado" icone={<SearchX />}>
                <p>Nenhuma pessoa cadastrada bate com {filtroEstrutural ? "esses filtros" : "essa busca"}. A busca olha nome, apelidos, cargo, área, e-mail, tags e com o que ajuda.</p>
                <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
              </Vazio>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
                <div className={`${COLUNAS} h-8 border-b bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sem-selecao`}>
                  <span>Pessoa</span>
                  <span>Times e categorias</span>
                  <span>Com ela</span>
                  <span className="text-right">Último contato</span>
                  <span />
                </div>
                <motion.div variants={cascata} initial="escondido" animate="visivel">
                  {lista.map((e) => (
                    <LinhaPessoa
                      key={e.chave}
                      e={e}
                      termo={busca.trim()}
                      catPorId={catPorId}
                      acoes={acoesDaPessoa(e.pessoa!, {
                        abrir: () => router.push(hrefPessoa(e.nome)),
                        editar: () => setForm({ pessoa: e.pessoa }),
                        arquivar: (v) => acoes.arquivar(e.pessoa!, v),
                        remover: () => acoes.remover(e.pessoa!),
                      })}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {soltosVisiveis.length > 0 && (
              <Secao
                titulo="Nomes sem cadastro"
                contagem={soltosVisiveis.length}
                icone={<Users />}
                acoes={<span className="text-[11px] text-muted-foreground">Apareceram nos registros, mas ainda não têm cadastro</span>}
              >
                <motion.div
                  data-slot="nomes-soltos"
                  variants={cascata}
                  initial="escondido"
                  animate="visivel"
                  className="overflow-hidden rounded-xl border border-dashed bg-card/50"
                >
                  {soltosVisiveis.map((e) => (
                    <LinhaSolta
                      key={e.chave}
                      e={e}
                      termo={busca.trim()}
                      pessoas={ativas.map((a) => a.pessoa!)}
                      cadastrar={() => setForm({ nomeInicial: e.nome })}
                      juntar={(p) => acoes.juntarComoApelido(e.nome, p)}
                    />
                  ))}
                </motion.div>
              </Secao>
            )}
          </>
        )
      )}

      <PessoaForm
        aberto={!!form}
        fechar={() => setForm(null)}
        pessoa={form?.pessoa}
        nomeInicial={form?.nomeInicial}
      />
      <ImportarPessoas aberto={importar} fechar={() => setImportar(false)} />
    </Pagina>
  );
}

function LinhaPessoa({
  e, termo, catPorId, acoes,
}: {
  e: EntradaPessoa; termo: string; catPorId: Map<string, Categoria>; acoes: ReturnType<typeof acoesDaPessoa>;
}) {
  const p = e.pessoa!;
  const sub = cargoArea(p);
  const ajuda = primeiraLinha(p.ajudaCom);
  const cats = p.categoriaIds.map((id) => catPorId.get(id)).filter((c): c is Categoria => !!c);
  const responsavel = new Set(e.responsavelDe.map((t) => t.id));
  const timesOrdenados = [...e.times].sort((a, b) => Number(responsavel.has(b.id)) - Number(responsavel.has(a.id)) || porNome(a, b));
  const abertos = e.passosAbertos.length;

  return (
    <MenuContexto acoes={acoes}>
      <motion.div
        data-slot="pessoa"
        data-nome={e.nome}
        data-arquivada={p.arquivada || undefined}
        data-pendencias={abertos}
        variants={itemLista}
        layout="position"
        transition={{ layout: mola }}
        className={`${COLUNAS} group/pessoa relative border-b py-3 transition-colors last:border-0 focus-within:bg-muted/40 hover:bg-muted/40 data-[state=open]:bg-muted/40`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <AvatarPessoa nome={p.nome} tamanho="lg" className={`size-10 text-[13px] ${p.arquivada ? "opacity-50 grayscale" : ""}`} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={hrefPessoa(e.nome)}
                className="truncate rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/35"
              >
                <Destaque texto={p.nome} termo={termo} />
              </Link>
              {p.arquivada && <Badge variant="outline">Arquivada</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {sub ? <Destaque texto={sub} termo={termo} /> : <span className="text-muted-foreground/60">Sem cargo nem área</span>}
            </div>
            {ajuda && (
              <div data-slot="ajuda" className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-foreground/80">
                <HandHelping className="size-3.5 shrink-0 text-primary" />
                <span className="truncate"><Destaque texto={ajuda} termo={termo} /></span>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {timesOrdenados.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-1">
              {timesOrdenados.slice(0, 3).map((t) => <EtiquetaTime key={t.id} time={t} responsavel={responsavel.has(t.id)} comLink />)}
              {timesOrdenados.length > 3 && <span className="self-center text-[11px] text-muted-foreground">+{timesOrdenados.length - 3}</span>}
            </div>
          )}
          {cats.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
              {cats.slice(0, 3).map((c) => <CatTag key={c.id} cat={c} className="max-w-full text-[11px] font-normal" />)}
              {cats.length > 3 && <span className="text-[11px] text-muted-foreground">+{cats.length - 3}</span>}
            </div>
          )}
          {!timesOrdenados.length && !cats.length && <span className="text-[11px] text-muted-foreground/60">Sem time nem categoria</span>}
        </div>

        <span>
          {abertos > 0 ? (
            <Badge variant="alerta"><Hourglass /> {plural(abertos, "passo", "passos")}</Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">Nada pendente</span>
          )}
        </span>

        <UltimoContato data={e.ultimoContato} />

        <BotaoMenu acoes={acoes} rotulo={`Ações de ${p.nome}`} className="opacity-60 group-hover/pessoa:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" />
      </motion.div>
    </MenuContexto>
  );
}

function UltimoContato({ data }: { data: string | null }) {
  return (
    <span className="text-right">
      {data ? (
        <>
          <span className="block text-[13px]">{dataRelativa(data)}</span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">{formatarData(data)}</span>
        </>
      ) : (
        <span className="text-[11px] text-muted-foreground/70">Sem registro</span>
      )}
    </span>
  );
}

const COLUNAS_SOLTO = "grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_auto] items-center gap-4 px-4";

function LinhaSolta({
  e, termo, pessoas, cadastrar, juntar,
}: {
  e: EntradaPessoa; termo: string; pessoas: Pessoa[]; cadastrar: () => void; juntar: (p: Pessoa) => Promise<boolean>;
}) {
  const parecidas = useMemo(() => pessoasParecidas(e.nome, pessoas), [e.nome, pessoas]);
  const sugestao = parecidas[0];
  const abertos = e.passosAbertos.length;
  return (
    <motion.div
      data-slot="nome-solto"
      data-nome={e.nome}
      variants={itemLista}
      layout="position"
      className={`${COLUNAS_SOLTO} group/solto relative border-b border-dashed py-2 transition-colors last:border-0 hover:bg-muted/40`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AvatarPessoa nome={e.nome} className="opacity-80" />
        <div className="min-w-0">
          <Link
            href={hrefPessoa(e.nome)}
            className="block truncate rounded-sm text-[13px] font-medium text-foreground/90 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <Destaque texto={e.nome} termo={termo} />
          </Link>
          <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
            {e.registros.length
              ? `${plural(e.registros.length, "registro", "registros")} em ${plural(new Set(e.registros.map((x) => x.tarefa.id)).size, "tarefa", "tarefas")}`
              : "Só como responsável por passos"}
          </span>
        </div>
      </div>
      <span>
        {abertos > 0
          ? <Badge variant="alerta"><Hourglass /> {plural(abertos, "passo", "passos")}</Badge>
          : <span className="text-[11px] text-muted-foreground/70">Nada pendente</span>}
      </span>
      <UltimoContato data={e.ultimoContato} />
      <div className="relative z-10 flex items-center justify-end gap-1">
        {sugestao && (
          <Dica texto={`Acrescentar “${e.nome}” como apelido de ${sugestao.nome}`}>
            <Button variant="ghost" size="sm" data-slot="juntar-sugerido" onClick={() => juntar(sugestao)}>
              <Merge /> É {sugestao.nome}?
            </Button>
          </Dica>
        )}
        <JuntarComo nome={e.nome} pessoas={pessoas} parecidas={parecidas} juntar={juntar} />
        <Button variant="outline" size="sm" onClick={cadastrar}><UserRoundPlus /> Cadastrar</Button>
      </div>
    </motion.div>
  );
}

/** Popover para escolher de quem esse nome solto é apelido. */
export function JuntarComo({
  nome, pessoas, parecidas, juntar, rotulo,
}: {
  nome: string; pessoas: Pessoa[]; parecidas: Pessoa[]; juntar: (p: Pessoa) => Promise<boolean>;
  /** Com rótulo vira botão com texto; sem, só o ícone. */
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const outras = [...pessoas].filter((p) => !parecidas.some((x) => x.id === p.id)).sort(porNome);
  if (!pessoas.length) return null;
  const item = (p: Pessoa) => (
    <CommandItem key={p.id} value={`${p.nome} ${p.id}`} keywords={[...p.apelidos, p.area]} onSelect={async () => { setAberto(false); await juntar(p); }}>
      <AvatarPessoa nome={p.nome} tamanho="sm" />
      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
      {cargoArea(p) && <span className="max-w-[45%] truncate text-[11px] text-muted-foreground">{cargoArea(p)}</span>}
    </CommandItem>
  );
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto={`Juntar “${nome}” como apelido de alguém`}>
        <PopoverTrigger asChild>
          {rotulo ? (
            <Button variant="outline" data-slot="juntar-como"><Merge /> {rotulo}</Button>
          ) : (
            <Button variant="ghost" size="icon-sm" aria-label={`Juntar “${nome}” como apelido de alguém`} data-slot="juntar-como"><Merge /></Button>
          )}
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          “{nome}” vira apelido da pessoa escolhida e os registros com esse nome passam a contar para ela.
        </div>
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Ninguém com esse nome.</CommandEmpty>
            {parecidas.length > 0 && <CommandGroup heading="Parecidas">{parecidas.map(item)}</CommandGroup>}
            {outras.length > 0 && <CommandGroup heading={parecidas.length ? "Outras pessoas" : undefined}>{outras.map(item)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
