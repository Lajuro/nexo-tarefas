"use client";

// Controles de aparência, usados em três lugares: no botão da barra superior (versão curta),
// no painel "Personalizar" e em Configurações (versão completa). Tudo aplica na hora.

import { ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Tema, useAparencia, useTema } from "@/components/Raiz";
import { Segmentado } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import { ACENTOS, Cantos, EstiloLateral, Fonte, Fundo, Movimento } from "@/lib/aparencia";
import { cn } from "@/lib/utils";

export function SeletorTema({ className }: { className?: string }) {
  const { tema, definirTema } = useTema();
  return (
    <Segmentado<Tema>
      aria-label="Tema"
      valor={tema}
      aoMudar={definirTema}
      className={className}
      opcoes={[
        { valor: "sistema", rotulo: "Sistema", icone: <Monitor /> },
        { valor: "claro", rotulo: "Claro", icone: <Sun /> },
        { valor: "escuro", rotulo: "Escuro", icone: <Moon /> },
      ]}
    />
  );
}

/** Bolinhas da cor de destaque. A cor de cada uma vem da lista ACENTOS (matiz e croma), não de um valor fixo. */
export function SeletorAcento({ className }: { className?: string }) {
  const { aparencia, mudarAparencia } = useAparencia();
  return (
    <div role="radiogroup" aria-label="Cor de destaque" data-slot="seletor-acento" className={cn("flex flex-wrap gap-1.5", className)}>
      {ACENTOS.map((c) => {
        const ativo = aparencia.acento === c.id;
        return (
          <Dica key={c.id} texto={c.nome}>
            <button type="button" role="radio" aria-checked={ativo} aria-label={c.nome} data-acento={c.id}
              onClick={() => mudarAparencia({ acento: c.id })}
              style={{ background: `oklch(0.58 ${(0.2 * c.croma).toFixed(3)} ${c.matiz})` }}
              className={cn(
                "relative inline-flex size-6 items-center justify-center rounded-full text-white shadow-xs transition-transform duration-150 ease-out outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95",
              )}>
              {ativo && (
                <>
                  <motion.span layoutId="acento-ativo" transition={{ type: "spring", stiffness: 520, damping: 34 }}
                    className="absolute -inset-[3px] rounded-full border-2 border-foreground/70" />
                  <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.16 }} className="inline-flex">
                    <Check className="size-3.5" strokeWidth={3} />
                  </motion.span>
                </>
              )}
            </button>
          </Dica>
        );
      })}
    </div>
  );
}

export function SeletorCantos({ className }: { className?: string }) {
  const { aparencia, mudarAparencia } = useAparencia();
  return (
    <Segmentado<Cantos>
      aria-label="Cantos"
      valor={aparencia.cantos}
      aoMudar={(cantos) => mudarAparencia({ cantos })}
      className={className}
      opcoes={[
        { valor: "retos", rotulo: "Retos" },
        { valor: "suaves", rotulo: "Suaves" },
        { valor: "redondos", rotulo: "Redondos" },
      ]}
    />
  );
}

/** Uma linha "nome à esquerda, controle à direita" com explicação curta embaixo. */
export function LinhaOpcao({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium sem-selecao">{titulo}</span>
      {children}
      {ajuda && <p className="text-[11px] leading-snug text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

const AJUDA_MOVIMENTO: Record<Movimento, string> = {
  completo: "Tudo desliza e se acomoda. Se o Windows estiver com “reduzir movimento”, o Nexo respeita.",
  sutil: "As coisas só aparecem e somem com suavidade, sem deslizar nem crescer.",
  nenhum: "Nada anima. Tudo troca na hora.",
};

/** Todas as opções de aparência, uma embaixo da outra. */
export function OpcoesAparencia() {
  const { aparencia, mudarAparencia } = useAparencia();
  const { tema, resolvido } = useTema();
  return (
    <div data-slot="opcoes-aparencia" className="flex flex-col gap-5">
      <LinhaOpcao titulo="Tema" ajuda={tema === "sistema" ? `Acompanha o tema do Windows. Agora está ${resolvido}.` : `Sempre ${tema}, não importa o tema do Windows.`}>
        <SeletorTema className="self-start" />
      </LinhaOpcao>
      <LinhaOpcao titulo="Cor de destaque" ajuda="Vale para botões, seleção, foco e a barra lateral.">
        <SeletorAcento />
      </LinhaOpcao>
      <LinhaOpcao titulo="Cantos">
        <SeletorCantos className="self-start" />
      </LinhaOpcao>
      <LinhaOpcao titulo="Letra" ajuda="A Geist vem com o Nexo. A do sistema usa a Segoe UI do Windows.">
        <Segmentado<Fonte>
          aria-label="Letra"
          valor={aparencia.fonte}
          aoMudar={(fonte) => mudarAparencia({ fonte })}
          className="self-start"
          opcoes={[
            { valor: "geist", rotulo: "Geist" },
            { valor: "sistema", rotulo: "Do sistema" },
            { valor: "serifada", rotulo: "Serifada" },
          ]}
        />
      </LinhaOpcao>
      <LinhaOpcao titulo="Barra lateral" ajuda="Sólida é neutra. Vidro tem um brilho da cor de destaque. Colorida é tingida por ela.">
        <Segmentado<EstiloLateral>
          aria-label="Estilo da barra lateral"
          valor={aparencia.lateral}
          aoMudar={(lateral) => mudarAparencia({ lateral })}
          className="self-start"
          opcoes={[
            { valor: "solida", rotulo: "Sólida" },
            { valor: "vidro", rotulo: "Vidro" },
            { valor: "colorida", rotulo: "Colorida" },
          ]}
        />
      </LinhaOpcao>
      <LinhaOpcao titulo="Fundo das telas">
        <Segmentado<Fundo>
          aria-label="Fundo das telas"
          valor={aparencia.fundo}
          aoMudar={(fundo) => mudarAparencia({ fundo })}
          className="self-start"
          opcoes={[
            { valor: "liso", rotulo: "Liso" },
            { valor: "aurora", rotulo: "Aurora" },
            { valor: "pontilhado", rotulo: "Pontilhado" },
          ]}
        />
      </LinhaOpcao>
      <LinhaOpcao titulo="Movimento" ajuda={AJUDA_MOVIMENTO[aparencia.movimento]}>
        <Segmentado<Movimento>
          aria-label="Movimento"
          valor={aparencia.movimento}
          aoMudar={(movimento) => mudarAparencia({ movimento })}
          className="self-start"
          opcoes={[
            { valor: "completo", rotulo: "Completo" },
            { valor: "sutil", rotulo: "Sutil" },
            { valor: "nenhum", rotulo: "Nenhum" },
          ]}
        />
      </LinhaOpcao>
    </div>
  );
}
