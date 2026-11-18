"use client";

// Status de um link ou documento (3.14): o ícone, o selo e os menus para mudar. Um link pode ser uma leitura
// (para ler, lido) ou um chamado que se acompanha (aberto, em andamento, aguardando retorno, concluído,
// cancelado). Cada status tem uma silhueta própria, para dar para ler sem depender de cor.

import { BookOpen, BookOpenCheck, CircleCheck, CircleDot, CircleSlash, Hourglass, LoaderCircle, Lock, type LucideIcon, Tag } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Badge } from "@/components/ui/diversos";
import {
  ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator,
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { comEstado, nomeDoEstado, resumoDoEstado } from "@/lib/links";
import { ESTADOS_LINK, type EstadoLink, type LinkDoc, agoraISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ICONE: Record<EstadoLink, LucideIcon> = {
  para_ler: BookOpen,
  lido: BookOpenCheck,
  aberto: CircleDot,
  em_andamento: LoaderCircle,
  aguardando: Hourglass,
  concluido: CircleCheck,
  cancelado: CircleSlash,
};

/** Cor só onde ela diz algo: verde é "deu certo", o destaque é "é com você"; o resto fica neutro. */
const TOM: Record<EstadoLink, string> = {
  para_ler: "text-primary",
  lido: "text-sucesso",
  aberto: "text-foreground",
  em_andamento: "text-foreground",
  aguardando: "text-foreground",
  concluido: "text-sucesso",
  cancelado: "text-muted-foreground",
};

const SELO: Record<EstadoLink, "default" | "secondary" | "sucesso" | "outline"> = {
  para_ler: "default",
  lido: "sucesso",
  aberto: "outline",
  em_andamento: "outline",
  aguardando: "outline",
  concluido: "sucesso",
  cancelado: "secondary",
};

export function IconeEstadoLink({ estado, className }: { estado: EstadoLink | null | undefined; className?: string }) {
  const Icone = estado ? ICONE[estado] : Tag;
  return <Icone aria-hidden data-slot="icone-estado-link" data-estado={estado || "sem"} className={cn("size-3.5 shrink-0", estado ? TOM[estado] : "text-muted-foreground", className)} />;
}

/** Selo com ícone e nome do status. Não aparece quando o link não tem status. */
export function SeloEstadoLink({ link, className }: { link: LinkDoc; className?: string }) {
  if (!link.estado) return null;
  return (
    <Badge data-slot="estado-link" data-estado={link.estado} variant={SELO[link.estado]} className={cn(SELO[link.estado] === "outline" && "text-foreground", className)}>
      <IconeEstadoLink estado={link.estado} className="size-3" />
      {nomeDoEstado(link.estado)}
    </Badge>
  );
}

/** Selo de que o link está travando a tarefa (âmbar: é impedimento, não erro). */
export function SeloTrava({ className, curto }: { className?: string; curto?: boolean }) {
  return (
    <Badge data-slot="trava-link" variant="alerta" className={className}>
      <Lock /> {curto ? "Trava" : "Travando a tarefa"}
    </Badge>
  );
}

const GRUPOS = [
  { id: "leitura", nome: "Leitura" },
  { id: "chamado", nome: "Chamado" },
] as const;

/** Grava o status novo de um link (com o carimbo de quando mudou). */
export function useMudarEstado() {
  const { salvarLinks, toast } = useNexo();
  return async (link: LinkDoc, estado: EstadoLink | null) => {
    if ((link.estado ?? null) === estado) return;
    const agora = agoraISO();
    if (await salvarLinks((items) => items.map((i) => (i.id === link.id ? comEstado(i, estado, agora) : i))))
      toast(estado ? `“${link.titulo}” agora está como ${nomeDoEstado(estado).toLowerCase()}.` : `“${link.titulo}” ficou sem status.`, "info");
  };
}

/** As opções de status dentro de um menu suspenso (DropdownMenu). */
export function OpcoesDeEstado({ valor, aoMudar }: { valor: EstadoLink | null | undefined; aoMudar: (e: EstadoLink | null) => void }) {
  return (
    <DropdownMenuRadioGroup value={valor || "sem"} onValueChange={(v) => aoMudar(v === "sem" ? null : (v as EstadoLink))}>
      {GRUPOS.map((g) => (
        <div key={g.id} role="group" aria-label={g.nome}>
          <DropdownMenuLabel>{g.nome}</DropdownMenuLabel>
          {ESTADOS_LINK.filter((e) => e.grupo === g.id).map((e) => (
            <DropdownMenuRadioItem key={e.id} value={e.id} data-estado={e.id}><IconeEstadoLink estado={e.id} /> {e.nome}</DropdownMenuRadioItem>
          ))}
        </div>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuRadioItem value="sem" data-estado="sem"><span className="text-muted-foreground">Sem status</span></DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

/** As mesmas opções para o menu do botão direito (ContextMenu). */
export function OpcoesDeEstadoNoContexto({ valor, aoMudar }: { valor: EstadoLink | null | undefined; aoMudar: (e: EstadoLink | null) => void }) {
  return (
    <ContextMenuRadioGroup value={valor || "sem"} onValueChange={(v) => aoMudar(v === "sem" ? null : (v as EstadoLink))}>
      {GRUPOS.map((g) => (
        <div key={g.id} role="group" aria-label={g.nome}>
          <ContextMenuLabel>{g.nome}</ContextMenuLabel>
          {ESTADOS_LINK.filter((e) => e.grupo === g.id).map((e) => (
            <ContextMenuRadioItem key={e.id} value={e.id} data-estado={e.id}><IconeEstadoLink estado={e.id} /> {e.nome}</ContextMenuRadioItem>
          ))}
        </div>
      ))}
      <ContextMenuSeparator />
      <ContextMenuRadioItem value="sem" data-estado="sem"><span className="text-muted-foreground">Sem status</span></ContextMenuRadioItem>
    </ContextMenuRadioGroup>
  );
}

/**
 * Botão que mostra o status e abre a lista para trocar. `variante="icone"` é só o ícone (listas estreitas);
 * `"selo"` mostra o nome, e sem status vira um "Status" discreto.
 */
export function SeletorEstadoLink({ link, variante = "icone", className }: { link: LinkDoc; variante?: "icone" | "selo"; className?: string }) {
  const mudar = useMudarEstado();
  const dica = link.estado ? `${resumoDoEstado(link)}. Clique para mudar` : "Definir um status (para ler, chamado aberto...)";
  return (
    <DropdownMenu>
      <Dica texto={dica}>
        <DropdownMenuTrigger asChild>
          <button type="button" data-slot="seletor-estado-link" data-estado={link.estado || "sem"}
            aria-label={`Status de ${link.titulo}: ${nomeDoEstado(link.estado)}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md outline-none transition-colors sem-selecao hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent",
              variante === "icone" ? "size-7 justify-center" : "h-6 px-1.5 text-xs font-medium",
              variante === "selo" && !link.estado && "text-muted-foreground",
              className,
            )}>
            <IconeEstadoLink estado={link.estado} />
            {variante === "selo" && <span className="truncate whitespace-nowrap">{link.estado ? nomeDoEstado(link.estado) : "Definir status"}</span>}
          </button>
        </DropdownMenuTrigger>
      </Dica>
      <DropdownMenuContent align="end" className="w-52">
        <OpcoesDeEstado valor={link.estado} aoMudar={(e) => void mudar(link, e)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
