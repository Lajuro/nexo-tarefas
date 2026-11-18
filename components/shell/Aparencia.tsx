"use client";

// Controles de aparência, usados em três lugares: no botão da barra superior (versão curta),
// no painel "Personalizar" e em Configurações (versão completa). Tudo aplica na hora.

import { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Tema, useAparencia, useTema } from "@/components/Raiz";
import { Segmentado, Slider } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import {
  ACENTOS, ACENTO_LIVRE, CANTOS, Cantos, Escuro, EstiloLateral, Fonte, Fundo, Movimento, Neutros, TEMAS_PRONTOS, TemaPronto, corDeDestaque, temaProntoAtual, tetoDeCroma,
} from "@/lib/aparencia";
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
      <Dica texto="Sua cor: escolha o matiz e a intensidade">
        <button type="button" role="radio" aria-checked={aparencia.acento === ACENTO_LIVRE} aria-label="Sua cor" data-acento={ACENTO_LIVRE}
          onClick={() => {
            if (aparencia.acento === ACENTO_LIVRE) return;
            // começa da cor que estava escolhida, para o usuário ajustar a partir dela
            const atual = corDeDestaque(aparencia);
            mudarAparencia({ acento: ACENTO_LIVRE, matiz: atual.matiz, intensidade: Math.min(1, atual.croma / tetoDeCroma(atual.matiz)) });
          }}
          style={{ background: ARCO_IRIS }}
          className="relative inline-flex size-6 items-center justify-center rounded-full text-white shadow-xs transition-transform duration-150 ease-out outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95">
          {aparencia.acento === ACENTO_LIVRE && (
            <>
              <motion.span layoutId="acento-ativo" transition={{ type: "spring", stiffness: 520, damping: 34 }}
                className="absolute -inset-[3px] rounded-full border-2 border-foreground/70" />
              <span className="size-2.5 rounded-full bg-primary-solido ring-2 ring-white" />
            </>
          )}
        </button>
      </Dica>
    </div>
  );
}

const PASSOS_DE_MATIZ = Array.from({ length: 13 }, (_, i) => i * 30);
/** A roda de cores da bolinha "Sua cor" e o trilho do matiz. São cores de amostra, não tokens. */
const ARCO_IRIS = `conic-gradient(${PASSOS_DE_MATIZ.map((h) => `oklch(0.65 0.16 ${h})`).join(", ")})`;
const TRILHO_DE_MATIZ = `linear-gradient(to right, ${PASSOS_DE_MATIZ.map((h) => `oklch(0.62 0.15 ${h})`).join(", ")})`;
/** O Slider do kit com o trilho pintado pela variável --trilho (o primeiro filho é o trilho; dentro dele, o preenchimento). */
const TRILHO_PINTADO = "[&>span:first-child]:h-2 [&>span:first-child]:[background:var(--trilho)] [&>span:first-child>span]:bg-transparent";

/** Matiz e intensidade da cor livre. Só aparece com "Sua cor" escolhida. */
export function CorLivre() {
  const { aparencia, mudarAparencia } = useAparencia();
  if (aparencia.acento !== ACENTO_LIVRE) return null;
  const teto = tetoDeCroma(aparencia.matiz);
  return (
    <motion.div data-slot="cor-livre" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}
      className="flex flex-col gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs sem-selecao"><span className="font-medium">Matiz</span><span className="text-muted-foreground tabular-nums">{aparencia.matiz}°</span></span>
        <Slider aria-label="Matiz da cor de destaque" min={0} max={359} step={1} value={[aparencia.matiz]}
          onValueChange={([v]) => mudarAparencia({ matiz: v })}
          className={TRILHO_PINTADO} style={{ "--trilho": TRILHO_DE_MATIZ } as CSSProperties} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs sem-selecao"><span className="font-medium">Intensidade</span><span className="text-muted-foreground tabular-nums">{Math.round(aparencia.intensidade * 100)}%</span></span>
        <Slider aria-label="Intensidade da cor de destaque" min={0} max={100} step={1} value={[Math.round(aparencia.intensidade * 100)]}
          onValueChange={([v]) => mudarAparencia({ intensidade: v / 100 })}
          className={TRILHO_PINTADO}
          style={{ "--trilho": `linear-gradient(to right, oklch(0.6 0.01 ${aparencia.matiz}), oklch(0.58 ${(0.2 * teto).toFixed(3)} ${aparencia.matiz}))` } as CSSProperties} />
      </label>
      <p className="text-xs leading-snug text-muted-foreground">Qualquer cor serve: o Nexo mantém a luminosidade fixa, então o texto continua legível.</p>
    </motion.div>
  );
}

// ---------- Temas prontos ----------

