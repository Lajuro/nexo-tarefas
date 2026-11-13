"use client";

// Aba Times: cartões com cor, responsáveis, membros, categorias e o que está em aberto com o time.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Crown, Hourglass, Import, ListTodo, Plus, SearchX, UsersRound } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { AvatarPessoa, CatTag, Destaque, Pagina, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { Badge } from "@/components/ui/diversos";
import { itemLista, lista as cascata } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { type EntradaPessoa, plural } from "@/lib/pessoas";
import { usePref } from "@/lib/preferencias";
import { type Categoria, type Time, semAcento } from "@/lib/tipos";
import { AbasPessoas } from "./AbasPessoas";
import { ImportarPessoas } from "./ImportarPessoas";
import { TimeForm } from "./TimeForm";
import {
  BotaoMenu, EmblemaTime, MenuContexto, PilhaAvatares, type ResumoTime, acoesDoTime, hrefPessoa, hrefTime, porNome, resumirTime, useAcoesTime,
} from "./pecas";

export function ListaTimes({ diretorio, totalPessoas }: { diretorio: EntradaPessoa[]; totalPessoas: number }) {
  const { dados } = useNexo();
  const router = useRouter();
  const acoes = useAcoesTime();
  const [busca, setBusca] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = usePref("times-arquivados", false);
  const [form, setForm] = useState<{ time?: Time } | null>(null);
  const [importar, setImportar] = useState(false);

  const times = dados!.times.items;
  const catPorId = useMemo(() => new Map(dados!.categorias.items.map((c) => [c.id, c])), [dados]);
  const ativos = times.filter((t) => !t.arquivado);
  const arquivados = times.length - ativos.length;

  const resumos = useMemo(() => {
    const termo = semAcento(busca.trim());
    return [...times]
      .filter((t) => mostrarArquivados || !t.arquivado)
      .sort((a, b) => Number(a.arquivado) - Number(b.arquivado) || porNome(a, b))
      .map((t) => resumirTime(t, diretorio, dados!))
      .filter((r) => {
        if (!termo) return true;
        const alvo = semAcento([r.time.nome, r.time.descricao, ...r.membros.map((m) => m.nome)].join(" "));
        return termo.split(/\s+/).every((x) => alvo.includes(x));
      });
  }, [times, mostrarArquivados, busca, diretorio, dados]);

  return (
    <Pagina
      titulo="Times"
      descricao="Grupos de pessoas, quem responde por cada um e de quais assuntos cuidam."
      acoes={
        <>
          <Button variant="outline" onClick={() => setImportar(true)}><Import /> Importar do Outlook</Button>
          <Button onClick={() => setForm({})}><Plus /> Novo time</Button>
        </>
      }
      barra={
        <>
          <AbasPessoas aba="times" pessoas={totalPessoas} times={ativos.length} />
          {times.length > 0 && (
            <>
              <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Time, descrição ou membro..." aria-label="Buscar times" className="w-64 max-w-full" />
              <span className="ml-auto flex items-center gap-3">
                {arquivados > 0 && (
                  <CampoSwitch marcado={mostrarArquivados} aoMudar={setMostrarArquivados} className="[&_label]:text-xs">
                    Mostrar arquivados ({arquivados})
                  </CampoSwitch>
                )}
                <span data-slot="contagem" className="text-xs text-muted-foreground tabular-nums sem-selecao">
                  {busca.trim() ? `${resumos.length} de ${ativos.length}` : plural(ativos.length, "time", "times")}
                </span>
              </span>
            </>
          )}
        </>
      }
    >
      {times.length === 0 ? (
        <Vazio titulo="Nenhum time ainda" icone={<UsersRound />}>
          <p>
            Monte os times com quem você conversa (um squad, a arquitetura, o pessoal de infraestrutura), diga quem responde por cada um
            e ligue aos assuntos de que cuidam.
          </p>
          <Button onClick={() => setForm({})}><Plus /> Novo time</Button>
        </Vazio>
      ) : resumos.length === 0 ? (
        <Vazio compacto titulo={busca.trim() ? "Nenhum time encontrado" : "Todos os times estão arquivados"} icone={<SearchX />}>
          {busca.trim()
            ? <Button variant="outline" onClick={() => setBusca("")}>Limpar busca</Button>
            : <Button variant="outline" onClick={() => setMostrarArquivados(true)}>Mostrar arquivados</Button>}
        </Vazio>
      ) : (
        <motion.div
          variants={cascata}
          initial="escondido"
          animate="visivel"
          className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]"
        >
          {resumos.map((r) => (
            <CartaoTime
              key={r.time.id}
              r={r}
              termo={busca.trim()}
              catPorId={catPorId}
              acoes={acoesDoTime(r.time, {
                abrir: () => router.push(hrefTime(r.time.id)),
                editar: () => setForm({ time: r.time }),
                arquivar: (v) => acoes.arquivar(r.time, v),
                remover: () => acoes.remover(r.time),
              })}
            />
          ))}
        </motion.div>
      )}

      <TimeForm aberto={!!form} fechar={() => setForm(null)} time={form?.time} />
      <ImportarPessoas aberto={importar} fechar={() => setImportar(false)} />
    </Pagina>
  );
}

