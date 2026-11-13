"use client";

// Tela "Hoje": o lugar onde o dia começa. Mostra o foco escolhido, o que precisa de atenção,
// a semana que vem pela frente e o que já andou, sem precisar abrir tarefa por tarefa.

import { useMemo } from "react";
import { motion } from "motion/react";
import { Ban, CalendarX2, Hourglass, ListChecks, ListTodo, Plus, Sunrise, Target } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { abrirNovaTarefa, abrirPlanejarDia } from "@/components/Shell";
import { useLembretes } from "@/components/useLembretes";
import { Estatistica, Pagina, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/diversos";
import { CapturaRapida } from "@/components/hoje/CapturaRapida";
import { FocoHoje } from "@/components/hoje/FocoHoje";
import { AguardandoRetorno, BloqueadasEParadas, ProgressoDoDia } from "@/components/hoje/Laterais";
import { PrecisaDeVoce } from "@/components/hoje/PrecisaDeVoce";
import { Semana } from "@/components/hoje/Semana";
import { dataLonga, useAgora } from "@/components/hoje/apoio";
import { itemLista, lista } from "@/lib/animacoes";
import { passosAbertosDe, resumoDoDia, saudacao } from "@/lib/lembretes";
import { hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export default function Hoje() {
  const { dados } = useNexo();
  const agora = useAgora();
  const hoje = hojeISO();
  const lembretesDoDia = useLembretes();

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = dados?.categorias.items ?? [];
  // `hoje` entra nas dependências para a tela se refazer sozinha quando vira o dia com o app aberto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resumo = useMemo(() => resumoDoDia(tarefas), [tarefas, hoje]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pendencias = useMemo(() => passosAbertosDe(tarefas).length, [tarefas, hoje]);

  const pedemAtencao = lembretesDoDia.lembretes.filter((l) => l.gravidade !== "info").length;
  const temCritico = lembretesDoDia.criticos > 0;
  const fraseDoDia =
    pedemAtencao === 0 ? "Tudo em dia" : pedemAtencao === 1 ? "1 coisa pede sua atenção hoje" : `${pedemAtencao} coisas pedem sua atenção hoje`;

  const acoes = (
    <>
      <Button variant="outline" onClick={() => abrirNovaTarefa()}>
        <Plus /> Nova tarefa <Kbd>N</Kbd>
      </Button>
      <Button onClick={() => abrirPlanejarDia()} data-acao="planejar-o-dia">
        <Sunrise /> Planejar o dia <Kbd className="border-white/20 bg-white/15 text-white">D</Kbd>
      </Button>
    </>
  );

  if (tarefas.length === 0) {
    return (
      <Pagina titulo={saudacao(agora)} descricao={dataLonga(hoje)} acoes={acoes}>
        <CapturaRapida />
        <Vazio titulo="Seu dia começa aqui" icone={<Sunrise />} className="mt-4">
          <p>
            Cadastre a primeira tarefa e o Nexo passa a lembrar você de prazos, pendências e retornos todos os dias.
            Para algo rápido, basta anotar no campo acima e apertar Enter.
          </p>
          <Button onClick={() => abrirNovaTarefa()}>
            <Plus /> Criar a primeira tarefa
          </Button>
        </Vazio>
      </Pagina>
    );
  }

  return (
    <Pagina
      titulo={saudacao(agora)}
      descricao={
        <span className="inline-flex max-w-full items-center gap-2">
          <span className="truncate">{dataLonga(hoje)}</span>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span data-slot="frase-do-dia" className={cn("inline-flex shrink-0 items-center gap-1.5 font-medium", pedemAtencao ? "text-foreground" : "text-sucesso")}>
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", pedemAtencao === 0 ? "bg-sucesso" : temCritico ? "animate-pulso-suave bg-destructive" : "bg-alerta")}
            />
            {fraseDoDia}
          </span>
        </span>
      }
      acoes={acoes}
    >
      <motion.div data-slot="hoje" variants={lista} initial="escondido" animate="visivel" className="@container flex flex-col gap-4">
        <motion.div variants={itemLista} className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          <Estatistica rotulo="Tarefas abertas" valor={resumo.totalAbertas} icone={<ListTodo />} href="/tarefas" />
          <Estatistica rotulo="Atrasadas" valor={resumo.atrasadas.length} icone={<CalendarX2 />} tom="perigo" href="/tarefas?f=atrasadas" />
          <Estatistica rotulo="Pendências" valor={pendencias} icone={<ListChecks />} tom="primario" href="/pendencias" />
          <Estatistica
            rotulo="Em foco hoje"
            valor={resumo.focos.length}
            icone={<Target />}
            tom="primario"
            aoClicar={() => document.getElementById("foco-hoje")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
        </motion.div>

        <motion.div variants={itemLista}>
          <CapturaRapida />
        </motion.div>

        <div className="mt-3 grid gap-x-6 gap-y-8 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <motion.div variants={itemLista}>
              <FocoHoje focos={resumo.focos} tarefas={tarefas} categorias={categorias} />
            </motion.div>
            <motion.div variants={itemLista}>
              <PrecisaDeVoce {...lembretesDoDia} />
            </motion.div>
          </div>

          <aside className="grid min-w-0 content-start items-start gap-4 @xl:grid-cols-2 @5xl:grid-cols-1">
            <motion.div variants={itemLista} className="min-w-0 @xl:col-span-2 @5xl:col-span-1">
              <ProgressoDoDia resumo={resumo} />
            </motion.div>
            <motion.div variants={itemLista} className="min-w-0">
              <AguardandoRetorno tarefas={resumo.aguardando} icone={<Hourglass />} />
            </motion.div>
            <motion.div variants={itemLista} className="min-w-0">
              <BloqueadasEParadas bloqueadas={resumo.bloqueadas} paradas={resumo.paradas} icone={<Ban />} />
            </motion.div>
          </aside>
        </div>

        <motion.div variants={itemLista} className="mt-4">
          <Semana hoje={hoje} tarefas={tarefas} categorias={categorias} />
        </motion.div>
      </motion.div>
    </Pagina>
  );
}
