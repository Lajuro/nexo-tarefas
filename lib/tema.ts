// Fica fora de components/Raiz.tsx porque o layout (servidor) precisa da string de verdade,
// e exports de um arquivo "use client" chegam ao servidor só como referência.

/** Roda antes da primeira pintura (inline no <head>) para não piscar o tema errado. */
export const SCRIPT_TEMA = `(function(){try{var t=JSON.parse(localStorage.getItem("nexo:tema")||'"sistema"');var e=t==="escuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e)}catch(_){}})()`;
