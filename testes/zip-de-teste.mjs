// Monta um ZIP na memória, para os testes criarem planilhas, documentos e apresentações de mentira sem
// depender de arquivo binário no repositório. Usado por testes/arquivos.test.mjs e por testes/e2e.cjs.
// Só para teste: o app nunca escreve ZIP.

import zlib from "node:zlib";

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

/** `arquivos`: { "caminho/no/zip.xml": "texto" | Buffer }. `opcoes.semCompactar`: guarda sem deflate. */
export function montarZip(arquivos, opcoes = {}) {
  const locais = [];
  const centrais = [];
  let pos = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, "utf8");
    const guardar = opcoes.semCompactar || nome.endsWith("/");
    const corpo = guardar ? dados : zlib.deflateRawSync(dados);
    const n = Buffer.from(nome, "utf8");
    const comum = [u16(20), u16(0x0800), u16(guardar ? 0 : 8), u16(0), u16(0), u32(zlib.crc32(dados)), u32(corpo.length), u32(dados.length), u16(n.length), u16(0)];
    const local = Buffer.concat([u32(0x04034b50), ...comum, n, corpo]);
    centrais.push(Buffer.concat([u32(0x02014b50), u16(20), ...comum, u16(0), u16(0), u16(0), u32(0), u32(pos), n]));
    locais.push(local);
    pos += local.length;
  }
  const indice = Buffer.concat(centrais);
  const fim = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(centrais.length), u16(centrais.length), u32(indice.length), u32(pos), u16(0)]);
  return new Uint8Array(Buffer.concat([...locais, indice, fim]));
}

const X = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const letra = (i) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/**
 * Uma planilha .xlsx mínima. `abas`: [{ nome, linhas: [[celula, ...]], oculta? }]. Célula: texto (vai para os
 * textos compartilhados), número, booleano, null (vazia) ou { v, s } (número com o estilo s: 1 = data,
 * 2 = percentual, 3 = data e hora, 4 = hora) ou { f: "texto de fórmula" }.
 */
export function montarXlsx(abas, opcoes = {}) {
  const textos = [];
  const indiceDoTexto = (t) => { let i = textos.indexOf(t); if (i < 0) { i = textos.length; textos.push(t); } return i; };
  const arquivos = {};
  abas.forEach((aba, k) => {
    const linhas = aba.linhas.map((linha, r) => {
      const celulas = linha.map((c, col) => {
        const ref = `${letra(col)}${r + 1}`;
        if (c === null || c === undefined || c === "") return "";
        if (typeof c === "string") return `<c r="${ref}" t="s"><v>${indiceDoTexto(c)}</v></c>`;
        if (typeof c === "boolean") return `<c r="${ref}" t="b"><v>${c ? 1 : 0}</v></c>`;
        if (typeof c === "number") return `<c r="${ref}"><v>${c}</v></c>`;
        if ("f" in c) return `<c r="${ref}" t="str"><f>A1</f><v>${X(c.f)}</v></c>`;
        if ("embutido" in c) return `<c r="${ref}" t="inlineStr"><is><t>${X(c.embutido)}</t></is></c>`;
        return `<c r="${ref}" s="${c.s}"><v>${c.v}</v></c>`;
      }).join("");
      return celulas ? `<row r="${r + 1}">${celulas}</row>` : "";
    }).join("");
    arquivos[`xl/worksheets/sheet${k + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhas}</sheetData></worksheet>`;
  });
  arquivos["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${opcoes.base1904 ? '<workbookPr date1904="1"/>' : ""}<sheets>${abas.map((a, k) => `<sheet name="${X(a.nome)}" sheetId="${k + 1}"${a.oculta ? ' state="hidden"' : ""} r:id="rId${k + 1}"/>`).join("")}</sheets></workbook>`;
  arquivos["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join("")}</Relationships>`;
  arquivos["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${textos.map((t) => `<si><t xml:space="preserve">${X(t)}</t></si>`).join("")}</sst>`;
  arquivos["xl/styles.xml"] = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts><cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="10"/><xf numFmtId="164"/><xf numFmtId="20"/></cellXfs></styleSheet>`;
  arquivos["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;
  return montarZip(arquivos, opcoes);
}

/** Um .docx mínimo a partir do miolo de <w:body>. */
export function montarDocx(corpo) {
  return montarZip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:sectPr/></w:body></w:document>`,
  });
}

/** Um .pptx mínimo. `slides`: [{ titulo, linhas: [] }], na ordem da apresentação (os arquivos ficam em outra ordem de propósito). */
export function montarPptx(slides) {
  const arquivos = {};
  const n = slides.length;
  slides.forEach((s, i) => {
    const arquivo = n - i; // o primeiro slide da apresentação é o último arquivo: quem lê pelo nome erra a ordem
    arquivos[`ppt/slides/slide${arquivo}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${X(s.titulo)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody>${s.linhas.map((l) => `<a:p><a:r><a:t>${X(l)}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  });
  arquivos["ppt/presentation.xml"] = `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst></p:presentation>`;
  arquivos["ppt/_rels/presentation.xml.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="slide" Target="slides/slide${n - i}.xml"/>`).join("")}</Relationships>`;
  return montarZip(arquivos);
}

/** Um PDF de uma página, válido, com um texto. */
export function montarPdf(texto = "Nexo") {
  const partes = ["%PDF-1.4\n"];
  const pos = [];
  const obj = (s) => { pos.push(partes.join("").length); partes.push(s); };
  const fluxo = `BT /F1 24 Tf 72 720 Td (${texto.replace(/[()\\]/g, "")}) Tj ET`;
  obj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  obj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  obj(`4 0 obj\n<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream\nendobj\n`);
  obj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const inicioDaTabela = partes.join("").length;
  partes.push(`xref\n0 6\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`);
  return new Uint8Array(Buffer.from(partes.join(""), "latin1"));
}
