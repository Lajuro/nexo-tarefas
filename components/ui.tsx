"use client";

import { ReactNode, useEffect, useId, useState } from "react";
import { Categoria, Status, diasAte, formatarData, nomeStatus } from "@/lib/tipos";

export function Modal({
  titulo, aberto, fechar, children, largo, rodape,
}: {
  titulo: string; aberto: boolean; fechar: () => void; children: ReactNode; largo?: boolean; rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className={`modal ${largo ? "largo" : ""}`} role="dialog" aria-label={titulo}>
        <header className="modal-topo">
          <h2>{titulo}</h2>
          <button className="btn-icone" onClick={fechar} aria-label="Fechar">✕</button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape && <footer className="modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}

export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge st-${status}`}>{nomeStatus(status)}</span>;
}

export function PrioBadge({ p }: { p: number }) {
  const nivel = p >= 8 ? "alta" : p >= 5 ? "media" : "baixa";
  return (
    <span className={`prio prio-${nivel}`} title="Prioridade (1 a 10, quanto maior mais urgente)">
      {p}
    </span>
  );
}

export function CatTag({ cat }: { cat?: Categoria | null }) {
  if (!cat) return <span className="cat-tag sem">Sem categoria</span>;
  return (
    <span className="cat-tag" style={{ "--cor": cat.cor } as React.CSSProperties}>
      {cat.nome}
    </span>
  );
}

export function PrazoTag({ prazo, concluida }: { prazo: string | null; concluida?: boolean }) {
  if (!prazo) return null;
  const d = diasAte(prazo)!;
  const classe = concluida ? "" : d < 0 ? "atrasado" : d <= 3 ? "perto" : "";
  const txt = concluida ? "" : d < 0 ? ` · ${-d}d atrasado` : d === 0 ? " · hoje" : d <= 7 ? ` · em ${d}d` : "";
  return <span className={`prazo ${classe}`}>⏱ {formatarData(prazo)}{txt}</span>;
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function ChipsInput({
  valor, mudar, sugestoes, placeholder,
}: {
  valor: string[]; mudar: (v: string[]) => void; sugestoes?: string[]; placeholder?: string;
}) {
  const [txt, setTxt] = useState("");
  const listaId = useId();
  const add = (s: string) => {
    const novos = s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    const out = [...valor];
    for (const n of novos) if (!out.some((v) => v.toLowerCase() === n.toLowerCase())) out.push(n);
    mudar(out);
    setTxt("");
  };
  return (
    <div className="chips-input">
      {valor.map((v) => (
        <span key={v} className="chip">
          {v}
          <button type="button" onClick={() => mudar(valor.filter((x) => x !== v))} aria-label={`Remover ${v}`}>
            ×
          </button>
        </span>
      ))}
      <input
        value={txt}
        list={sugestoes ? listaId : undefined}
        placeholder={valor.length ? "" : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;]$/.test(v)) add(v);
          else setTxt(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && txt.trim()) {
            e.preventDefault();
            add(txt);
          } else if (e.key === "Backspace" && !txt && valor.length) {
            mudar(valor.slice(0, -1));
          }
        }}
        onBlur={() => txt.trim() && add(txt)}
      />
      {sugestoes && (
        <datalist id={listaId}>
          {sugestoes.filter((s) => !valor.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="campo">
      <span className="rotulo">{rotulo}</span>
      {children}
      {dica && <span className="dica">{dica}</span>}
    </label>
  );
}

export function Destaque({ texto, termo }: { texto: string; termo: string }) {
  if (!termo) return <>{texto}</>;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const i = norm(texto).indexOf(norm(termo));
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + termo.length)}</mark>
      {texto.slice(i + termo.length)}
    </>
  );
}

export function formatarTamanho(b?: number) {
  if (!b && b !== 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
