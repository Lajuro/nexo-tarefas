import type { MetadataRoute } from "next";

// Permite "instalar" o Nexo como aplicativo no Edge/Chrome (janela própria, sem barra de endereço).
// Funciona em http://127.0.0.1 porque localhost conta como contexto seguro.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexo · cérebro de tarefas",
    short_name: "Nexo",
    description: "Organizador de tarefas offline-first",
    start_url: "/",
    display: "standalone",
    background_color: "#101116",
    theme_color: "#101116",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
