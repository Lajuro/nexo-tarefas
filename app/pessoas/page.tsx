"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Hourglass, SearchX, UserRoundX, Users } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { DetalhePessoa } from "@/components/pessoas/DetalhePessoa";
import { OrdemPessoas, Pessoa, chavePessoa, montarPessoas, ordenarPessoas, plural } from "@/components/pessoas/dados";
import { AvatarPessoa, IconeStatus, Pagina, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Badge } from "@/components/ui/diversos";
import { itemLista, lista as cascata, mola } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { formatarData, semAcento } from "@/lib/tipos";

export default function Pessoas() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const sel = useSearchParams().get("p");
  const pessoas = useMemo(() => montarPessoas(dados!.tarefas), [dados]);

  if (sel !== null) {
    const atual = pessoas.find((p) => p.chave === chavePessoa(sel));
    if (atual) return <DetalhePessoa key={atual.chave} pessoa={atual} />;
    return (
      <Pagina titulo="Pessoa não encontrada" voltar={{ href: "/pessoas", rotulo: "Pessoas" }}>
        <Vazio titulo={sel.trim() ? `Não achei ninguém chamado “${sel.trim()}”` : "Faltou dizer quem você procura"} icone={<UserRoundX />}>
          <p>O nome pode ter sido corrigido em algum registro. A lista completa mostra todo mundo que já apareceu.</p>
          <Button asChild variant="outline"><Link href="/pessoas"><Users /> Ver todas as pessoas</Link></Button>
        </Vazio>
      </Pagina>
    );
  }
  return <ListaPessoas pessoas={pessoas} />;
}

const COLUNAS = "grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)_7.5rem_6.5rem_1rem] items-center gap-4 px-4";

function ListaPessoas({ pessoas }: { pessoas: Pessoa[] }) {
  const [filtro, setFiltro] = useState("");
  const [ordem, setOrdem, carregado] = usePref<OrdemPessoas>("pessoas-ordem", "contato");

  const lista = useMemo(() => {
    const n = semAcento(filtro.trim());
    return ordenarPessoas(pessoas.filter((p) => !n || p.chave.includes(n)), ordem);
  }, [pessoas, filtro, ordem]);

  const comPendencia = pessoas.filter((p) => p.abertos > 0).length;

  return (
    <Pagina
      titulo="Pessoas"
      descricao="Quem apareceu nas suas reuniões e registros, o que vocês conversaram e o que ficou com cada um."
      barra={
        pessoas.length > 0 && (
          <>
            <CampoBusca valor={filtro} aoMudar={setFiltro} placeholder="Filtrar por nome..." aria-label="Filtrar por nome" className="w-64 max-w-full" />
            <span className="ml-1 text-xs text-muted-foreground sem-selecao">Ordenar por</span>
            <Segmentado
              aria-label="Ordenar por"
              valor={ordem}
              aoMudar={setOrdem}
              opcoes={[
                { valor: "contato", rotulo: "Último contato" },
                { valor: "nome", rotulo: "Nome" },
                { valor: "pendencias", rotulo: "Pendências" },
              ]}
            />
            <span data-slot="contagem" className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
              {filtro.trim() ? `${lista.length} de ${pessoas.length}` : plural(pessoas.length, "pessoa", "pessoas")}
              {comPendencia > 0 && !filtro.trim() && ` · ${comPendencia} com algo em aberto`}
            </span>
          </>
        )
      }
    >
      {pessoas.length === 0 ? (
        <Vazio titulo="Ninguém por aqui ainda" icone={<Users />}>
          <p>Os participantes dos registros e os responsáveis pelos próximos passos aparecem aqui sozinhos, conforme você alimenta as tarefas.</p>
        </Vazio>
      ) : lista.length === 0 ? (
        <Vazio titulo="Ninguém com esse nome" icone={<SearchX />}>
          <p>Confira a grafia ou procure só por um pedaço do nome.</p>
          <Button variant="outline" onClick={() => setFiltro("")}>Limpar filtro</Button>
        </Vazio>
      ) : (
        carregado && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className={`${COLUNAS} h-8 border-b bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sem-selecao`}>
              <span>Pessoa</span>
              <span>Tarefas em que aparece</span>
              <span>Com ela</span>
              <span className="text-right">Último contato</span>
              <span />
            </div>
            <motion.div variants={cascata} initial="escondido" animate="visivel">
              {lista.map((p) => <LinhaPessoa key={p.chave} p={p} />)}
            </motion.div>
          </div>
        )
      )}
    </Pagina>
  );
}

function LinhaPessoa({ p }: { p: Pessoa }) {
  const mostradas = p.tarefas.slice(0, 3);
  const resto = p.tarefas.length - mostradas.length;
  return (
    <motion.div
      data-slot="pessoa"
      data-nome={p.nome}
      data-pendencias={p.abertos}
      variants={itemLista}
      layout="position"
      transition={{ layout: mola }}
      className="border-b last:border-0"
    >
      <Link
        href={`/pessoas?p=${encodeURIComponent(p.nome)}`}
        className={`${COLUNAS} group/pessoa py-3 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-inset`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <AvatarPessoa nome={p.nome} tamanho="lg" className="size-10 text-[13px]" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{p.nome}</span>
            <span className="block truncate text-xs text-muted-foreground tabular-nums">
              {p.regs.length
                ? `${plural(p.regs.length, "registro", "registros")} em ${plural(new Set(p.regs.map((x) => x.t.id)).size, "tarefa", "tarefas")}`
                : "Só como responsável por passos"}
            </span>
          </span>
        </span>

        <span className="flex min-w-0 flex-col gap-1">
          {mostradas.map((t) => (
            <span key={t.id} className="flex min-w-0 items-center gap-1.5 text-xs">
              <IconeStatus status={t.status} className="size-3" />
              <span className="truncate">{t.titulo}</span>
            </span>
          ))}
          {resto > 0 && <span className="pl-[18px] text-[11px] text-muted-foreground">e mais {resto}</span>}
        </span>

        <span>
          {p.abertos > 0 ? (
            <Badge variant="alerta"><Hourglass /> {plural(p.abertos, "passo", "passos")}</Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">Nada pendente</span>
          )}
        </span>

        <span className="text-right">
          {p.ultima ? (
            <>
              <span className="block text-[13px]">{dataRelativa(p.ultima)}</span>
              <span className="block text-[11px] text-muted-foreground tabular-nums">{formatarData(p.ultima)}</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">Sem registro</span>
          )}
        </span>

        <ChevronRight className="size-4 text-muted-foreground/50 transition-[color,transform] duration-150 group-hover/pessoa:translate-x-0.5 group-hover/pessoa:text-foreground" />
      </Link>
    </motion.div>
  );
}
