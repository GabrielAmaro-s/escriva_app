import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Ícone da tela inicial do iPhone e do iPad: o símbolo oficial (docs/marca/logos/escriva-simbolo.svg).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const svg = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
  return new ImageResponse(
    // O iOS aplica a própria máscara de cantos: o fundo petróleo inteiro evita cantos pretos.
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#0E4A4F" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={180} height={180} alt="" />
    </div>,
    size,
  );
}
