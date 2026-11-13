import { Tarefa, formatarData, nomeStatus, ordenarRegistros, tipoInfo } from "./tipos";

// Espelho legível de cada tarefa. Se um dia o app parar de funcionar,
// tudo continua legível na pasta markdown/ (e pesquisável pelo Windows).
export function tarefaParaMarkdown(t: Tarefa, categoria?: string) {
  const L: string[] = [];
  L.push(`# ${t.titulo}`, "");
  L.push(`- **Categoria:** ${categoria || "Sem categoria"}`);
  L.push(`- **Status:** ${nomeStatus(t.status)}`);
  L.push(`- **Prioridade:** ${t.prioridade}`);
  if (t.prazo) L.push(`- **Prazo:** ${formatarData(t.prazo)}`);
  if (t.tags.length) L.push(`- **Tags:** ${t.tags.join(", ")}`);
  L.push(`- **Criada em:** ${formatarData(t.criadaEm)}`);
  if (t.descricao) L.push("", t.descricao);
  if (t.panoramaIA?.texto) L.push("", `## Panorama (IA, ${formatarData(t.panoramaIA.geradoEm)})`, "", t.panoramaIA.texto);
  L.push("", "## Linha do tempo");
  for (const r of ordenarRegistros(t.registros)) {
    const tipo = tipoInfo(r.tipo);
    L.push("", `### ${formatarData(r.data)}${r.hora ? " " + r.hora : ""} · ${tipo.nome}${r.titulo ? ": " + r.titulo : ""}`);
    if (r.participantes.length) L.push(`**Participantes:** ${r.participantes.join(", ")}`);
    if (r.resumoIA) L.push("", "**Resumo:**", r.resumoIA);
    if (r.anotacoes) L.push("", "**Anotações:**", r.anotacoes);
    if (r.decisoes) L.push("", "**Decisões:**", r.decisoes);
    if (r.proximosPassos.length) {
      L.push("", "**Próximos passos:**");
      for (const p of r.proximosPassos) L.push(`- [${p.feito ? "x" : " "}] ${p.texto}${p.responsavel ? ` (${p.responsavel})` : ""}`);
    }
    if (r.impedimentos) L.push("", "**Impedimentos:**", r.impedimentos);
    const a = r.alteracoes;
    if (a?.status) L.push(`_Status: ${nomeStatus(a.status.de as never)} → ${nomeStatus(a.status.para as never)}_`);
  }
  return L.join("\n") + "\n";
}
