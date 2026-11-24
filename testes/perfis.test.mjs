// Testes dos perfis de uso (3.20): lib/perfis.ts. Arranjo, perfis prontos, trocar e lembrar, perfis próprios,
// quem já tinha personalizado e o código de um perfil.
// Uso: node testes/perfis.test.mjs   (Node 22.18+ importa .ts direto)

import assert from "node:assert/strict";
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
    export async function resolve(especificador, contexto, proximo) {
      try { return await proximo(especificador, contexto); }
      catch (e) {
        if (especificador.startsWith(".") && !/\\.[cm]?[jt]s$/.test(especificador)) return proximo(especificador + ".ts", contexto);
        throw e;
      }
    }
    export async function load(url, contexto, proximo) {
      if (url.startsWith("file:") && url.endsWith(".ts")) return proximo(url, { ...contexto, format: "module-typescript" });
      return proximo(url, contexto);
    }`),
);

const P = await import("../lib/perfis.ts");
const M = await import("../lib/moldura.ts");
const H = await import("../lib/tela-hoje.ts");

let falhas = 0;
let total = 0;
function teste(nome, fn) {
  total++;
  try {
    fn();
    console.log("ok   " + nome);
  } catch (e) {
    falhas++;
    console.log("FALHA " + nome + "\n      " + String(e.message).split("\n").join("\n      "));
  }
}

// Os itens do menu, na ordem original (o mesmo que components/shell/navegacao.ts monta).
const HREFS = ["/", "/tarefas", "/rotina", "/pendencias", "/notas", "/paginas", "/perguntar", "/categorias", "/pessoas", "/links", "/acompanhar", "/radar", "/diario", "/decisoes", "/revisao", "/relatorios", "/conquistas"];
const padrao = P.ARRANJO_PADRAO;
const com = (parte) => P.normalizarArranjo({ ...padrao, ...parte, moldura: { ...padrao.moldura, ...parte.moldura }, hoje: { ...padrao.hoje, ...parte.hoje } });
const E0 = P.ESTADO_INICIAL;

// ---------- arranjo ----------

teste("normalizarArranjo: entrada hostil vira o padrão, sem largura nem nome", () => {
  for (const mau of [null, 7, "x", [], { moldura: "lixo", hoje: 3, inicio: {}, telas: [] }]) assert.deepEqual(P.normalizarArranjo(mau), padrao, JSON.stringify(mau));
  const a = P.normalizarArranjo({
    moldura: { largura: 399, ocultos: ["/links", 7, "/links"], secoes: ["recentes", "inventada"], ferramentasOcultas: ["foco", "<script>"], barraStatus: false },
    hoje: { nome: "Fulano", ocultos: ["semana", "inventado"], primeiro: "outro" },
    inicio: "https://exemplo.invalido/", lateralRecolhida: "sim", telas: { visaoTarefas: "mosaico", agrupamentoPendencias: "pessoa", soMeus: "talvez", extra: 1 },
  });
  assert.equal("largura" in a.moldura, false);
  assert.equal("nome" in a.hoje, false);
  assert.deepEqual(a.moldura.ocultos, ["/links"]);
  assert.deepEqual(a.moldura.secoes, ["recentes", "foco", "fixadas", "assuntos"]);
  assert.deepEqual(a.moldura.ferramentasOcultas, ["foco"]);
  assert.equal(a.moldura.barraStatus, false);
  assert.deepEqual(a.hoje.ocultos, ["semana"]);
  assert.equal(a.hoje.primeiro, "auto");
  assert.equal(a.inicio, "/", "um código colado nunca escolhe um endereço");
  assert.equal(a.lateralRecolhida, false);
  assert.deepEqual(a.telas, { agrupamentoPendencias: "pessoa" });
});

teste("arranjoVivo: monta o arranjo das preferências vivas e deixa de fora o que é da pessoa", () => {
  const vivo = P.arranjoVivo({
    moldura: M.normalizarMoldura({ largura: 300, contadores: false }), hoje: H.normalizarTelaHoje({ nome: "Fulano", primeiro: "foco" }),
    inicio: "/radar", lateralRecolhida: true, telas: { visaoTarefas: "quadro" },
  });
  assert.deepEqual(vivo, com({ moldura: { contadores: false }, hoje: { primeiro: "foco" }, inicio: "/radar", lateralRecolhida: true, telas: { visaoTarefas: "quadro" } }));
});

teste("mesmoArranjo: compara pelo que se vê (ordem efetiva e escondidos como conjunto)", () => {
  // ordem vazia e a ordem padrão escrita por extenso são a mesma tela
  assert.equal(P.mesmoArranjo(padrao, com({ moldura: { ordem: [...HREFS] } }), HREFS), true);
  assert.equal(P.mesmoArranjo(padrao, com({ moldura: { ordem: ["/", "/tarefas"] } }), HREFS), true);
  assert.equal(P.mesmoArranjo(padrao, com({ moldura: { ordem: ["/tarefas", "/"] } }), HREFS), false);
  // a ordem em que escondeu não importa; item que não existe mais no menu também não
  const a = com({ moldura: { ocultos: ["/links", "/pessoas"], ferramentasOcultas: ["foco", "agenda"] }, hoje: { ocultos: ["semana", "captura"] } });
  const b = com({ moldura: { ocultos: ["/pessoas", "/links", "/tela-antiga"], ferramentasOcultas: ["agenda", "foco"] }, hoje: { ocultos: ["captura", "semana"] } });
  assert.equal(P.mesmoArranjo(a, b, HREFS), true);
  // a ordem das seções e dos painéis da Hoje importa
  assert.equal(P.mesmoArranjo(padrao, com({ moldura: { secoes: ["fixadas", "foco", "recentes", "assuntos"] } }), HREFS), false);
  assert.equal(P.mesmoArranjo(padrao, com({ hoje: { laterais: ["progresso", "rotina", "aguardando", "bloqueadas"] } }), HREFS), false);
  for (const parte of [{ inicio: "/radar" }, { lateralRecolhida: true }, { moldura: { barraStatus: false } }, { moldura: { acompanharSeparado: true } }, { hoje: { primeiro: "foco" } }, { moldura: { titulosDeGrupo: false } }])
    assert.equal(P.mesmoArranjo(padrao, com(parte), HREFS), false, JSON.stringify(parte));
  // as visões por tela ficam de fora: trocar a lista para quadro não é mexer no perfil
  assert.equal(P.mesmoArranjo(padrao, com({ telas: { visaoTarefas: "quadro", soMeus: true } }), HREFS), true);
});

// ---------- perfis prontos ----------

teste("perfis prontos: cinco, com ids únicos, e o Completo é o padrão", () => {
  assert.deepEqual(P.PERFIS_PRONTOS.map((p) => p.id), ["completo", "foco", "reunioes", "gestao", "estudo"]);
  assert.deepEqual(P.PERFIS_PRONTOS[0].arranjo, padrao);
  for (const p of P.PERFIS_PRONTOS) {
    assert.ok(p.nome && p.descricao && !p.descricao.includes("—"), p.id);
    assert.deepEqual(P.normalizarArranjo(JSON.parse(JSON.stringify(p.arranjo))), p.arranjo, `${p.id}: o arranjo sobrevive a ir e voltar`);
  }
});

teste("perfis prontos: só citam itens, seções, ferramentas e blocos que existem", () => {
  for (const p of P.PERFIS_PRONTOS) {
    const { moldura, hoje, inicio } = p.arranjo;
    for (const h of [...moldura.ordem, ...moldura.ocultos]) assert.ok(HREFS.includes(h), `${p.id}: item de menu desconhecido ${h}`);
    for (const s of [...moldura.secoesOcultas, ...moldura.secoesFechadas]) assert.ok(M.SECOES.includes(s), `${p.id}: seção ${s}`);
    for (const f of moldura.ferramentasOcultas) assert.ok(M.FERRAMENTAS.includes(f), `${p.id}: ferramenta ${f}`);
    for (const b of hoje.ocultos) assert.ok(H.BLOCOS_HOJE.includes(b), `${p.id}: bloco ${b}`);
    assert.ok(P.INICIOS.includes(inicio), `${p.id}: início ${inicio}`);
    // a tela em que o perfil abre precisa estar à vista no menu dele (ou dentro de Acompanhar, quando junto)
    const acompanhar = ["/radar", "/diario", "/decisoes", "/revisao", "/relatorios", "/conquistas"];
    const noMenu = acompanhar.includes(inicio) && !moldura.acompanharSeparado ? "/acompanhar" : inicio;
    assert.ok(!moldura.ocultos.includes(noMenu), `${p.id}: abre numa tela que o próprio perfil esconde`);
    // nenhum perfil esconde Hoje nem Tarefas
    assert.ok(!moldura.ocultos.includes("/") && !moldura.ocultos.includes("/tarefas"), p.id);
  }
});

teste("perfis prontos: cada um é diferente do Completo e dos outros", () => {
  const prontos = P.PERFIS_PRONTOS;
  for (let i = 0; i < prontos.length; i++)
    for (let j = i + 1; j < prontos.length; j++) assert.equal(P.mesmoArranjo(prontos[i].arranjo, prontos[j].arranjo, HREFS), false, `${prontos[i].id} = ${prontos[j].id}`);
});

// ---------- estado guardado ----------

teste("normalizarPerfis: entrada hostil vira o estado inicial", () => {
  for (const mau of [null, 7, "x", [], {}, { ativo: "inventado", proprios: "lixo", memoria: [] }]) assert.deepEqual(P.normalizarPerfis(mau), E0, JSON.stringify(mau));
});

teste("normalizarPerfis: perfis próprios com id e nome válidos, sem repetir, até o limite; memória só de quem existe", () => {
  const e = P.normalizarPerfis({
    ativo: "ppabc123",
    proprios: [
      { id: "ppabc123", nome: "  Meu   dia\nde campo ", base: "foco", arranjo: { inicio: "/notas" } },
      { id: "ppabc123", nome: "Repetido" }, { id: "../x", nome: "Id ruim" }, { id: "ppsemnome", nome: "   " }, "solto", null,
      { id: "ppoutro99", nome: "x".repeat(200), base: "inventada" },
    ],
    memoria: { foco: { lateralRecolhida: false }, ppabc123: { inicio: "/radar" }, fantasma: { inicio: "/radar" }, __proto__: { x: 1 } },
  });
  assert.equal(e.ativo, "ppabc123");
  assert.deepEqual(e.proprios.map((p) => [p.id, p.nome, p.base]), [["ppabc123", "Meu dia de campo", "foco"], ["ppoutro99", "x".repeat(P.TAMANHO_DO_NOME_DO_PERFIL), "completo"]]);
  assert.equal(e.proprios[0].arranjo.inicio, "/notas");
  assert.deepEqual(Object.keys(e.memoria).sort(), ["foco", "ppabc123"]);
  const muitos = P.normalizarPerfis({ proprios: Array.from({ length: 40 }, (_, i) => ({ id: `ppitem${String(i).padStart(2, "0")}`, nome: `Perfil ${i}` })) });
  assert.equal(muitos.proprios.length, P.MAX_PERFIS_PROPRIOS);
  // ativo que deixou de existir volta para o Completo
  assert.equal(P.normalizarPerfis({ ativo: "ppsumiu99" }).ativo, "completo");
});

// ---------- trocar e lembrar ----------

teste("trocarPerfil: abre o outro como veio, e lembra como o primeiro foi deixado", () => {
  const mexido = com({ moldura: { ocultos: ["/links"] } });
  const ida = P.trocarPerfil(E0, "foco", mexido);
  assert.equal(ida.estado.ativo, "foco");
  assert.deepEqual(ida.aplicar, P.PERFIS_PRONTOS.find((p) => p.id === "foco").arranjo);
  assert.deepEqual(ida.estado.memoria.completo, mexido);
  // mexe no Foco e volta: o Completo está como ficou
  const focoMexido = { ...ida.aplicar, inicio: "/tarefas" };
  const volta = P.trocarPerfil(ida.estado, "completo", focoMexido);
  assert.deepEqual(volta.aplicar, mexido);
  assert.deepEqual(volta.estado.memoria.foco, focoMexido);
  // e o Foco também lembra
  assert.deepEqual(P.trocarPerfil(volta.estado, "foco", mexido).aplicar, focoMexido);
  assert.deepEqual(E0, P.ESTADO_INICIAL, "o estado de entrada não foi mexido");
});

teste("trocarPerfil: para o mesmo perfil ou para um que não existe, nada acontece", () => {
  assert.deepEqual(P.trocarPerfil(E0, "completo", padrao), { estado: E0 });
  assert.deepEqual(P.trocarPerfil(E0, "inventado", padrao), { estado: E0 });
});

teste("redefinirPerfil e perfilModificado", () => {
  const foco = P.PERFIS_PRONTOS.find((p) => p.id === "foco").arranjo;
  const { estado } = P.trocarPerfil(E0, "foco", padrao);
  assert.equal(P.perfilModificado(estado, foco, HREFS), false);
  const mexido = { ...foco, lateralRecolhida: false };
  assert.equal(P.perfilModificado(estado, mexido, HREFS), true);
  // saiu e voltou: continua mexido, e redefinir volta ao original e esquece a memória
  const fora = P.trocarPerfil(estado, "completo", mexido).estado;
  const dentro = P.trocarPerfil(fora, "foco", padrao);
  assert.deepEqual(dentro.aplicar, mexido);
  const red = P.redefinirPerfil(dentro.estado);
  assert.deepEqual(red.aplicar, foco);
  assert.equal("foco" in red.estado.memoria, false);
  assert.equal(red.estado.ativo, "foco");
});

// ---------- perfis próprios ----------

teste("salvarComoPerfil: o arranjo de agora vira um perfil em uso, e o de origem fica como era", () => {
  const { estado: noFoco } = P.trocarPerfil(E0, "foco", padrao);
  const meu = com({ moldura: { ocultos: ["/notas"] }, inicio: "/pendencias" });
  const s = P.salvarComoPerfil(noFoco, "  Plantão  ", meu, "ppplantao1");
  assert.equal(s.estado.ativo, "ppplantao1");
  assert.deepEqual(s.estado.proprios, [{ id: "ppplantao1", nome: "Plantão", base: "foco", arranjo: meu }]);
  assert.equal("foco" in s.estado.memoria, false, "o Foco não herda as mudanças que viraram o perfil novo");
  // nem fica com o que lembrava de uma saída anterior: volta a ser como veio
  const comLembranca = { ...noFoco, memoria: { ...noFoco.memoria, foco: meu } };
  const s2 = P.salvarComoPerfil(comLembranca, "Plantão", meu, "ppplantao2").estado;
  assert.equal("foco" in s2.memoria, false);
  assert.deepEqual(P.arranjoDoPerfil(s2, "foco"), P.PERFIS_PRONTOS.find((p) => p.id === "foco").arranjo);
  assert.ok("completo" in s2.memoria, "a memória dos outros perfis fica");
  assert.equal(P.perfilModificado(s.estado, meu, HREFS), false);
  assert.deepEqual(P.baseDoPerfil(s.estado, "ppplantao1"), meu);
  // sem nome, com id repetido ou no limite: nada muda
  assert.equal(P.salvarComoPerfil(noFoco, "   ", meu).estado, noFoco);
  assert.equal(P.salvarComoPerfil(s.estado, "Outro", meu, "ppplantao1").estado, s.estado);
  let cheio = E0;
  for (let i = 0; i < P.MAX_PERFIS_PROPRIOS; i++) cheio = P.salvarComoPerfil(cheio, `Perfil ${i}`, padrao, `ppcheio${String(i).padStart(2, "0")}`).estado;
  assert.equal(cheio.proprios.length, P.MAX_PERFIS_PROPRIOS);
  assert.equal(P.salvarComoPerfil(cheio, "Mais um", padrao).estado, cheio);
  // um perfil próprio feito a partir de outro próprio guarda o pronto de origem
  assert.equal(P.salvarComoPerfil(s.estado, "Neto", meu, "ppneto0001").estado.proprios[1].base, "foco");
});

teste("renomear, duplicar, atualizar e excluir um perfil próprio", () => {
  const meu = com({ inicio: "/notas" });
  let e = P.salvarComoPerfil(E0, "Meu", meu, "ppmeu00001").estado;
  e = P.renomearPerfil(e, "ppmeu00001", "Meu de verdade").estado;
  assert.equal(e.proprios[0].nome, "Meu de verdade");
  assert.equal(P.renomearPerfil(e, "foco", "Não pode").estado, e, "perfil pronto não muda de nome");
  assert.equal(P.renomearPerfil(e, "ppmeu00001", "  ").estado, e);
  // duplicar um pronto: a cópia nasce como o pronto abre hoje e não vira o perfil em uso
  const d = P.duplicarPerfil(e, "gestao", "Gestão do time", "ppcopia001").estado;
  assert.equal(d.ativo, "ppmeu00001");
  assert.deepEqual(d.proprios[1], { id: "ppcopia001", nome: "Gestão do time", base: "gestao", arranjo: P.PERFIS_PRONTOS.find((p) => p.id === "gestao").arranjo });
  // atualizar: o arranjo de agora passa a ser o original do perfil próprio
  const novo = com({ inicio: "/links" });
  const a = P.atualizarPerfilProprio(d, "ppmeu00001", novo).estado;
  assert.deepEqual(P.baseDoPerfil(a, "ppmeu00001"), novo);
  assert.equal(P.atualizarPerfilProprio(d, "foco", novo).estado, d);
  // excluir o perfil em uso leva para o pronto de onde ele veio
  const x = P.excluirPerfil(a, "ppmeu00001");
  assert.equal(x.estado.ativo, "completo");
  assert.deepEqual(x.aplicar, padrao);
  assert.deepEqual(x.estado.proprios.map((p) => p.id), ["ppcopia001"]);
  // excluir um que não está em uso não mexe na tela
  assert.equal(P.excluirPerfil(a, "ppcopia001").aplicar, undefined);
  assert.equal(P.excluirPerfil(a, "foco").estado, a, "perfil pronto não é excluído");
});

teste("listaDePerfis: os prontos e depois os próprios, com de onde cada um veio", () => {
  const e = P.salvarComoPerfil(P.trocarPerfil(E0, "estudo", padrao).estado, "Leitura", padrao, "ppleitura1").estado;
  const lista = P.listaDePerfis(e);
  assert.deepEqual(lista.map((p) => p.id), ["completo", "foco", "reunioes", "gestao", "estudo", "ppleitura1"]);
  assert.equal(lista.at(-1).proprio, true);
  assert.match(lista.at(-1).descricao, /Estudo/);
});

// ---------- quem já usava o app ----------

teste("perfisIniciais: quem nunca personalizou começa no Completo", () => {
  assert.equal(P.perfisIniciais(padrao, HREFS), P.ESTADO_INICIAL);
  assert.equal(P.perfisIniciais(com({ moldura: { ordem: [...HREFS] }, telas: { visaoTarefas: "lista" } }), HREFS), P.ESTADO_INICIAL);
});

teste("perfisIniciais: quem já tinha arrumado as barras não perde nada (vira 'Meu arranjo', em uso)", () => {
  const dele = com({ moldura: { ocultos: ["/conquistas"], ferramentasOcultas: ["agenda"] }, hoje: { primeiro: "foco" }, lateralRecolhida: true });
  const e = P.perfisIniciais(dele, HREFS, "ppinicial1");
  assert.equal(e.ativo, "ppinicial1");
  assert.deepEqual(e.proprios, [{ id: "ppinicial1", nome: "Meu arranjo", base: "completo", arranjo: dele }]);
  assert.equal(P.perfilModificado(e, dele, HREFS), false);
  // e trocar para um pronto e voltar devolve o arranjo dele
  const ida = P.trocarPerfil(e, "foco", dele);
  assert.deepEqual(P.trocarPerfil(ida.estado, "ppinicial1", ida.aplicar).aplicar, dele);
});

// ---------- código de um perfil ----------

teste("código de perfil: vai e volta, sem tema, sem nome da saudação e sem a largura", () => {
  const arr = P.PERFIS_PRONTOS.find((p) => p.id === "reunioes").arranjo;
  const texto = P.textoDoPerfil("Dia de reuniões", arr, "reunioes");
  assert.ok(texto.length < 3000, "o código é curto");
  for (const proibido of ["tema", "aparencia", "largura", '"nome":"Fulano"']) assert.equal(texto.includes(`"${proibido}"`), false, proibido);
  const lido = P.lerPerfil(`mandei por mensagem: ${texto} valeu`);
  assert.equal(lido.ok, true);
  assert.deepEqual(lido.valor, { nome: "Dia de reuniões", base: "reunioes", arranjo: arr });
});

teste("código de perfil: texto hostil ou de outro tipo é recusado com um motivo", () => {
  for (const mau of ["", "   ", "sem chaves", "{ quebrado", "[1,2]", '{"nexo":"outra-coisa"}', "x".repeat(P.TAMANHO_MAXIMO_DO_CODIGO + 1)]) {
    const r = P.lerPerfil(mau);
    assert.equal(r.ok, false, mau.slice(0, 30));
    assert.ok(r.erro.length > 10);
  }
  assert.match(P.lerPerfil('{"nexo":"personalizacao","v":1}').erro, /personalização inteira/);
  // o que vem dentro passa pelos normalizadores: nada de endereço, largura ou nome comprido
  const r = P.lerPerfil(JSON.stringify({ nexo: "perfil", nome: "<b>x</b>\n" + "y".repeat(90), base: "inventada", arranjo: { inicio: "javascript:alert(1)", moldura: { largura: 9999, ocultos: ["/links"] } } }));
  assert.equal(r.ok, true);
  assert.equal(r.valor.nome.length, P.TAMANHO_DO_NOME_DO_PERFIL);
  assert.equal(r.valor.base, "completo");
  assert.equal(r.valor.arranjo.inicio, "/");
  assert.equal("largura" in r.valor.arranjo.moldura, false);
  assert.deepEqual(r.valor.arranjo.moldura.ocultos, ["/links"]);
  assert.equal(P.lerPerfil('{"nexo":"perfil"}').valor.nome, "Perfil recebido");
});

teste("acrescentarPerfil: o perfil colado entra na lista sem virar o perfil em uso, e nome repetido ganha número", () => {
  const recebido = { nome: "Foco", base: "foco", arranjo: com({ inicio: "/notas" }) };
  const a = P.acrescentarPerfil(E0, recebido, "ppcolado01");
  assert.equal(a.estado.ativo, "completo");
  assert.equal(a.aplicar, undefined, "nada do que está em uso muda");
  assert.deepEqual(a.estado.proprios.map((p) => [p.id, p.nome, p.base]), [["ppcolado01", "Foco (2)", "foco"]]);
  const b = P.acrescentarPerfil(a.estado, recebido, "ppcolado02");
  assert.equal(b.estado.proprios[1].nome, "Foco (3)");
  assert.equal(P.acrescentarPerfil(E0, { ...recebido, nome: " " }).estado, E0);
  assert.equal(P.acrescentarPerfil(E0, { ...recebido, base: "inventada" }, "ppcolado03").estado.proprios[0].base, "completo");
});

teste("perfisParaLevar: a memória não viaja", () => {
  const e = P.trocarPerfil(P.salvarComoPerfil(E0, "Meu", padrao, "ppmeu00001").estado, "foco", com({ inicio: "/notas" })).estado;
  assert.deepEqual(Object.keys(P.perfisParaLevar(e)).sort(), ["ativo", "proprios"]);
  assert.equal(P.perfisParaLevar(e).ativo, "foco");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
