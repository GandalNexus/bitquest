"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, FileImage } from "lucide-react";
import type { CertificatePayload } from "@/lib/certificates/sign";

/**
 * Composant client affiché sur /verify quand la signature est vérifiée.
 *
 * - Rend un aperçu SVG format paysage du certificat avec le logo
 *   GandalNexus (l'Orbite) et toutes les infos du payload.
 * - Deux boutons de téléchargement :
 *     1. SVG   → export vectoriel scalable, idéal pour impression.
 *     2. PNG   → bitmap 2x la résolution pour partage social / docs.
 * - Le rendu se fait 100% client — aucune route serveur, aucun secret
 *   exposé. Le certificat téléchargé est auto-contenu (texte + logo
 *   inline SVG) et ne dépend d'aucun fichier externe.
 */
export function CertificateDownload({
  payload,
  blob,
}: {
  payload: CertificatePayload;
  blob: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // URL complète de vérification — pointe sur le serveur émetteur
  // (propagé dans `payload.issuer`). Le scanner d'un QR code arrive
  // directement sur /verify avec le blob, zéro saisie manuelle.
  const verifyUrl = `https://${payload.issuer}/verify?blob=${encodeURIComponent(blob)}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(verifyUrl, {
      // Niveau H = ~30% de récupération d'erreur, nécessaire pour
      // tolérer le logo GandalNexus overlay au centre du QR sans
      // casser le décodage par les scanners.
      errorCorrectionLevel: "H",
      margin: 1,
      width: 320,
      color: {
        dark: "#0a0a0f",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // Silence : si le QR échoue (URL trop longue p.ex.) on garde le
        // certificat sans QR plutôt que de bloquer le téléchargement.
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  const slug = `bitquest-${payload.targetCode}-${payload.certificateId.slice(0, 10)}`;
  const issuedAt = new Date(payload.issuedAt);
  const formattedDate = issuedAt.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;
  const xp = typeof meta.xpEarned === "number" ? meta.xpEarned : null;
  const sats = typeof meta.satsEarned === "number" ? meta.satsEarned : null;
  const quizScore = typeof meta.quizScore === "number" ? meta.quizScore : null;
  const network = typeof meta.network === "string" ? meta.network : null;
  const missionKind = typeof meta.missionKind === "string" ? meta.missionKind : null;
  const proofTxid = typeof meta.proofTxid === "string" ? meta.proofTxid : null;

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    // Clone + XML namespace pour que le fichier .svg s'ouvre partout.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob(
      [`<?xml version="1.0" encoding="UTF-8"?>\n${source}`],
      { type: "image/svg+xml;charset=utf-8" },
    );
    triggerDownload(blob, `${slug}.svg`);
  };

  const downloadPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setExportingPng(true);
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const source = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = url;
      });
      // Render x2 for crisp PNG on retina displays / print.
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = 1200 * scale;
      canvas.height = 800 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2D unavailable");
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        triggerDownload(blob, `${slug}.png`);
      }, "image/png");
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-[#0a0a0f] shadow-xl">
        <svg
          ref={svgRef}
          viewBox="0 0 1200 800"
          className="block h-auto w-full"
          role="img"
          aria-label={`Certificat BitQuest — ${payload.targetTitle}`}
        >
          {/* Background + subtle starfield */}
          <defs>
            <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0a0a0f" />
              <stop offset="0.5" stopColor="#12121c" />
              <stop offset="1" stopColor="#0a0a0f" />
            </linearGradient>
            <radialGradient id="glow" cx="0.2" cy="0.1" r="0.6">
              <stop offset="0" stopColor="#ff9900" stopOpacity="0.14" />
              <stop offset="1" stopColor="#ff9900" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff9900" />
              <stop offset="1" stopColor="#ffd466" />
            </linearGradient>
          </defs>

          <rect width="1200" height="800" fill="url(#bg-grad)" />
          <rect width="1200" height="800" fill="url(#glow)" />

          {/* Starfield : 20 dots at pseudo-random positions */}
          {[
            [120, 140], [220, 90], [340, 180], [490, 110], [620, 70],
            [780, 150], [920, 90], [1050, 180], [1120, 70], [90, 250],
            [1080, 330], [1130, 500], [60, 480], [150, 650], [280, 720],
            [540, 740], [820, 720], [980, 690], [1100, 630], [430, 650],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i % 4 === 0 ? 2 : 1.2}
              fill={i % 5 === 0 ? "#ff9900" : "#eaeaf0"}
              opacity={i % 4 === 0 ? 0.65 : 0.35}
            />
          ))}

          {/* Decorative frame */}
          <rect
            x="30"
            y="30"
            width="1140"
            height="740"
            rx="20"
            fill="none"
            stroke="#ff9900"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          <rect
            x="44"
            y="44"
            width="1112"
            height="712"
            rx="14"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeWidth="1"
          />

          {/* Top-left : logo + wordmark */}
          <g transform="translate(70, 72)">
            {/* Orbite logo — dark-theme adaptation */}
            <g transform="scale(0.11)">
              <ellipse
                cx="256"
                cy="258"
                rx="200"
                ry="72"
                fill="none"
                stroke="#eaeaf0"
                strokeWidth="15"
                transform="rotate(-24 256 258)"
              />
              <circle cx="256" cy="258" r="112" fill="#ff9900" />
              <path
                d="M 440.8 192.1 L 438.6 201.7 L 434.0 212.1 L 427.1 223.0 L 418.0 234.4 L 406.8 246.1 L 393.7 257.9 L 378.9 269.8 L 362.4 281.5 L 344.6 292.8 L 325.6 303.8 L 305.8 314.1 L 285.3 323.8 L 264.4 332.6 L 243.4 340.4 L 222.6 347.2 L 202.2 352.8 L 182.5 357.2 L 163.8 360.3 L 146.2 362.1 L 130.1 362.6 L 115.5 361.7 L 102.8 359.5 L 92.0 356.0 L 83.4 351.2"
                fill="none"
                stroke="#eaeaf0"
                strokeWidth="15"
                strokeLinecap="round"
              />
              <circle cx="393.3" cy="154" r="16" fill="#eaeaf0" />
            </g>
            <text
              x="78"
              y="24"
              fontFamily="Orbitron, sans-serif"
              fontSize="26"
              fontWeight="700"
              fill="#eaeaf0"
            >
              Gandal<tspan fill="#ff9900">Nexus</tspan>
            </text>
            <text
              x="78"
              y="46"
              fontFamily="JetBrains Mono, monospace"
              fontSize="11"
              letterSpacing="2"
              fill="#eaeaf0"
              opacity="0.55"
            >
              BITQUEST · OPEN SOURCE · AGPL-3.0
            </text>
          </g>

          {/* Top-right : verified stamp */}
          <g transform="translate(1030, 90)">
            <rect
              x="-10"
              y="-26"
              width="110"
              height="42"
              rx="8"
              fill="#16a34a"
              fillOpacity="0.15"
              stroke="#16a34a"
              strokeOpacity="0.6"
              strokeWidth="1"
            />
            <text
              x="45"
              y="-6"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              letterSpacing="2"
              fill="#34d399"
            >
              VERIFIED
            </text>
            <text
              x="45"
              y="8"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="8"
              letterSpacing="1"
              fill="#34d399"
              opacity="0.8"
            >
              HMAC-SHA256
            </text>
          </g>

          {/* Center : headline */}
          <text
            x="600"
            y="250"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="13"
            letterSpacing="7"
            fill="#ff9900"
          >
            CERTIFICATE OF COMPLETION
          </text>
          <text
            x="600"
            y="328"
            textAnchor="middle"
            fontFamily="Orbitron, sans-serif"
            fontSize="46"
            fontWeight="700"
            fill="#eaeaf0"
            letterSpacing="-0.5"
          >
            @{payload.pseudo}
          </text>
          <text
            x="600"
            y="362"
            textAnchor="middle"
            fontFamily="Exo 2, sans-serif"
            fontSize="16"
            fill="#eaeaf0"
            opacity="0.7"
          >
            has completed the BitQuest quest
          </text>
          <text
            x="600"
            y="422"
            textAnchor="middle"
            fontFamily="Orbitron, sans-serif"
            fontSize="26"
            fontWeight="700"
            fill="url(#gold)"
          >
            {payload.targetTitle.length > 60
              ? payload.targetTitle.slice(0, 57) + "…"
              : payload.targetTitle}
          </text>
          <text
            x="600"
            y="452"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="12"
            letterSpacing="2"
            fill="#eaeaf0"
            opacity="0.45"
          >
            {payload.kind} · {payload.targetCode}
            {network ? ` · ${network.toUpperCase()}` : ""}
          </text>

          {/* Divider */}
          <line
            x1="200"
            y1="490"
            x2="1000"
            y2="490"
            stroke="#ff9900"
            strokeOpacity="0.3"
            strokeWidth="1"
          />

          {/* Metadata row — shifted left to leave room for the QR */}
          <g fontFamily="JetBrains Mono, monospace" fill="#eaeaf0">
            {xp !== null && (
              <g transform="translate(90, 540)">
                <text
                  x="0"
                  y="0"
                  fontSize="11"
                  letterSpacing="2"
                  fill="#eaeaf0"
                  opacity="0.5"
                >
                  XP EARNED
                </text>
                <text
                  x="0"
                  y="32"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="30"
                  fontWeight="700"
                  fill="#ff9900"
                >
                  {xp}
                </text>
              </g>
            )}
            {sats !== null && (
              <g transform="translate(290, 540)">
                <text
                  x="0"
                  y="0"
                  fontSize="11"
                  letterSpacing="2"
                  fill="#eaeaf0"
                  opacity="0.5"
                >
                  SATS (edu.)
                </text>
                <text
                  x="0"
                  y="32"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="30"
                  fontWeight="700"
                  fill="#ff9900"
                >
                  {sats}
                </text>
              </g>
            )}
            {quizScore !== null && (
              <g transform="translate(490, 540)">
                <text
                  x="0"
                  y="0"
                  fontSize="11"
                  letterSpacing="2"
                  fill="#eaeaf0"
                  opacity="0.5"
                >
                  QUIZ
                </text>
                <text
                  x="0"
                  y="32"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="30"
                  fontWeight="700"
                  fill="#eaeaf0"
                >
                  {quizScore}%
                </text>
              </g>
            )}
            {missionKind !== null && (
              <g transform="translate(660, 540)">
                <text
                  x="0"
                  y="0"
                  fontSize="11"
                  letterSpacing="2"
                  fill="#eaeaf0"
                  opacity="0.5"
                >
                  MISSION
                </text>
                <text
                  x="0"
                  y="32"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="30"
                  fontWeight="700"
                  fill="#eaeaf0"
                >
                  {missionKind}
                </text>
              </g>
            )}
          </g>

          {/* QR code — scan to open /verify?blob=... on any phone. The
              QR encodes the full verify URL on the issuer domain, so the
              certificate is self-sufficient : paste anywhere, scan, done. */}
          {qrDataUrl ? (
            <g transform="translate(960, 510)">
              {/* Carte blanche pour contraste scan */}
              <rect
                x="0"
                y="0"
                width="160"
                height="160"
                rx="8"
                fill="#ffffff"
              />
              {/* QR encoding full verify URL with blob */}
              <image
                href={qrDataUrl}
                x="10"
                y="10"
                width="140"
                height="140"
              />
              {/* Logo overlay GandalNexus au centre. L'error-correction
                  level H (30 %) tolère sans problème ce "trou" de ~15 %
                  de la surface QR. Cercle blanc derrière → contraste
                  net même sur scanners bas de gamme. */}
              <circle cx="80" cy="80" r="22" fill="#ffffff" />
              <circle
                cx="80"
                cy="80"
                r="22"
                fill="none"
                stroke="#ff9900"
                strokeWidth="2"
              />
              <g transform="translate(58, 58) scale(0.086)">
                <ellipse
                  cx="256"
                  cy="258"
                  rx="200"
                  ry="72"
                  fill="none"
                  stroke="#14141F"
                  strokeWidth="18"
                  transform="rotate(-24 256 258)"
                />
                <circle cx="256" cy="258" r="112" fill="#ff9900" />
                <path
                  d="M 440.8 192.1 L 438.6 201.7 L 434.0 212.1 L 427.1 223.0 L 418.0 234.4 L 406.8 246.1 L 393.7 257.9 L 378.9 269.8 L 362.4 281.5 L 344.6 292.8 L 325.6 303.8 L 305.8 314.1 L 285.3 323.8 L 264.4 332.6 L 243.4 340.4 L 222.6 347.2 L 202.2 352.8 L 182.5 357.2 L 163.8 360.3 L 146.2 362.1 L 130.1 362.6 L 115.5 361.7 L 102.8 359.5 L 92.0 356.0 L 83.4 351.2"
                  fill="none"
                  stroke="#14141F"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <circle cx="393.3" cy="154" r="16" fill="#14141F" />
              </g>
              <text
                x="80"
                y="182"
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
                letterSpacing="2"
                fill="#eaeaf0"
                opacity="0.55"
              >
                SCAN TO VERIFY
              </text>
            </g>
          ) : null}

          {/* Proof of work bar */}
          {proofTxid && (
            <g transform="translate(70, 640)">
              <text
                x="0"
                y="0"
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
                letterSpacing="2"
                fill="#eaeaf0"
                opacity="0.5"
              >
                ON-CHAIN PROOF
              </text>
              <text
                x="0"
                y="20"
                fontFamily="JetBrains Mono, monospace"
                fontSize="12"
                fill="#eaeaf0"
                opacity="0.9"
              >
                {proofTxid.slice(0, 16)}…{proofTxid.slice(-16)}
              </text>
            </g>
          )}

          {/* Bottom-left : date */}
          <g transform="translate(70, 720)">
            <text
              x="0"
              y="0"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              letterSpacing="2"
              fill="#eaeaf0"
              opacity="0.5"
            >
              ISSUED
            </text>
            <text
              x="0"
              y="20"
              fontFamily="Exo 2, sans-serif"
              fontSize="14"
              fontWeight="500"
              fill="#eaeaf0"
            >
              {formattedDate}
            </text>
          </g>

          {/* Bottom-center : issuer */}
          <g transform="translate(600, 720)">
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              letterSpacing="2"
              fill="#eaeaf0"
              opacity="0.5"
            >
              ISSUED BY
            </text>
            <text
              x="0"
              y="20"
              textAnchor="middle"
              fontFamily="Exo 2, sans-serif"
              fontSize="14"
              fontWeight="500"
              fill="#eaeaf0"
            >
              {payload.issuer}
            </text>
          </g>

          {/* Bottom-right : certificate id */}
          <g transform="translate(1130, 720)">
            <text
              x="0"
              y="0"
              textAnchor="end"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              letterSpacing="2"
              fill="#eaeaf0"
              opacity="0.5"
            >
              CERT ID
            </text>
            <text
              x="0"
              y="20"
              textAnchor="end"
              fontFamily="JetBrains Mono, monospace"
              fontSize="12"
              fill="#eaeaf0"
              opacity="0.8"
            >
              {payload.certificateId}
            </text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadSvg}
          className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Download className="h-4 w-4" aria-hidden />
          Télécharger SVG
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={exportingPng}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          <FileImage className="h-4 w-4" aria-hidden />
          {exportingPng ? "Export…" : "Télécharger PNG"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le certificat est rendu et exporté localement dans ton navigateur —
        aucun secret ne quitte le serveur. Le fichier SVG est vectoriel
        (impression A4 paysage recommandée) ; le PNG est bitmap 2400 × 1600
        pour partage réseau social / document.
      </p>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
