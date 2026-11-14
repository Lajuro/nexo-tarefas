"use client";

import { useCallback, useEffect, useState } from "react";
import { useNexo } from "@/components/Provider";
import { Pagina } from "@/components/comum";
import { PainelModelos } from "@/components/Modelos";
import { abrirNovaTarefa } from "@/components/Shell";
import { ItemLixeira, PainelLixeira, PainelPasta, PainelProtecao, PainelSaude } from "@/components/configuracoes/dados";
import { PainelAparencia, PainelAtalhos, PainelJogo, PainelQuemSouEu, PainelRotina, PainelSobre } from "@/components/configuracoes/preferencias";

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}

export default function Configuracoes() {
  const { dados, toast, recarregar } = useNexo();
  const [backups, setBackups] = useState<string[] | null>(null);
  const [lixeira, setLixeira] = useState<ItemLixeira[] | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [b, l] = await Promise.all([
      pedir<{ backups?: string[] }>("/api/backup").catch(() => ({ backups: [] })),
      pedir<{ itens?: ItemLixeira[] }>("/api/lixeira").catch(() => ({ itens: [] })),
    ]);
    setBackups(b.backups || []);
    setLixeira(l.itens || []);
  }, []);

  // A lixeira muda quando uma tarefa é excluída em qualquer lugar: relê junto com os dados.
  const totalTarefas = dados?.tarefas.length ?? 0;
  useEffect(() => {
    carregar();
  }, [carregar, totalTarefas]);

  const fazerBackup = async () => {
    setFazendoBackup(true);
    try {
      await pedir("/api/backup", { method: "POST" });
      toast("Backup manual criado.");
      await carregar();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
    setFazendoBackup(false);
  };

  const restaurar = async (i: ItemLixeira) => {
    setRestaurando(i.arquivo);
    try {
      await pedir("/api/lixeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivo: i.arquivo }),
      });
      toast("Tarefa restaurada.");
      await recarregar();
      await carregar();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
    setRestaurando(null);
  };

  if (!dados) return null;

  return (
    <Pagina titulo="Configurações" descricao="Onde seus dados moram, como eles são protegidos e como o Nexo te ajuda a lembrar de tudo.">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <PainelPasta />
          <PainelProtecao backups={backups} aoFazerBackup={fazerBackup} fazendo={fazendoBackup} aoRestaurar={carregar} />
          <PainelSaude />
          <PainelModelos usar={(id) => abrirNovaTarefa(null, id)} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PainelAparencia />
          <PainelRotina />
          <PainelJogo />
          <PainelQuemSouEu />
          <PainelAtalhos />
        </div>
      </div>
      <PainelLixeira className="mt-4" itens={lixeira} aoRestaurar={restaurar} restaurando={restaurando} />
      <div className="mt-4">
        <PainelSobre />
      </div>
    </Pagina>
  );
}
