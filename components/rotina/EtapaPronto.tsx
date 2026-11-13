"use client";

// Etapa 3 do ritual: o plano do dia em uma tela, com o próximo passo de cada foco.

import { motion } from "motion/react";
import { CornerDownRight, Sunrise, Target } from "lucide-react";
import { CatTag, PrazoTag } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/diversos";
import { plural } from "@/components/hoje/apoio";
import { itemLista, lista } from "@/lib/animacoes";
import { passoEhMeu, resumoDoDia } from "@/lib/lembretes";
import { Categoria, Tarefa, passosAbertos } from "@/lib/tipos";
import type { ContagemPendencias } from "./EtapaAtras";

/** O próximo passo de uma tarefa: o primeiro em aberto que é meu; se não houver, o primeiro de qualquer pessoa. */
function proximoPasso(t: Tarefa) {
  const abertos = passosAbertos(t).map((x) => x.passo);
  return abertos.find(passoEhMeu) ?? abertos[0] ?? null;
}

export function EtapaPronto({
  focos, tarefas, categorias, contagem, escolherFocos,
}: {
  focos: Tarefa[]; tarefas: Tarefa[]; categorias: Categoria[]; contagem: ContagemPendencias; escolherFocos: () => void;
}) {
  const resumo = resumoDoDia(tarefas);
  const passosHoje = resumo.passosDoDia.length;
  const radar = [
    resumo.venceHoje.length > 0 && plural(resumo.venceHoje.length, "prazo vence hoje", "prazos vencem hoje"),
    resumo.atrasadas.length > 0 && plural(resumo.atrasadas.length, "tarefa ainda atrasada", "tarefas ainda atrasadas"),
    passosHoje > 0 && plural(passosHoje, "passo com prazo até hoje", "passos com prazo até hoje"),
    resumo.aguardando.length > 0 && plural(resumo.aguardando.length, "retorno para acompanhar", "retornos para acompanhar"),
    contagem.resolvidas > 0 && plural(contagem.resolvidas, "pendência resolvida agora", "pendências resolvidas agora"),
  ].filter((x): x is string => !!x);

  return (
    <div data-slot="ritual-pronto">
      <div className="flex flex-col items-center px-4 pt-3 pb-5 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 24, delay: 0.05 }}
          className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary dark:bg-primary/20 dark:text-foreground"
        >
          <Sunrise className="size-6" />
        </motion.span>
        <h3 className="text-[15px] font-semibold tracking-tight">{focos.length ? "Seu dia está montado" : "Dia revisado"}</h3>
        <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
          {focos.length
            ? `${plural(focos.length, "foco", "focos")} para hoje. Comece pelo primeiro; a tela Hoje guarda o resto para você.`
            : "Você não escolheu nenhum foco, e tudo bem. Dá para focar uma tarefa a qualquer momento pelo menu dela."}
        </p>
        {focos.length === 0 && (
          <Button variant="outline" size="sm" className="mt-3" onClick={escolherFocos}>
            <Target /> Escolher focos
          </Button>
        )}
      </div>

      {focos.length > 0 && (
        <motion.ol variants={lista} initial="escondido" animate="visivel" className="flex flex-col gap-2">
          {focos.map((t, i) => {
            const passo = proximoPasso(t);
            return (
              <motion.li key={t.id} variants={itemLista} data-slot="foco-escolhido" className="flex items-start gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-xs">
                <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <CatTag cat={categorias.find((c) => c.id === t.categoriaId)} className="mr-auto text-[11px]" />
                    <PrazoTag prazo={t.prazo} className="text-[11px] [&_svg]:size-3" />
                  </div>
                  <div className="mt-0.5 text-[13px] leading-snug font-semibold">{t.titulo}</div>
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                    <CornerDownRight className="mt-px size-3.5 shrink-0 opacity-70" />
                    {passo ? (
                      <span className="min-w-0">
                        <span className="text-foreground">{passo.texto}</span>
                        {!passoEhMeu(passo) && <span> (com {passo.responsavel})</span>}
                      </span>
                    ) : (
                      <span>Sem próximo passo definido. Vale registrar qual é a próxima ação.</span>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </motion.ol>
      )}

      {radar.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground sem-selecao">Também no radar</p>
          <div className="flex flex-wrap gap-1.5">
            {radar.map((r) => (
              <Badge key={r} variant="secondary">{r}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
