"use client";

import { useEffect, useState } from "react";
import { useNexo } from "@/components/Provider";
import { Campo, copiarTexto } from "@/components/comum";

type ItemLixeira = { arquivo: string; titulo: string; tipo: string };

export default function Configuracoes() {
  const { estado, dados, configurarPasta, toast, recarregar } = useNexo();
  const [dir, setDir] = useState(estado?.dataDir ?? "");
  const [backups, setBackups] = useState<string[]>([]);
  const [lixeira, setLixeira] = useState<ItemLixeira[]>([]);

  const carregar = async () => {
    const [b, l] = await Promise.all([
      fetch("/api/backup", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/lixeira", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setBackups(b.backups || []);
    setLixeira(l.itens || []);
  };
  useEffect(() => { carregar(); }, []);

  const totalRegs = dados!.tarefas.reduce((n, t) => n + t.registros.length, 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Configurações</h1>
          <p>Onde seus dados moram e como eles são protegidos.</p>
        </div>
      </div>

      <div className="dois-col" style={{ alignItems: "start" }}>
        <div className="caixa form">
          <h2>Pasta de dados</h2>
          <Campo rotulo="Caminho atual" dica={estado?.origem === "env" ? "Fixado pela variável de ambiente NEXO_DATA_DIR." : "Para trocar, cole outro caminho e salve. Os dados NÃO são movidos automaticamente: copie a pasta antes, se quiser levar tudo."}>
            <input value={dir} onChange={(e) => setDir(e.target.value)} disabled={estado?.origem === "env"} />
          </Campo>
          <div className="acoes">
            <button className="btn" disabled={!dir.trim() || dir === estado?.dataDir || estado?.origem === "env"}
              onClick={() => confirm("Trocar a pasta de dados? O app vai passar a ler e gravar na nova pasta.") && configurarPasta(dir)}>
              Usar esta pasta
            </button>
            <button className="btn fantasma" onClick={async () => (await copiarTexto(estado?.dataDir ?? "")) && toast("Caminho copiado. Cole no Explorer para abrir.")}>
              Copiar caminho
            </button>
          </div>
          <p className="sutil" style={{ margin: 0, fontSize: 13 }}>
            {dados!.tarefas.length} tarefas · {totalRegs} registros · {dados!.categorias.items.length} categorias · {dados!.links.items.length} links/docs
            <br />Formato dos dados: v{estado?.schemaDados} (app suporta até v{estado?.schemaApp})
          </p>
        </div>

        <div className="caixa form">
          <h2>Proteção dos dados</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} className="sutil">
            <li>Cada tarefa é um arquivo JSON separado. Um problema num arquivo não afeta os outros.</li>
            <li>Toda gravação é atômica: escreve num arquivo temporário e só então troca. Se o PC desligar no meio, o arquivo antigo fica intacto.</li>
            <li>Todo dia, antes da primeira alteração, é tirada uma foto dos dados em <code>_backups/AAAA-MM-DD</code> (guarda as últimas 45).</li>
            <li>Antes de qualquer atualização de formato, uma cópia completa vai para <code>_backups/pre-migracao-*</code>.</li>
            <li>Nada é apagado de verdade: tarefas e itens removidos vão para <code>_lixeira</code>. Registros removidos ficam guardados dentro da própria tarefa.</li>
            <li>A pasta <code>markdown/</code> tem uma versão legível de cada tarefa, caso um dia você precise ler sem o app.</li>
          </ul>
          <div className="acoes">
            <button className="btn" onClick={async () => {
              const r = await fetch("/api/backup", { method: "POST" }).then((x) => x.json());
              if (r.erro) toast(r.erro, "erro"); else { toast("Backup manual criado."); carregar(); }
            }}>Fazer backup agora</button>
            <a className="btn" href="/api/exportar">Exportar tudo (JSON)</a>
            <button className="btn fantasma" onClick={recarregar}>Recarregar dados da pasta</button>
          </div>
          {backups.length > 0 && (
            <details>
              <summary className="sutil" style={{ cursor: "pointer", fontSize: 13 }}>{backups.length} backups em _backups</summary>
              <ul style={{ fontSize: 12, fontFamily: "var(--mono)" }}>{backups.slice(0, 60).map((b) => <li key={b}>{b}</li>)}</ul>
            </details>
          )}
        </div>
      </div>

      <section className="secao">
        <h2>Lixeira</h2>
        {lixeira.length === 0 ? <p className="sutil">Vazia.</p> : (
          <table className="tabela">
            <thead><tr><th>Item</th><th>Arquivo</th><th></th></tr></thead>
            <tbody>
              {lixeira.map((i) => (
                <tr key={i.arquivo}>
                  <td>{i.tipo === "tarefa" ? i.titulo : `${i.tipo} removidos`}</td>
                  <td className="sutil"><code>{i.arquivo}</code></td>
                  <td>
                    {i.tipo === "tarefa" && (
                      <button className="btn pequeno" onClick={async () => {
                        const r = await fetch("/api/lixeira", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arquivo: i.arquivo }) }).then((x) => x.json());
                        if (r.erro) toast(r.erro, "erro"); else { toast("Tarefa restaurada."); await recarregar(); carregar(); }
                      }}>Restaurar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="secao">
        <h2>Atalhos</h2>
        <p className="sutil"><kbd>N</kbd> nova tarefa · <kbd>/</kbd> buscar em tudo · <kbd>Esc</kbd> fechar janelas</p>
      </section>
    </>
  );
}
