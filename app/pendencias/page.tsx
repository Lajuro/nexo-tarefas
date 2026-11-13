"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CalendarDays, FilterX, ListTodo, PartyPopper, Search, Users, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Pagina, Vazio } from "@/components/comum";
import { GrupoPendencias } from "@/components/pendencias/GrupoPendencias";
import { PainelPrazos, PainelProgresso } from "@/components/pendencias/Lateral";
import { AGRUPAMENTOS, Agrupamento, Pendencia, agrupar, coletarPendencias, combinaComFiltro, faixaDoPasso } from "@/components/pendencias/agrupar";
import { Button } from "@/components/ui/button";
import { CampoSwitch, Segmentado } from "@/components/ui/controles";
import { Badge } from "@/components/ui/diversos";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { comPassoAlternado, comPrazoDoPasso } from "@/lib/acoes";
import { usePref } from "@/lib/preferencias";
import { Categoria } from "@/lib/tipos";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const resumir = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default function Pendencias() {
  const { dados, atualizarTarefa } = useNexo();
  const [agrupamento, setAgrupamento, prefCarregada] = usePref<Agrupamento>("agrupamentoPendencias", "tarefa");
  const [soMeus, setSoMeus] = usePref("soMeus", false);
  const [filtro, setFiltro] = useState("");
  // Passos recém-marcados: ficam na tela um instante (com o visto) antes de sair da lista.
  const [recentes, setRecentes] = useState<ReadonlySet<string>>(() => new Set());

  const modo: Agrupamento = AGRUPAMENTOS.includes(agrupamento) ? agrupamento : "tarefa";
  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados]);
  const categorias = useMemo(() => new Map<string, Categoria>((dados?.categorias.items ?? []).map((c) => [c.id, c])), [dados]);

  const todas = useMemo(() => coletarPendencias(tarefas, recentes), [tarefas, recentes]);
  const emAberto = useMemo(() => todas.filter((p) => !p.passo.feito), [todas]);
  const visiveis = useMemo(
    () => todas.filter((p) => (!soMeus || p.meu) && combinaComFiltro(p, filtro)),
    [todas, soMeus, filtro],
  );
  const grupos = useMemo(() => agrupar(visiveis, modo), [visiveis, modo]);

  const nVisiveis = visiveis.filter((p) => !p.passo.feito).length;
  const atrasados = visiveis.filter((p) => !p.passo.feito && faixaDoPasso(p.passo) === "atrasados").length;
  const paraHoje = visiveis.filter((p) => !p.passo.feito && faixaDoPasso(p.passo) === "hoje").length;
  const filtrando = soMeus || !!filtro.trim();

  const concluir = useCallback(
    async (p: Pendencia) => {
      const { tarefa, registro, passo } = p;
      setRecentes((s) => new Set(s).add(passo.id));
      const [salva] = await Promise.all([
        atualizarTarefa(tarefa.id, (t) => comPassoAlternado(t, registro.id, passo.id, true)),
        espera(420),
      ]);
      setRecentes((s) => {
        const n = new Set(s);
        n.delete(passo.id);
        return n;
      });
      if (!salva) return; // o Provider já avisou o erro e o passo continua na lista
      toast.success("Passo concluído", {
        description: resumir(passo.texto),
        duration: 6000,
        action: {
          label: "Desfazer",
          onClick: () => void atualizarTarefa(tarefa.id, (t) => comPassoAlternado(t, registro.id, passo.id, false)),
        },
      });
    },
    [atualizarTarefa],
  );

  const mudarPrazo = useCallback(
    (p: Pendencia, prazo: string | null) =>
      void atualizarTarefa(p.tarefa.id, (t) => comPrazoDoPasso(t, p.registro.id, p.passo.id, prazo)),
    [atualizarTarefa],
  );

  const limparFiltros = () => {
    setFiltro("");
    setSoMeus(false);
  };

  const pronto = !!dados && prefCarregada;

  return (
    <Pagina
      titulo="Pendências"
      descricao="Todos os próximos passos em aberto, de todas as tarefas. Bata o olho e vá marcando."
      barra={
        <>
          <Segmentado<Agrupamento>
            aria-label="Agrupar pendências"
            valor={modo}
            aoMudar={setAgrupamento}
            opcoes={[
              { valor: "tarefa", rotulo: "Por tarefa", icone: <ListTodo /> },
              { valor: "prazo", rotulo: "Por prazo", icone: <CalendarDays /> },
              { valor: "pessoa", rotulo: "Por pessoa", icone: <Users /> },
            ]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && filtro) { e.stopPropagation(); setFiltro(""); }
              }}
              placeholder="Filtrar pendências..."
              aria-label="Filtrar pendências por texto"
              className="w-56 pr-8 pl-8"
            />
            {filtro && (
              <button
                type="button"
                aria-label="Limpar filtro"
                onClick={() => setFiltro("")}
                className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <Dica texto="Mostra só os passos sem responsável ou atribuídos a “Eu”">
            <span className="inline-flex">
              <CampoSwitch marcado={soMeus} aoMudar={setSoMeus} className="pl-1">Só os meus</CampoSwitch>
            </span>
          </Dica>

          {pronto && (
            <div className="ml-auto flex items-center gap-2">
              {atrasados > 0 && <Badge variant="perigo">{atrasados} {atrasados === 1 ? "atrasado" : "atrasados"}</Badge>}
              {paraHoje > 0 && <Badge variant="alerta">{paraHoje} para hoje</Badge>}
              <span data-slot="total-pendencias" data-total={nVisiveis} className="text-xs text-muted-foreground tabular-nums sem-selecao">
                {filtrando && nVisiveis !== emAberto.length
                  ? `${nVisiveis} de ${emAberto.length} ${emAberto.length === 1 ? "passo" : "passos"}`
                  : `${nVisiveis} ${nVisiveis === 1 ? "passo em aberto" : "passos em aberto"}`}
              </span>
            </div>
          )}
        </>
      }
    >
      {pronto && (
        <div className="@container">
          <div className="grid items-start gap-x-6 gap-y-2 @[54rem]:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {grupos.length === 0 ? (
                  <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pb-4">
                    {emAberto.length === 0 ? (
                      <Vazio titulo="Nenhuma pendência em aberto" icone={<PartyPopper className="text-sucesso" />}>
                        <p>Tudo em dia. Quando um registro tiver próximos passos, eles aparecem aqui para você ir marcando.</p>
                      </Vazio>
                    ) : (
                      <Vazio titulo="Nada com esse filtro" icone={<FilterX />}>
                        <p>
                          {emAberto.length === 1 ? "Existe 1 passo em aberto" : `Existem ${emAberto.length} passos em aberto`}, mas nenhum combina com o que você pediu.
                        </p>
                        <Button variant="outline" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
                      </Vazio>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={modo}
                    data-slot="lista-pendencias"
                    data-agrupamento={modo}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.18 }}
                  >
                    <AnimatePresence initial={false}>
                      {grupos.map((g) => (
                        <GrupoPendencias
                          key={g.chave}
                          grupo={g}
                          modo={modo}
                          termo={filtro.trim()}
                          categorias={categorias}
                          recentes={recentes}
                          aoConcluir={concluir}
                          aoMudarPrazo={mudarPrazo}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <aside className="grid min-w-0 gap-4 @2xl:grid-cols-2 @[54rem]:sticky @[54rem]:top-0 @[54rem]:grid-cols-1">
              <PainelProgresso tarefas={tarefas} emAberto={emAberto.length} />
              <PainelPrazos tarefas={tarefas} categorias={categorias} />
            </aside>
          </div>
        </div>
      )}
    </Pagina>
  );
}
