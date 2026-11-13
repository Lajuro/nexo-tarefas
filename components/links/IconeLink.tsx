"use client";

// Aparência de um item do banco de links: ícone por tipo (link da web, caminho de rede, arquivo)
// e o endereço em formato curto para mostrar em listas.

import {
  File as ArquivoGenerico, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, FolderOpen, Link2, type LucideIcon, Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkDoc } from "@/lib/tipos";

export type GeneroLink = "link" | "rede" | "arquivo";

/** Caminho de rede é um link cujo endereço começa com \\servidor. */
export function generoDoLink(l: LinkDoc): GeneroLink {
  if (l.tipo === "arquivo") return "arquivo";
  return l.url?.startsWith("\\\\") ? "rede" : "link";
}

export const NOME_GENERO: Record<GeneroLink, string> = {
  link: "Link",
  rede: "Caminho de rede",
  arquivo: "Arquivo guardado na pasta de dados",
};

const POR_EXTENSAO: [RegExp, LucideIcon][] = [
  [/\.(png|jpe?g|gif|svg|webp|bmp)$/i, FileImage],
  [/\.(xlsx?|csv|ods)$/i, FileSpreadsheet],
  [/\.(pptx?|odp)$/i, Presentation],
  [/\.(zip|7z|rar|gz|tar)$/i, FileArchive],
  [/\.(json|ya?ml|xml|html?|js|ts|py|sh|ps1|sql)$/i, FileCode],
  [/\.(pdf|docx?|odt|txt|md|rtf)$/i, FileText],
];

function iconeDe(l: LinkDoc): LucideIcon {
  const g = generoDoLink(l);
  if (g === "link") return Link2;
  if (g === "rede") return FolderOpen;
  const nome = l.nomeArquivo || l.arquivo || "";
  return POR_EXTENSAO.find(([re]) => re.test(nome))?.[1] ?? ArquivoGenerico;
}

const TOM: Record<GeneroLink, string> = {
  link: "bg-info/14 text-info",
  rede: "bg-alerta/16 text-alerta",
  arquivo: "bg-primary/12 text-primary dark:bg-primary/22 dark:text-foreground",
};

/** Quadradinho colorido com o ícone do tipo. */
export function IconeLink({ link, className }: { link: LinkDoc; className?: string }) {
  const Icone = iconeDe(link);
  const g = generoDoLink(link);
  return (
    <span data-slot="icone-link" data-genero={g}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", TOM[g], className)}>
      <Icone />
    </span>
  );
}

/** Endereço enxuto para listas: sem protocolo nem barra final; para arquivo, o nome original. */
export function enderecoCurto(l: LinkDoc) {
  if (l.tipo === "arquivo") return l.nomeArquivo || "";
  return (l.url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
