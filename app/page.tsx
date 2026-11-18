"use client";

// Tela "Hoje": o lugar onde o dia começa. Mostra o foco escolhido, o que precisa de atenção,
// a semana que vem pela frente e o que já andou, sem precisar abrir tarefa por tarefa.

import { type ReactNode, useMemo } from "react";
import { motion } from "motion/react";
import { Ban, ClipboardCopy, Hourglass, MoonStar, Plus, SlidersHorizontal, Sunrise } from "lucide-react";
import { CartaoDaRotina } from "@/components/jornada/Ferramenta";
import { useNexo } from "@/components/Provider";
import { abrirFecharDia, abrirNovaTarefa, abrirPlanejarDia } from "@/components/Shell";
import { useLembretes } from "@/components/useLembretes";
import { Pagina, Vazio, copiarTexto } from "@/components/comum";
import { Dica } from "@/components/ui/popover";
import { dailyDaManha } from "@/lib/fechamento";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/diversos";
import { CapturaRapida } from "@/components/hoje/CapturaRapida";
import { FocoHoje } from "@/components/hoje/FocoHoje";
import { AguardandoRetorno, BloqueadasEParadas, ProgressoDoDia } from "@/components/hoje/Laterais";
import { PrecisaDeVoce } from "@/components/hoje/PrecisaDeVoce";
import { Semana } from "@/components/hoje/Semana";
import { dataLonga, useAgora } from "@/components/hoje/apoio";
import { itemLista, lista } from "@/lib/animacoes";
import { resumoDoDia, saudacao } from "@/lib/lembretes";
import { abrirPersonalizar } from "@/lib/moldura";
import { type BlocoHoje, type LateralHoje, useTelaHoje } from "@/lib/tela-hoje";
import { hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export default function Hoje() {
  const { dados, toast } = useNexo();
  const agora = useAgora();
  const hoje = hojeISO();
  const lembretesDoDia = useLembretes();
  // A tela do jeito do usuário (Personalizar > Hoje): o que aparece, em que ordem e o nome na saudação.
  const { telaHoje } = useTelaHoje();
  const mostra = (id: BlocoHoje) => !telaHoje.ocultos.includes(id);
  const titulo = telaHoje.nome ? `${saudacao(agora)}, ${telaHoje.nome}` : saudacao(agora);

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = dados?.categorias.items ?? [];
  // `hoje` entra nas dependências para a tela se refazer sozinha quando vira o dia com o app aberto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resumo = useMemo(() => resumoDoDia(tarefas), [tarefas, hoje]);

  // Conta por tarefa (uma tarefa atrasada, com passo vencido e sem retorno é uma coisa só): é o mesmo
  // número do sino e do menu.
  const { pedemAtencao } = lembretesDoDia;
  const temCritico = lembretesDoDia.criticos > 0;
  const fraseDoDia =
    pedemAtencao === 0 ? "Tudo em dia" : pedemAtencao === 1 ? "1 tarefa pede sua atenção hoje" : `${pedemAtencao} tarefas pedem sua atenção hoje`;

  const copiarDaily = async () => {
    if (await copiarTexto(dailyDaManha({ tarefas }, hoje))) toast("Daily copiada: o que você fez no último dia, o que vai fazer hoje e os impedimentos.");
    else toast("Não consegui copiar automaticamente.", "erro");
  };

  // "Nova tarefa" já está na barra lateral, no atalho N e no campo de captura logo abaixo: aqui ficam os rituais do dia.
  const acoes = (
    <>
      {tarefas.length > 0 && (
        <Dica texto="Copia a daily: o que você fez no último dia de trabalho, o que vai fazer hoje e os impedimentos">
          <Button variant="ghost" size="icon" aria-label="Copiar daily" data-acao="copiar-daily" onClick={copiarDaily}><ClipboardCopy /></Button>
        </Dica>
      )}
      {tarefas.length > 0 && (
        <Dica texto="Fechar o dia: o que saiu, o que fica para amanhã e a daily (Shift D)">
          <Button variant="ghost" size="icon" aria-label="Fechar o dia" data-acao="fechar-o-dia" onClick={() => abrirFecharDia()}><MoonStar /></Button>
        </Dica>
      )}
      <Dica texto="Personalizar esta tela: o que aparece, a ordem e o seu nome na saudação">
        <Button variant="ghost" size="icon" aria-label="Personalizar a tela Hoje" data-acao="personalizar-hoje" onClick={() => abrirPersonalizar("hoje")}><SlidersHorizontal /></Button>
      </Dica>
      <Button onClick={() => abrirPlanejarDia()} data-acao="planejar-o-dia">
        <Sunrise /> Planejar o dia <Kbd className="border-white/25 bg-black/12 text-white">D</Kbd>
      </Button>
    </>
  );

  if (tarefas.length === 0) {
    return (
      <Pagina titulo={titulo} descricao={dataLonga(hoje)} acoes={acoes}>
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

  // Coluna principal: no automático, o que está estourando vem antes do que foi escolhido; com tudo em dia, o foco sobe.
  const precisaPrimeiro = telaHoje.primeiro === "auto" ? pedemAtencao > 0 : telaHoje.primeiro === "precisa";
  const principais = (precisaPrimeiro ? (["precisa", "foco"] as const) : (["foco", "precisa"] as const)).filter(mostra);
  const paineis: Record<LateralHoje, { largo: boolean; conteudo: ReactNode }> = {
    rotina: { largo: true, conteudo: <CartaoDaRotina /> },
    progresso: { largo: true, conteudo: <ProgressoDoDia resumo={resumo} /> },
    aguardando: { largo: false, conteudo: <AguardandoRetorno tarefas={resumo.aguardando} icone={<Hourglass />} /> },
    bloqueadas: { largo: false, conteudo: <BloqueadasEParadas bloqueadas={resumo.bloqueadas} paradas={resumo.paradas} icone={<Ban />} /> },
  };
  const laterais = telaHoje.laterais.filter(mostra);
  const duasColunas = principais.length > 0 && laterais.length > 0;
  const nadaAVista = principais.length === 0 && laterais.length === 0 && !mostra("captura") && !mostra("semana");

  return (
    <Pagina
      titulo={titulo}
      descricao={
        <span className="inline-flex max-w-full items-center gap-2">
          <span className="truncate">{dataLonga(hoje)}</span>
          <span aria-hidden className="text-muted-foreground/80">·</span>
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
        {mostra("captura") && (
          <motion.div variants={itemLista} data-bloco="captura">
            <CapturaRapida />
          </motion.div>
        )}

        {nadaAVista && (
          <Vazio titulo="Você escondeu todos os blocos desta tela" icone={<SlidersHorizontal />}>
            <p>Escolha o que quer ver aqui em Personalizar. Nada foi apagado: são só os blocos da tela.</p>
            <Button variant="outline" onClick={() => abrirPersonalizar("hoje")}>Escolher o que aparece</Button>
          </Vazio>
        )}

        {(principais.length > 0 || laterais.length > 0) && (
          <div className={cn("mt-2 grid gap-x-6 gap-y-8", duasColunas && "@5xl:grid-cols-[minmax(0,1fr)_20rem]")}>
            {principais.length > 0 && (
              <div className="flex min-w-0 flex-col gap-8">
                {principais.map((id) => (
                  <motion.div key={id} variants={itemLista} data-bloco={id}>
                    {id === "precisa" ? <PrecisaDeVoce {...lembretesDoDia} /> : <FocoHoje focos={resumo.focos} tarefas={tarefas} categorias={categorias} />}
                  </motion.div>
                ))}
              </div>
            )}

            {laterais.length > 0 && (
              // Sem a coluna principal, os painéis ocupam a largura toda, lado a lado.
              <aside className={cn("grid min-w-0 content-start items-start gap-4 @xl:grid-cols-2", duasColunas ? "@5xl:grid-cols-1" : "@5xl:grid-cols-3")}>
                {laterais.map((id) => (
                  <motion.div key={id} variants={itemLista} data-bloco={id}
                    className={cn("min-w-0", paineis[id].largo && duasColunas && "@xl:col-span-2 @5xl:col-span-1")}>
                    {paineis[id].conteudo}
                  </motion.div>
                ))}
              </aside>
            )}
          </div>
        )}

        {mostra("semana") && (
          <motion.div variants={itemLista} className="mt-4" data-bloco="semana">
            <Semana hoje={hoje} tarefas={tarefas} categorias={categorias} />
          </motion.div>
        )}
      </motion.div>
    </Pagina>
  );
}