/** Miniatura do app com as cores de verdade do tema: as classes tema-claro e tema-escuro recalculam os tokens aqui dentro. */
function Miniatura({ tema, escuro }: { tema: TemaPronto; escuro: boolean }) {
  const cor = corDeDestaque(tema.visual);
  const v = tema.visual;
  return (
    <span aria-hidden data-neutros={v.neutros} data-escuro={v.escuro}
      style={{ "--matiz": cor.matiz, "--croma": cor.croma, "--radius": CANTOS[v.cantos] } as CSSProperties}
      className={cn(escuro ? "tema-escuro" : "tema-claro", "flex h-14 w-full overflow-hidden rounded-md border bg-background")}>
      <span className={cn("flex w-[30%] flex-col gap-1 border-r border-sidebar-border p-1.5",
        v.lateral === "colorida" ? "bg-[color-mix(in_oklch,var(--primary)_13%,var(--background))]" : v.lateral === "vidro" ? "bg-sidebar bg-linear-to-b from-primary/18 to-transparent" : "bg-sidebar")}>
        <span className="h-1.5 w-full rounded-sm bg-primary-solido" />
        <span className="h-1 w-4/5 rounded-full bg-foreground/25" />
        <span className="h-1 w-3/5 rounded-full bg-foreground/25" />
      </span>
      <span className={cn("flex min-w-0 flex-1 flex-col gap-1 p-1.5", v.fundo === "aurora" && "bg-linear-to-br from-primary/12 to-transparent")}>
        <span className="h-1.5 w-1/2 rounded-full bg-foreground/70" />
        <span className="flex flex-1 items-end rounded-sm border bg-card p-1"><span className="h-1 w-2/5 rounded-full bg-primary" /></span>
      </span>
    </span>
  );
}

/** Combinações prontas de cor, tons, cantos, letra, barra lateral e fundo. Um clique aplica tudo; depois dá para ajustar. */
export function TemasProntos() {
  const { aparencia, mudarAparencia } = useAparencia();
  const { resolvido, definirTema } = useTema();
  const escuroAgora = resolvido === "escuro";
  const atual = temaProntoAtual(aparencia, escuroAgora);
  return (
    <div role="radiogroup" aria-label="Temas prontos" data-slot="temas-prontos" className="grid grid-cols-3 gap-2">
      {TEMAS_PRONTOS.map((t) => {
        const ativo = atual?.id === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={ativo} data-tema-pronto={t.id}
            onClick={() => {
              mudarAparencia(t.visual);
              if (t.tema && (t.tema === "escuro") !== escuroAgora) definirTema(t.tema);
            }}
            className={cn(
              "group/tema flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-[border-color,background-color,transform] duration-150 outline-none sem-selecao hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-[0.98]",
              ativo ? "border-primary bg-primary/6" : "border-border",
            )}>
            <Miniatura tema={t} escuro={t.tema ? t.tema === "escuro" : escuroAgora} />
            <span className="flex items-center gap-1 px-0.5">
              <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", ativo && "text-primary")}>{t.nome}</span>
              {t.tema && (t.tema === "escuro" ? <Moon className="size-3 shrink-0 text-muted-foreground" /> : <Sun className="size-3 shrink-0 text-muted-foreground" />)}
            </span>
          </button>
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
      {ajuda && <p className="text-xs leading-snug text-muted-foreground">{ajuda}</p>}
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
      <LinhaOpcao titulo="Temas prontos" ajuda="Um clique troca cor, tons, cantos, letra, barra lateral e fundo. Depois ajuste o que quiser logo abaixo. Os que têm sol ou lua também mudam para claro ou escuro.">
        <TemasProntos />
      </LinhaOpcao>
      <LinhaOpcao titulo="Tema" ajuda={tema === "sistema" ? `Acompanha o tema do Windows. Agora está ${resolvido}.` : `Sempre ${tema}, não importa o tema do Windows.`}>
        <SeletorTema className="self-start" />
      </LinhaOpcao>
      <LinhaOpcao titulo="Tema escuro" ajuda={aparencia.escuro === "profundo" ? "Fundos quase pretos, com mais contraste. Bom para ambiente escuro." : "O escuro de sempre, com fundos em cinza bem escuro."}>
        <Segmentado<Escuro>
          aria-label="Tema escuro"
          valor={aparencia.escuro}
          aoMudar={(escuro) => mudarAparencia({ escuro })}
          className="self-start"
          opcoes={[
            { valor: "padrao", rotulo: "Padrão" },
            { valor: "profundo", rotulo: "Profundo" },
          ]}
        />
      </LinhaOpcao>
      <LinhaOpcao titulo="Cor de destaque" ajuda="Vale para botões, seleção, foco e a barra lateral. A última bolinha é a sua cor.">
        <SeletorAcento />
        <CorLivre />
      </LinhaOpcao>
      <LinhaOpcao titulo="Tons neutros" ajuda="O tom dos fundos, das bordas e do texto. “Da cor” puxa tudo de leve para a cor de destaque.">
        <Segmentado<Neutros>
          aria-label="Tons neutros"
          valor={aparencia.neutros}
          aoMudar={(neutros) => mudarAparencia({ neutros })}
          className="self-start"
          opcoes={[
            { valor: "frio", rotulo: "Frios" },
            { valor: "neutro", rotulo: "Cinza" },
            { valor: "quente", rotulo: "Quentes" },
            { valor: "destaque", rotulo: "Da cor" },
          ]}
        />
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
            { valor: "grade", rotulo: "Grade" },
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
