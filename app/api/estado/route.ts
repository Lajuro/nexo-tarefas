import { estadoApp } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
export const GET = () => tratar(() => estadoApp());