function CartaoTime({
  r, termo, catPorId, acoes,
}: {
  r: ResumoTime; termo: string; catPorId: Map<string, Categoria>; acoes: ReturnType<typeof acoesDoTime>;
}) {
  const { time } = r;
  const cats = time.categoriaIds.map((id) => catPorId.get(id)).filter((c): c is Categoria => !!c);
  const membrosSemResp = r.membros.filter((m) => !time.responsavelIds.includes(m.pessoa!.id));
  const tarefasAbertas = r.tarefas.filter(aberta).length;
  return (
    <MenuContexto acoes={acoes}>
      <motion.article
        data-slot="time"
        data-nome={time.nome}
        data-arquivado={time.arquivado || undefined}
        variants={itemLista}
        className="group/time relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring/40 hover:border-ring/40 hover:shadow-sm data-[state=open]:border-ring/40"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: time.cor }} />
        <div className="flex items-start gap-3 px-4 pt-4">
          <EmblemaTime time={time} className={time.arquivado ? "opacity-60" : ""} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={hrefTime(time.id)}
                className="truncate rounded-sm text-sm font-semibold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/35"
              >
                <Destaque texto={time.nome} termo={termo} />
              </Link>
              {time.arquivado && <Badge variant="outline">Arquivado</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-2 min-h-[2lh] text-xs leading-snug text-muted-foreground">
              {time.descricao.trim() || <span className="text-muted-foreground/60">Sem descrição</span>}
            </p>
          </div>
          <BotaoMenu acoes={acoes} rotulo={`Ações do time ${time.nome}`} className="-mt-1 -mr-1.5 opacity-60 group-hover/time:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" />
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-3.5">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground sem-selecao">
              {r.responsaveis.length > 1 ? "Responsáveis" : "Responsável"}
            </div>
            {r.responsaveis.length ? (
              <div className="flex flex-wrap gap-1.5">
                {r.responsaveis.map((e) => (
                  <Link
                    key={e.chave}
                    href={hrefPessoa(e.nome)}
                    data-slot="responsavel"
                    className="relative z-10 inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-alerta/35 bg-alerta/8 pr-2.5 pl-0.5 text-xs font-medium transition-colors hover:border-alerta/60"
                  >
                    <AvatarPessoa nome={e.nome} />
                    <span className="truncate">{e.nome}</span>
                    <Crown className="size-3 shrink-0 text-alerta" />
                  </Link>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70">Ninguém definido</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {membrosSemResp.length > 0 && <PilhaAvatares nomes={membrosSemResp.map((m) => m.nome)} max={6} />}
            <span className="text-xs text-muted-foreground tabular-nums">
              {r.membros.length ? plural(r.membros.length, "membro", "membros") : "Sem membros"}
            </span>
          </div>

          {cats.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
              {cats.map((c) => <CatTag key={c.id} cat={c} className="max-w-full text-[11px] font-normal" />)}
            </div>
          )}
        </div>

        <footer className="mt-auto flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground tabular-nums">
          <span data-slot="passos-time" className={`inline-flex items-center gap-1 ${r.passos.length ? "font-medium text-alerta" : ""}`}>
            <Hourglass className="size-3" />
            {r.passos.length ? `${plural(r.passos.length, "passo", "passos")} em aberto` : "Nada pendente"}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListTodo className="size-3" />
            {plural(tarefasAbertas, "tarefa aberta", "tarefas abertas")}
          </span>
        </footer>
      </motion.article>
    </MenuContexto>
  );
}
