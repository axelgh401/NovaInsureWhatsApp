import { ChangeEvent, FormEvent, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";

type ApiTimingBreakdown = {
  etapa: string | null;
  duracion_ms: number | null;
  intento_1_ms: number | null;
  reintento_ms: number | null;
  reintento_ejecutado: boolean | null;
  descripcion: string | null;
};

type ApiTimingData = {
  total_ms: number | null;
  total_seconds: number | null;
  entrega_ms: number | null;
  flowise_ms: number | null;
  devolucion_ms: number | null;
  reintento_ejecutado: boolean | null;
  breakdown: ApiTimingBreakdown[];
};

type ApiTiming = ApiTimingData & {
  topLevel: ApiTimingData;
  time: ApiTimingData | null;
  time_ms: string | null;
  time_flowise_ms: string | null;
  time_summary: string | null;
};

type ApiResponse = {
  success?: boolean | string;
  message?: string;
  human_attention?: boolean | string;
  intent?: string | number;
  agent?: string | number;
  phase?: string | number;
  sessionId?: string | number;
  error?: string;
  code?: string;
  source?: string;
  detail?: string;
  requestId?: string;
  upstreamStatus?: number;
  timing?: ApiTiming | null;
};

type RequestFailure = {
  title: string;
  message: string;
  source: string;
  code: string;
  requestId: string;
  httpStatus: number | null;
  detail: string | null;
};

type TrackedTurn = {
  id: string;
  requestId: string;
  profileId: string;
  question: string;
  profileName: string;
  phone: string;
  branch: string;
  universe: string | null;
  caseNumber: string | null;
  response: string;
  startedAt: string;
  completedAt: string | null;
  latencyMs: number | null;
  apiTiming: ApiTiming | null;
  httpStatus: number | null;
  apiSuccess: boolean | null;
  humanAttention: boolean | null;
  intent: string | null;
  agent: string | null;
  phase: string | null;
  sessionId: string | null;
  error: string | null;
  errorSource: string | null;
  errorCode: string | null;
  errorDetail: string | null;
};

function responseFlag(value: ApiResponse["success"]): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function responseValue(value: string | number | undefined): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function apiTimingData(record: Record<string, unknown>): ApiTimingData {
  const breakdown = Array.isArray(record.breakdown)
    ? record.breakdown.flatMap((item): ApiTimingBreakdown[] => {
        const entry = objectValue(item);
        if (!entry) return [];
        return [{
          etapa: stringValue(entry.etapa),
          duracion_ms: numberValue(entry.duracion_ms),
          intento_1_ms: numberValue(entry.intento_1_ms),
          reintento_ms: numberValue(entry.reintento_ms),
          reintento_ejecutado: booleanValue(entry.reintento_ejecutado),
          descripcion: stringValue(entry.descripcion),
        }];
      })
    : [];
  return {
    total_ms: numberValue(record.total_ms),
    total_seconds: numberValue(record.total_seconds),
    entrega_ms: numberValue(record.entrega_ms),
    flowise_ms: numberValue(record.flowise_ms),
    devolucion_ms: numberValue(record.devolucion_ms),
    reintento_ejecutado: booleanValue(record.reintento_ejecutado),
    breakdown,
  };
}

function hasApiTimingData(timing: ApiTimingData) {
  return (
    timing.total_ms !== null ||
    timing.total_seconds !== null ||
    timing.entrega_ms !== null ||
    timing.flowise_ms !== null ||
    timing.devolucion_ms !== null ||
    timing.reintento_ejecutado !== null ||
    timing.breakdown.length > 0
  );
}

function apiTimingValue(record: Record<string, unknown>): ApiTiming | null {
  const topLevel = apiTimingData(record);
  const timeRecord = objectValue(record.time);
  const time = timeRecord ? apiTimingData(timeRecord) : null;
  const breakdown = time?.breakdown.length ? time.breakdown : topLevel.breakdown;
  const timing: ApiTiming = {
    total_ms: time?.total_ms ?? topLevel.total_ms,
    total_seconds: time?.total_seconds ?? topLevel.total_seconds,
    entrega_ms: time?.entrega_ms ?? topLevel.entrega_ms,
    flowise_ms: time?.flowise_ms ?? topLevel.flowise_ms,
    devolucion_ms: time?.devolucion_ms ?? topLevel.devolucion_ms,
    reintento_ejecutado: time?.reintento_ejecutado ?? topLevel.reintento_ejecutado,
    breakdown,
    topLevel,
    time,
    time_ms: stringValue(record.time_ms ?? timeRecord?.time_ms),
    time_flowise_ms: stringValue(record.time_flowise_ms ?? timeRecord?.time_flowise_ms),
    time_summary: stringValue(record.time_summary ?? timeRecord?.time_summary),
  };
  const hasTimingData =
    hasApiTimingData(topLevel) ||
    (time !== null && hasApiTimingData(time)) ||
    timing.time_ms !== null ||
    timing.time_flowise_ms !== null ||
    timing.time_summary !== null;
  return hasTimingData ? timing : null;
}

function responseObject(value: unknown): ApiResponse | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const textOrNumber = (field: unknown): string | number | undefined =>
    typeof field === "string" || typeof field === "number" ? field : undefined;
  const textField = (field: unknown): string | undefined => {
    if (typeof field === "string") return field;
    if (Array.isArray(field)) {
      return field
        .map((item) => (typeof item === "string" ? item : String(item ?? "")))
        .join("\n");
    }
    return typeof field === "number" ? String(field) : undefined;
  };
  return {
    success:
      typeof record.success === "boolean" || typeof record.success === "string"
        ? record.success
        : undefined,
    message: textField(record.message),
    human_attention:
      typeof record.human_attention === "boolean" || typeof record.human_attention === "string"
        ? record.human_attention
        : undefined,
    intent: textOrNumber(record.intent),
    agent: textOrNumber(record.agent),
    phase: textOrNumber(record.phase),
    sessionId: textOrNumber(record.sessionId),
    error: textField(record.error),
    code: typeof record.code === "string" ? record.code : undefined,
    source: typeof record.source === "string" ? record.source : undefined,
    detail: textField(record.detail),
    requestId: typeof record.requestId === "string" ? record.requestId : undefined,
    upstreamStatus: typeof record.upstreamStatus === "number" ? record.upstreamStatus : undefined,
    timing: apiTimingValue(record),
  };
}

const BOT_REQUEST_TIMEOUT_MS = 285_000;
const CLIENT_REQUEST_TIMEOUT_MS = 310_000;

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes} min ${String(remainingSeconds).padStart(2, "0")} s`
    : `${remainingSeconds} s`;
}

function formatReportedDuration(milliseconds: number | null | undefined) {
  return milliseconds === null || milliseconds === undefined
    ? "No reportado"
    : `${milliseconds.toLocaleString("es-MX")} ms`;
}

function apiRetryInfo(timing: ApiTiming | null) {
  const stageRetries =
    timing?.breakdown.flatMap((stage, index) =>
      stage.reintento_ejecutado === null
        ? []
        : [{ index, stage: stage.etapa ?? "etapa", executed: stage.reintento_ejecutado }],
    ) ?? [];
  const primary = timing?.reintento_ejecutado !== null && timing?.reintento_ejecutado !== undefined
    ? { label: "Reintento general", executed: timing.reintento_ejecutado }
    : stageRetries[0]
      ? { label: `Reintento · ${stageRetries[0].stage}`, executed: stageRetries[0].executed }
      : null;
  const additionalStages = timing?.reintento_ejecutado !== null ? stageRetries : stageRetries.slice(1);
  return { primary, additionalStages };
}

function describeHttpFailure(
  response: Response,
  data: ApiResponse | null,
  requestId: string,
): RequestFailure {
  const code =
    data?.code ||
    (response.ok && (responseFlag(data?.success) === false || Boolean(data?.error))
      ? "BOT_REPORTED_FAILURE"
      : "HTTP_REQUEST_FAILED");
  const source =
    data?.source ||
    response.headers.get("x-nova-error-source") ||
    (response.ok ? "bot" : "simulator");
  const sourceLabel =
    source === "bot"
      ? "Servicio del bot Nova"
      : source === "simulator"
        ? "Servidor del simulador"
        : source;
  const detail = data?.detail || data?.error || data?.message || null;

  if (code === "BOT_TIMEOUT") {
    return {
      title: "Tiempo de espera en el bot",
      message:
        `El bot no respondió en el tiempo límite (${formatElapsed(BOT_REQUEST_TIMEOUT_MS / 1000)}). Es una demora del servicio, no de tu conexión. Verifica si el mensaje se procesó antes de reenviar.`,
      source: sourceLabel,
      code,
      requestId: data?.requestId || requestId,
      httpStatus: response.status,
      detail,
    };
  }

  if (code === "BOT_CONNECTION_FAILED") {
    return {
      title: "Error de conexión con el bot",
      message:
        "El simulador no logró comunicarse con el bot. Es un problema interno del sistema, no de tu conexión local.",
      source: sourceLabel,
      code,
      requestId: data?.requestId || requestId,
      httpStatus: response.status,
      detail,
    };
  }

  if (code === "BOT_REPORTED_FAILURE") {
    return {
      title: "Fallo interno en el bot",
      message:
        "Hay conexión con el bot, pero reportó un error al intentar procesar la solicitud.",
      source: sourceLabel,
      code,
      requestId: data?.requestId || requestId,
      httpStatus: response.status,
      detail,
    };
  }

  if (source === "bot") {
    return {
      title: "Error en respuesta del bot",
      message: `El bot respondió indicando que falló al procesar la solicitud (Error HTTP ${response.status}).`,
      source: sourceLabel,
      code,
      requestId: data?.requestId || requestId,
      httpStatus: response.status,
      detail,
    };
  }

  if (response.status >= 500) {
    return {
      title: "Error interno del servidor",
      message: `Ocurrió un fallo inesperado en el servidor del simulador al procesar la solicitud (Error HTTP ${response.status}).`,
      source: sourceLabel,
      code,
      requestId: data?.requestId || requestId,
      httpStatus: response.status,
      detail,
    };
  }

  return {
    title: "Solicitud rechazada",
    message:
      data?.message ||
      data?.error ||
      `El servidor respondió con un error (HTTP ${response.status}).`,
    source: sourceLabel,
    code,
    requestId: data?.requestId || requestId,
    httpStatus: response.status,
    detail,
  };
}

function formatLatency(latencyMs: number | null) {
  if (latencyMs === null) return "En curso";
  return latencyMs < 1000 ? `${Math.round(latencyMs)} ms` : `${(latencyMs / 1000).toFixed(1)} s`;
}

function getTurnStatus(turn: TrackedTurn): "pending" | "success" | "failed" | "unverified" {
  if (turn.latencyMs === null) return "pending";
  if (
    turn.error !== null ||
    (turn.httpStatus !== null && (turn.httpStatus < 200 || turn.httpStatus >= 300)) ||
    turn.apiSuccess === false
  ) {
    return "failed";
  }
  return turn.apiSuccess === true ? "success" : "unverified";
}

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
  status?: "sending" | "sent" | "error" | "local";
  media?: {
    kind: "audio" | "image";
    name: string;
    url: string;
    mimeType: string;
  };
};

type Profile = {
  id: string;
  emoji: string;
  name: string;
  phone: string;
  type: "client" | "prospect";
  universes: string[];
};

type EvidenceMetadata = {
  profileId: string;
  profileName: string;
  phone: string;
  branch: string;
  universe: string | null;
  caseNumber: string | null;
};

const PROFILES: Profile[] = [
  {
    id: "adrian",
    emoji: "👤",
    name: "Adrian Gonzalo Silva Ortiz",
    phone: "+5493813544275",
    type: "client",
    universes: ["Clientes con póliza activa de coche", "Clientes en general"],
  },
  {
    id: "axel",
    emoji: "🧑‍💻",
    name: "Axel F Green",
    phone: "+529681198133",
    type: "client",
    universes: ["Clientes con póliza activa de coche", "Clientes en general"],
  },
  {
    id: "oscar",
    emoji: "🧔",
    name: "Oscar Tellez",
    phone: "+19123109148",
    type: "client",
    universes: [
      "Clientes con póliza activa de coche",
      "Clientes con una póliza activa dif coche",
      "Clientes mas de una póliza activa",
      "Clientes en general",
      "Clientes con póliza inactiva",
      "Clientes con póliza vencida",
    ],
  },
  {
    id: "danny-j-almeida-ortiz",
    emoji: "👤",
    name: "Danny J Almeida Ortiz",
    phone: "+19127302823",
    type: "client",
    universes: ["Clientes con póliza activa de coche", "Clientes en general"],
  },
  {
    id: "aaron-g-smith",
    emoji: "👤",
    name: "Aaron G Smith",
    phone: "+19127300021",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto"],
  },
  {
    id: "tomas-ortega",
    emoji: "👤",
    name: "Tomas Ortega",
    phone: "+19154401029",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto"],
  },
  {
    id: "samuel-perez-diaz",
    emoji: "👤",
    name: "Samuel Perez Diaz",
    phone: "+525543717323",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto"],
  },
  {
    id: "maria-contreras",
    emoji: "👤",
    name: "Maria Contreras",
    phone: "+19125551010",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos dif auto"],
  },
  {
    id: "robert-johnson",
    emoji: "👤",
    name: "Robert Johnson",
    phone: "+19125552020",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos dif auto"],
  },
  {
    id: "william-bradley",
    emoji: "👤",
    name: "William Bradley",
    phone: "+19125553030",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto"],
  },
  {
    id: "jorge-fernandez",
    emoji: "👤",
    name: "Jorge Fernandez",
    phone: "+19125554040",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto", "Prospectos dif auto"],
  },
  {
    id: "elena-montes",
    emoji: "👤",
    name: "Elena Montes",
    phone: "+19125555050",
    type: "prospect",
    universes: ["Prospectos general", "Prospectos auto"],
  },
];

const ENDPOINT = "/api/nova";

function evidenceMetadataLines(metadata: EvidenceMetadata) {
  return [
    `Perfil: ${metadata.profileName}`,
    `Teléfono: ${metadata.phone || "Sin definir"}`,
    `Rama: ${metadata.branch}`,
    `Universo: ${metadata.universe || "No aplica"}`,
    `Número de caso: ${metadata.caseNumber || "No indicado"}`,
  ];
}

function createEvidenceMetadataElement(metadata: EvidenceMetadata) {
  const section = document.createElement("section");
  section.className = "evidence-metadata";
  section.setAttribute("aria-label", "Metadatos de la prueba");

  const heading = document.createElement("strong");
  heading.textContent = "Datos de la prueba";
  section.append(heading);

  const list = document.createElement("dl");
  list.className = "evidence-metadata-grid";
  const fields = [
    ["Perfil", metadata.profileName],
    ["Teléfono", metadata.phone || "Sin definir"],
    ["Rama", metadata.branch],
    ["Universo", metadata.universe || "No aplica"],
    ["Número de caso", metadata.caseNumber || "No indicado"],
  ];
  fields.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "evidence-metadata-item";
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    item.append(term, detail);
    list.append(item);
  });
  section.append(list);
  return section;
}

function currentTime() {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function formatInlineWhatsApp(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenPattern =
    /```([^`\n]+)```|`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])|~([^~\n]+)~/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
    const key = `${match.index}-${match[0]}`;
    if (match[1] || match[2]) {
      parts.push(<code className="whatsapp-code" key={key}>{content}</code>);
    } else if (match[3]) {
      parts.push(<strong key={key}>{formatInlineWhatsApp(content)}</strong>);
    } else if (match[4]) {
      parts.push(<strong key={key}>{formatInlineWhatsApp(content)}</strong>);
    } else if (match[5]) {
      parts.push(<em key={key}>{formatInlineWhatsApp(content)}</em>);
    } else {
      parts.push(<del key={key}>{formatInlineWhatsApp(content)}</del>);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

function formatWhatsAppMessage(text: string): ReactNode {
  const lines = text.split(/\n/);
  return lines.map((line, index) => {
    const normalizedLine = line.trimEnd();
    const hasListMarker = /^\s*(?:[-*•]|\d+\.)\s+/u.test(normalizedLine);
    const hasHashMarker = /^\s*#\S/u.test(normalizedLine);

    return (
      <Fragment key={`${index}-${normalizedLine}`}>
        {hasListMarker || hasHashMarker ? (
          <span className="whatsapp-line whatsapp-list-line">{formatInlineWhatsApp(normalizedLine)}</span>
        ) : (
          formatInlineWhatsApp(normalizedLine)
        )}
        {index < lines.length - 1 && <br />}
      </Fragment>
    );
  });
}

function App() {
  const [selectedProfile, setSelectedProfile] = useState("oscar");
  const [selectedUniverse, setSelectedUniverse] = useState("Clientes en general");
  const [customPhone, setCustomPhone] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<TrackedTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isExporting, setIsExporting] = useState<
    "png" | "jpeg" | "txt" | "tracking-png" | "tracking-txt" | null
  >(null);
  const [error, setError] = useState("");
  const [requestFailure, setRequestFailure] = useState<RequestFailure | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const chatExportRef = useRef<HTMLDivElement>(null);
  const metricsExportRef = useRef<HTMLElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
  const selectedProfileData = PROFILES.find((profile) => profile.id === selectedProfile);
  const phone = selectedProfileData?.phone || customPhone;
  const trackedProfile = selectedProfileData?.name || "Perfil personalizado";
  const evidenceMetadata: EvidenceMetadata = {
    profileId: selectedProfile,
    profileName: trackedProfile,
    phone: phone.trim(),
    branch: selectedProfileData
      ? selectedProfileData.type === "client" ? "Cliente" : "No Cliente"
      : "Custom",
    universe: selectedProfileData ? selectedUniverse : null,
    caseNumber: caseNumber.trim() || null,
  };

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isSending]);

  useEffect(
    () => () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function clearErrors() {
    setError("");
    setRequestFailure(null);
  }

  function showLocalError(message: string) {
    setRequestFailure(null);
    setError(message);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedPhone || !trimmedMessage || isSending) return;
    clearErrors();
    setMessage("");
    const outgoingId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: outgoingId,
        text: trimmedMessage,
        sender: "user",
        time: currentTime(),
        status: "sending",
      },
    ]);
    const turnId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const turnMetadata = { ...evidenceMetadata };
    setTurns((current) => [
      ...current,
      {
        id: turnId,
        requestId,
        question: trimmedMessage,
        ...turnMetadata,
        response: "",
        startedAt,
        completedAt: null,
        latencyMs: null,
        apiTiming: null,
        httpStatus: null,
        apiSuccess: null,
        humanAttention: null,
        intent: null,
        agent: null,
        phase: null,
        sessionId: null,
        error: null,
        errorSource: null,
        errorCode: null,
        errorDetail: null,
      },
    ]);
    setIsSending(true);
    const requestStartedAt = performance.now();
    const requestController = new AbortController();
    let clientTimedOut = false;
    const timeout = window.setTimeout(() => {
      clientTimedOut = true;
      requestController.abort();
    }, CLIENT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: requestController.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({ phone: trimmedPhone, message: trimmedMessage }),
      });
      const contentType = response.headers.get("content-type") || "";
      const responseText = await response.text();
      let payload: unknown = responseText;
      if (contentType.includes("application/json") && responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = responseText;
        }
      }
      const responseData = responseObject(payload);
      const latencyMs = performance.now() - requestStartedAt;
      const botText =
        responseData?.message ||
        (typeof payload === "string" && response.ok
          ? payload
          : response.ok
            ? "El bot no devolvió un mensaje."
            : "");
      const apiSuccess = responseFlag(responseData?.success);
      const businessError = response.ok && (apiSuccess === false || Boolean(responseData?.error));
      const requestError = !response.ok
        ? responseData?.error || responseData?.message || `La API respondió con HTTP ${response.status}.`
        : businessError
          ? responseData?.error || responseData?.message || "El chatbot indicó que la solicitud no fue exitosa."
          : null;
      const failure = requestError
        ? describeHttpFailure(response, responseData, requestId)
        : null;

      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                response: botText || (typeof payload === "string" ? payload : JSON.stringify(payload)),
                completedAt: new Date().toISOString(),
                latencyMs,
                apiTiming: responseData?.timing ?? null,
                httpStatus: response.status,
                apiSuccess,
                humanAttention: responseFlag(responseData?.human_attention),
                intent: responseValue(responseData?.intent),
                agent: responseValue(responseData?.agent),
                phase: responseValue(responseData?.phase),
                sessionId: responseValue(responseData?.sessionId),
                error: failure?.message || null,
                errorSource: failure?.source || null,
                errorCode: failure?.code || null,
                errorDetail: failure?.detail || null,
              }
            : turn,
        ),
      );

      setMessages((current) => {
        const updated = current.map((item) =>
          item.id === outgoingId
            ? { ...item, status: requestError ? ("error" as const) : ("sent" as const) }
            : item,
        );
        return botText
          ? updated.concat({
              id: crypto.randomUUID(),
              text: botText,
              sender: "bot" as const,
              time: currentTime(),
            })
          : updated;
      });
      if (failure) setRequestFailure(failure);
    } catch (requestError) {
      const detail =
        requestError instanceof Error
          ? requestError.message
          : "No fue posible contactar al bot.";
      const latencyMs = performance.now() - requestStartedAt;
      const failure: RequestFailure = clientTimedOut
        ? {
            title: "Tiempo de espera en el navegador",
            message:
              "El navegador superó el tiempo máximo de espera sin respuesta del simulador. Revisa tu conexión antes de reintentar.",
            source: "Conexión del navegador con el servidor del simulador",
            code: "SIMULATOR_REQUEST_TIMEOUT",
            requestId,
            httpStatus: null,
            detail,
          }
        : {
            title: "Fallo de red local",
            message:
              "No se pudo conectar con el simulador. Revisa tu internet o VPN, o el servicio podría estar inactivo temporalmente.",
            source: "Conexión del navegador con el servidor del simulador",
            code: "SIMULATOR_CONNECTION_FAILED",
            requestId,
            httpStatus: null,
            detail,
          };
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                response: "",
                completedAt: new Date().toISOString(),
                latencyMs,
                apiTiming: null,
                error: failure.message,
                errorSource: failure.source,
                errorCode: failure.code,
                errorDetail: failure.detail,
              }
            : turn,
        ),
      );
      setMessages((current) =>
        current.map((item) =>
          item.id === outgoingId ? { ...item, status: "error" as const } : item,
        ),
      );
      setRequestFailure(failure);
    } finally {
      window.clearTimeout(timeout);
      setIsSending(false);
    }
  }

  function clearConversation() {
    attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    attachmentUrlsRef.current = [];
    setMessages([]);
    setTurns([]);
    clearErrors();
  }

  function addMediaFiles(event: ChangeEvent<HTMLInputElement>, kind: "audio" | "image") {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((file) => file.type.startsWith(`${kind}/`));
    if (validFiles.length !== files.length) {
      showLocalError(`Solo se pueden agregar archivos de ${kind === "audio" ? "audio" : "imagen"}.`);
    } else {
      clearErrors();
    }
    if (validFiles.length === 0) return;

    const newMessages = validFiles.map((file): ChatMessage => {
      const url = URL.createObjectURL(file);
      attachmentUrlsRef.current.push(url);
      return {
        id: crypto.randomUUID(),
        text: "",
        sender: "user",
        time: currentTime(),
        status: "local",
        media: { kind, name: file.name, url, mimeType: file.type },
      };
    });
    setMessages((current) => [...current, ...newMessages]);
  }

  function handleProfileChange(profileId: string) {
    setSelectedProfile(profileId);
    const nextProfile = PROFILES.find((profile) => profile.id === profileId);
    const generalUniverse = nextProfile?.universes.find((universe) =>
      universe === "Clientes en general" || universe === "Prospectos general"
    );
    setSelectedUniverse(generalUniverse || nextProfile?.universes[0] || "");
    clearErrors();
  }

  async function exportConversation(format: "png" | "jpeg") {
    const chat = chatExportRef.current;
    if (!chat || messages.length === 0 || isExporting) return;

    setIsExporting(format);
    clearErrors();
    const stage = document.createElement("div");
    stage.className = "conversation-export-stage";

    try {
      await document.fonts.ready;
      const chatClone = chat.cloneNode(true) as HTMLElement;
      const conversationClone = chatClone.querySelector<HTMLElement>(".conversation");
      const conversationHeight = conversationRef.current?.scrollHeight ?? 0;
      chatClone.style.width = `${chat.clientWidth}px`;
      chatClone.style.height = "auto";
      chatClone.style.minHeight = "0";
      chatClone.style.maxHeight = "none";
      chatClone.style.flex = "none";
      chatClone.style.overflow = "visible";
      conversationClone?.style.setProperty("height", `${conversationHeight}px`);
      conversationClone?.style.setProperty("min-height", "0");
      conversationClone?.style.setProperty("max-height", "none");
      conversationClone?.style.setProperty("flex", "none");
      conversationClone?.style.setProperty("overflow", "visible");
      chatClone.prepend(createEvidenceMetadataElement(evidenceMetadata));
      stage.append(chatClone);
      document.body.append(stage);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const fullHeight = chatClone.scrollHeight;
      const options = {
        backgroundColor: "#efeae2",
        pixelRatio: 2,
        width: chatClone.scrollWidth,
        height: fullHeight,
        style: {
          height: `${fullHeight}px`,
          maxHeight: "none",
          overflow: "visible",
        },
      };
      const dataUrl =
        format === "png"
          ? await toPng(chatClone, options)
          : await toJpeg(chatClone, { ...options, quality: 0.95 });
      const link = document.createElement("a");
      link.download = `nova-insure-conversacion-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (exportError) {
      const detail =
        exportError instanceof Error
          ? exportError.message
          : "No fue posible generar la imagen.";
      showLocalError(`No se pudo exportar la conversación: ${detail}`);
    } finally {
      stage.remove();
      setIsExporting(null);
    }
  }

  function exportConversationAsText() {
    if (messages.length === 0 || isExporting) return;

    setIsExporting("txt");
    clearErrors();

    try {
      const transcript = [
        "NOVA INSURE · CONVERSACIÓN DE WHATSAPP",
        ...evidenceMetadataLines(evidenceMetadata),
        `Fecha de exportación: ${new Intl.DateTimeFormat("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date())}`,
        "",
        ...messages.flatMap((item) => [
          `[${item.time}] ${item.sender === "user" ? "REMITENTE · TÚ" : "RECEPTOR · NOVA INSURE"}`,
          item.media
            ? `[Adjunto local no enviado al bot: ${item.media.kind === "audio" ? "audio" : "imagen"} · ${item.media.name}]`
            : item.text,
          "",
        ]),
      ].join("\n");
      const blob = new Blob(["\ufeff", transcript], {
        type: "text/plain;charset=utf-8",
      });
      const link = document.createElement("a");
      link.download = `nova-insure-conversacion-${new Date().toISOString().slice(0, 10)}.txt`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (exportError) {
      const detail =
        exportError instanceof Error
          ? exportError.message
          : "No fue posible generar el archivo de texto.";
      showLocalError(`No se pudo exportar la conversación: ${detail}`);
    } finally {
      setIsExporting(null);
    }
  }

  async function exportConversationWithTrackingAsPng() {
    const chat = chatExportRef.current;
    const metrics = metricsExportRef.current;
    if (!chat || !metrics || messages.length === 0 || isExporting) return;

    setIsExporting("tracking-png");
    clearErrors();
    const stage = document.createElement("div");
    stage.className = "tracking-export-stage";

    try {
      await document.fonts.ready;

      const chatClone = chat.cloneNode(true) as HTMLElement;
      const metricsClone = metrics.cloneNode(true) as HTMLElement;
      const conversationClone = chatClone.querySelector<HTMLElement>(".conversation");
      const chatHeaderClone = chatClone.querySelector<HTMLElement>(".chat-header");
      const turnListClone = metricsClone.querySelector<HTMLElement>(".turn-list");
      const conversationHeight = conversationRef.current?.scrollHeight ?? 0;
      const chatHeight = (chatHeaderClone?.offsetHeight ?? 0) + conversationHeight;

      metricsClone.prepend(createEvidenceMetadataElement(evidenceMetadata));
      chatClone.classList.add("tracking-export-chat");
      chatClone.style.height = `${chatHeight}px`;
      chatClone.style.minHeight = "0";
      chatClone.style.maxHeight = "none";
      chatClone.style.overflow = "hidden";

      if (conversationClone) {
        conversationClone.style.height = `${conversationHeight}px`;
        conversationClone.style.minHeight = "0";
        conversationClone.style.maxHeight = "none";
        conversationClone.style.flex = "none";
        conversationClone.style.overflow = "visible";
      }

      metricsClone.classList.add("tracking-export-metrics");
      metricsClone.style.height = "auto";
      metricsClone.style.minHeight = "0";
      metricsClone.style.maxHeight = "none";
      metricsClone.style.overflow = "visible";
      metricsClone.style.alignSelf = "stretch";

      if (turnListClone) {
        turnListClone.style.height = "auto";
        turnListClone.style.minHeight = "0";
        turnListClone.style.maxHeight = "none";
        turnListClone.style.flex = "none";
        turnListClone.style.overflow = "visible";
      }

      stage.append(chatClone, metricsClone);
      document.body.append(stage);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const height = stage.scrollHeight;
      const dataUrl = await toPng(stage, {
        backgroundColor: "#edf4f1",
        pixelRatio: 1.5,
        width: stage.scrollWidth,
        height,
        style: {
          height: `${height}px`,
          maxHeight: "none",
          overflow: "visible",
        },
      });
      const link = document.createElement("a");
      link.download = `nova-insure-conversacion-tracking-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (exportError) {
      const detail =
        exportError instanceof Error
          ? exportError.message
          : "No fue posible generar la imagen.";
      showLocalError(`No se pudo exportar conversación y tracking como PNG: ${detail}`);
    } finally {
      stage.remove();
      setIsExporting(null);
    }
  }

  function exportConversationWithTrackingAsText() {
    if (messages.length === 0 || isExporting) return;

    setIsExporting("tracking-txt");
    clearErrors();

    try {
      const exportDate = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date());
      const conversation = messages.flatMap((item, index) => [
        `${index + 1}. [${item.time}] ${item.sender === "user" ? "REMITENTE · TÚ" : "RECEPTOR · NOVA INSURE"}`,
        item.media
          ? `[Adjunto local no enviado al bot: ${item.media.kind === "audio" ? "audio" : "imagen"} · ${item.media.name}]`
          : item.text,
        "",
      ]);
      const turnReports = trackedTurns.map((turn) =>
        [
          `Turno ${turn.turnNumber} · ${turn.status.toUpperCase()}`,
          `Perfil: ${turn.profileName}`,
          `Teléfono: ${turn.phone || "Sin definir"}`,
          `Rama: ${turn.branch}`,
          `Universo: ${turn.universe || "No aplica"}`,
          `Número de caso: ${turn.caseNumber || "No indicado"}`,
          `Solicitud: ${turn.question}`,
          `Respuesta: ${turn.response || "No se recibió respuesta."}`,
          `HTTP: ${turn.httpStatus ?? "Sin respuesta"}`,
          `Resultado API: ${turn.apiSuccess === null ? "Sin dato" : turn.apiSuccess ? "Correcto" : "Error"}`,
          `Latencia: ${turn.latencyMs === null ? "En curso" : `${turn.latencyMs.toFixed(2)} ms`}`,
          `Tiempo total reportado por API: ${formatReportedDuration(turn.apiTiming?.total_ms)}`,
          `Tiempo total en segundos: ${turn.apiTiming?.total_seconds === null || turn.apiTiming?.total_seconds === undefined ? "No reportado" : `${turn.apiTiming.total_seconds} s`}`,
          `Entrega y recepción: ${formatReportedDuration(turn.apiTiming?.entrega_ms)}`,
          `Procesamiento Flowise: ${formatReportedDuration(turn.apiTiming?.flowise_ms)}`,
          `Devolución y persistencia: ${formatReportedDuration(turn.apiTiming?.devolucion_ms)}`,
          `Reintento ejecutado: ${turn.apiTiming?.reintento_ejecutado === null || turn.apiTiming?.reintento_ejecutado === undefined ? "No reportado" : turn.apiTiming.reintento_ejecutado ? "Sí" : "No"}`,
          `Timers de nivel raíz: ${turn.apiTiming && hasApiTimingData(turn.apiTiming.topLevel) ? JSON.stringify(turn.apiTiming.topLevel) : "No reportados"}`,
          `Resumen de tiempos API: ${turn.apiTiming?.time_summary ?? "No reportado"}`,
          ...(turn.apiTiming?.breakdown.map((stage) =>
            `Etapa ${stage.etapa ?? "sin nombre"}: ${formatReportedDuration(stage.duracion_ms)}${stage.descripcion ? ` · ${stage.descripcion}` : ""}`,
          ) ?? []),
          `Agente: ${turn.agent ?? "No reportado"}`,
          `Intención: ${turn.intent ?? "No reportada"}`,
          `Fase: ${turn.phase ?? "No reportada"}`,
          `Atención humana: ${turn.humanAttention === null ? "Sin dato" : turn.humanAttention ? "Sí" : "No"}`,
          `Session ID: ${turn.sessionId ?? "No reportado"}`,
          `Request ID: ${turn.requestId}`,
          `Inicio: ${turn.startedAt}`,
          `Fin: ${turn.completedAt ?? "En curso"}`,
          `Error: ${turn.error ?? "Ninguno"}`,
          `Origen del error: ${turn.errorSource ?? "Ninguno"}`,
          `Código del error: ${turn.errorCode ?? "Ninguno"}`,
          `Detalle técnico: ${turn.errorDetail ?? "Ninguno"}`,
        ].join("\n"),
      );
      const transcript = [
        "NOVA INSURE · CONVERSACIÓN + TRACKING",
        ...evidenceMetadataLines(evidenceMetadata),
        `Fecha de exportación: ${exportDate}`,
        "",
        "=== CONVERSACIÓN ===",
        ...conversation,
        "=== RESUMEN DE TRACKING ===",
        `Turnos totales: ${trackingSnapshot.summary.totalTurns}`,
        `Turnos completados: ${trackingSnapshot.summary.completedTurns}`,
        `Turnos pendientes: ${trackingSnapshot.summary.pendingTurns}`,
        `Correctos: ${trackingSnapshot.summary.successfulTurns}`,
        `Fallidos: ${trackingSnapshot.summary.failedTurns}`,
        `Sin verificar: ${trackingSnapshot.summary.unverifiedTurns}`,
        `Atención humana global: ${attentionSummary}`,
        `Turnos con atención humana: ${trackingSnapshot.summary.humanAttentionTurns}`,
        `Latencia promedio: ${averageLatency === null ? "Sin datos" : `${averageLatency.toFixed(2)} ms`}`,
        `Agentes observados: ${observedAgents.join(" → ") || "Sin datos"}`,
        "",
        "=== TRACKING POR TURNO ===",
        ...(turnReports.length > 0 ? turnReports : ["Sin turnos registrados."]),
        "",
        "=== SNAPSHOT JSON ===",
        JSON.stringify(trackingSnapshot, null, 2),
      ].join("\n");
      const blob = new Blob(["\ufeff", transcript], {
        type: "text/plain;charset=utf-8",
      });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.download = `nova-insure-conversacion-tracking-${new Date().toISOString().slice(0, 10)}.txt`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (exportError) {
      const detail =
        exportError instanceof Error
          ? exportError.message
          : "No fue posible generar el archivo de texto.";
      showLocalError(`No se pudo exportar conversación y tracking como TXT: ${detail}`);
    } finally {
      setIsExporting(null);
    }
  }

  const completedTurns = turns.filter((turn) => turn.latencyMs !== null);
  const successfulTurns = completedTurns.filter(
    (turn) =>
      turn.error === null &&
      (turn.httpStatus === null || (turn.httpStatus >= 200 && turn.httpStatus < 300)) &&
      turn.apiSuccess === true,
  );
  const failedTurns = completedTurns.filter(
    (turn) =>
      turn.error !== null ||
      (turn.httpStatus !== null && (turn.httpStatus < 200 || turn.httpStatus >= 300)) ||
      turn.apiSuccess === false,
  ).length;
  const unverifiedTurns = completedTurns.length - successfulTurns.length - failedTurns;
  const escalatedTurns = turns.filter((turn) => turn.humanAttention === true).length;
  const averageLatency =
    completedTurns.length > 0
      ? completedTurns.reduce((total, turn) => total + (turn.latencyMs || 0), 0) /
        completedTurns.length
      : null;
  const observedAgents = turns.reduce<string[]>((agents, turn) => {
    if (turn.agent && agents.at(-1) !== turn.agent) agents.push(turn.agent);
    return agents;
  }, []);
  const isKnownClient = selectedProfileData?.type === "client";
  const selectedProfileName = selectedProfileData?.name || "Perfil personalizado";
  const attentionSummary =
    escalatedTurns > 0
      ? `Sí · ${escalatedTurns} turno${escalatedTurns === 1 ? "" : "s"}`
      : completedTurns.some((turn) => turn.humanAttention === false)
        ? "No"
        : "Sin datos";
  const trackedTurns = turns.map((turn, index) => ({
    turnNumber: index + 1,
    status: getTurnStatus(turn),
    ...turn,
  }));
  const trackingSnapshot = {
    schemaVersion: 2,
    profile: {
      id: selectedProfile,
      name: selectedProfileName,
      phone: phone.trim(),
      branch: evidenceMetadata.branch,
      universe: evidenceMetadata.universe,
    },
    caseNumber: evidenceMetadata.caseNumber,
    summary: {
      totalTurns: turns.length,
      completedTurns: completedTurns.length,
      pendingTurns: turns.length - completedTurns.length,
      successfulTurns: successfulTurns.length,
      failedTurns,
      unverifiedTurns,
      humanAttention: escalatedTurns > 0
        ? true
        : completedTurns.some((turn) => turn.humanAttention === false)
          ? false
          : null,
      humanAttentionTurns: escalatedTurns,
      averageLatencyMs: averageLatency,
      observedAgents,
    },
    turns: trackedTurns,
  };

  return (
    <main className="app-shell">
      <section className="simulator">
        <header className="topbar">
          <div className="brand-mark">N</div>
          <div>
            <p className="eyebrow">Nova Insure</p>
            <h1>Simulador de WhatsApp</h1>
          </div>
          <div className="topbar-status">
            <div className="connection-pill"><span /> Proxy seguro · /api/nova</div>
            <div className="endpoint-note topbar-endpoint-note">
              <span className="status-dot" />
              <div><strong>Nova Bot</strong><small>Proxy de API · clave protegida</small></div>
            </div>
          </div>
        </header>

        <div className="workspace">
          <aside className="control-panel">
          <div className="config-intro">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Configuración</p>
                <h2>Iniciar prueba</h2>
              </div>
              <span className="sparkle">✦</span>
            </div>
            <p className="panel-copy">
              Simula una conversación real con el chatbot usando el número que necesites.
            </p>
          </div>
          <div className="profile-config">
            <label htmlFor="profile">Perfil de prueba</label>
            <select
              id="profile"
              data-testid="profile-select"
              aria-label="Seleccionar perfil de prueba"
              value={selectedProfile}
              onChange={(event) => handleProfileChange(event.target.value)}
            >
              <optgroup label="Cliente">
                {PROFILES.filter((profile) => profile.type === "client").map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.emoji} {profile.name} · {profile.phone}
                  </option>
                ))}
              </optgroup>
              <optgroup label="No Cliente">
                {PROFILES.filter((profile) => profile.type === "prospect").map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.emoji} {profile.name} · {profile.phone}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Custom">
                <option value="custom">✏️ Ingresa un teléfono</option>
              </optgroup>
            </select>
            {selectedProfile === "custom" ? (
              <>
                <label className="custom-phone-label" htmlFor="custom-phone">
                  Número de WhatsApp
                </label>
                <input
                  id="custom-phone"
                  data-testid="custom-phone-input"
                  aria-label="Número de teléfono personalizado"
                  value={customPhone}
                  onChange={(event) => setCustomPhone(event.target.value)}
                  placeholder="+52 000 000 0000"
                  inputMode="tel"
                />
                <p className="hint">Incluye código de país, por ejemplo +52.</p>
              </>
            ) : (
              <>
                {selectedProfileData && (
                  <div className="profile-tags" aria-label="Clasificación del perfil de prueba">
                    <span
                      className={`profile-tag branch-tag ${selectedProfileData.type}`}
                      data-testid="profile-branch-tag"
                    >
                      {selectedProfileData.type === "client" ? "Cliente" : "No Cliente"}
                    </span>
                    <select
                      id="profile-universe"
                      className="profile-tag universe-tag"
                      data-testid="profile-universe-select"
                      aria-label="Universo de prueba"
                      value={selectedUniverse}
                      onChange={(event) => setSelectedUniverse(event.target.value)}
                    >
                      {selectedProfileData.universes.map((universe) => (
                        <option key={universe} value={universe}>
                          {universe}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="selected-phone">Teléfono: {phone}</p>
              </>
            )}
            <label className="case-number-label" htmlFor="case-number">
              Número de caso <span>(opcional)</span>
            </label>
            <input
              id="case-number"
              data-testid="case-number-input"
              aria-label="Número de caso"
              value={caseNumber}
              onChange={(event) => setCaseNumber(event.target.value)}
              placeholder="Ej. CL-F01"
              autoComplete="off"
            />
          </div>
          <div className="config-actions">
            <button
              className="clear-button"
              id="clear-conversation-button"
              data-testid="clear-conversation"
              aria-label="Limpiar toda la conversación"
              type="button"
              onClick={clearConversation}
              disabled={isSending}
            >
              <span>↻</span> Limpiar conversación
            </button>
            <div className="export-section">
              <label>Guardar conversación</label>
              <div className="export-actions">
                <button
                  type="button"
                  id="save-conversation-png"
                  data-testid="save-conversation-png"
                  aria-label="Guardar conversación como PNG"
                  onClick={() => exportConversation("png")}
                  disabled={messages.length === 0 || isExporting !== null}
                >
                  {isExporting === "png" ? "Generando..." : "PNG"}
                </button>
                <button
                  type="button"
                  id="save-conversation-jpeg"
                  data-testid="save-conversation-jpeg"
                  aria-label="Guardar conversación como JPEG"
                  onClick={() => exportConversation("jpeg")}
                  disabled={messages.length === 0 || isExporting !== null}
                >
                  {isExporting === "jpeg" ? "Generando..." : "JPEG"}
                </button>
                <button
                  type="button"
                  id="save-conversation-txt"
                  data-testid="save-conversation-txt"
                  aria-label="Guardar conversación como TXT"
                  onClick={exportConversationAsText}
                  disabled={messages.length === 0 || isExporting !== null}
                >
                  {isExporting === "txt" ? "Generando..." : "TXT"}
                </button>
              </div>
              <p className="hint export-hint">
                Incluye el encabezado y todo el historial de mensajes.
              </p>
              <label className="export-tracking-label">Conversación + tracking</label>
              <div className="export-actions tracking-export-actions">
                <button
                  type="button"
                  id="save-conversation-tracking-png"
                  data-testid="save-conversation-tracking-png"
                  aria-label="Guardar conversación y tracking como PNG"
                  onClick={exportConversationWithTrackingAsPng}
                  disabled={messages.length === 0 || isExporting !== null || isSending}
                >
                  {isExporting === "tracking-png" ? "Generando..." : "PNG + tracking"}
                </button>
                <button
                  type="button"
                  id="save-conversation-tracking-txt"
                  data-testid="save-conversation-tracking-txt"
                  aria-label="Guardar conversación y tracking como TXT"
                  onClick={exportConversationWithTrackingAsText}
                  disabled={messages.length === 0 || isExporting !== null || isSending}
                >
                  {isExporting === "tracking-txt" ? "Generando..." : "TXT + tracking"}
                </button>
              </div>
              <p className="hint export-hint">
                Incluye todos los mensajes y el seguimiento técnico de cada turno.
              </p>
            </div>
          </div>
          </aside>

          <section
            className="phone-frame"
            aria-label="Conversación de WhatsApp"
            data-testid="conversation-panel"
          >
            <div className="chat-export" ref={chatExportRef} data-testid="conversation-export">
              <div className="chat-header">
                <div className="avatar">N</div>
                <div className="contact">
                  <strong>Nova Insure</strong>
                  <span>
                    {isSending ? `esperando respuesta · ${formatElapsed(elapsedSeconds)}` : "en línea"}
                  </span>
                </div>
                <div className="chat-actions"><span>⌕</span><span>⋮</span></div>
              </div>
              <div
                className="conversation"
                id="conversation-messages"
                data-testid="conversation-messages"
                aria-live="polite"
                ref={conversationRef}
              >
                <div className="date-divider"><span>HOY</span></div>
                {messages.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">☏</div>
                    <strong>Tu conversación empieza aquí</strong>
                    <span>Escribe un mensaje para probar las respuestas de Nova Insure.</span>
                  </div>
                )}
                {messages.map((item) => (
                  <div
                    className={`message-row ${item.sender}`}
                    key={item.id}
                    data-testid="conversation-message"
                    data-message-id={item.id}
                    data-message-sender={item.sender}
                    data-message-status={item.status ?? "received"}
                    data-message-type={item.media?.kind ?? "text"}
                  >
                    <div className="bubble">
                      {item.media?.kind === "image" && (
                        <img
                          className="message-image"
                          src={item.media.url}
                          alt={`Imagen adjunta: ${item.media.name}`}
                        />
                      )}
                      {item.media?.kind === "audio" && (
                        <div className="message-audio">
                          <audio controls preload="metadata" src={item.media.url}>
                            Tu navegador no admite la reproducción de audio.
                          </audio>
                          <span>{item.media.name}</span>
                        </div>
                      )}
                      {item.text && (
                        <div className="bubble-text">{formatWhatsAppMessage(item.text)}</div>
                      )}
                      <div className="bubble-meta">
                        <span>{item.time}</span>
                        {item.status === "local" && (
                          <span className="local-only-status">Vista local · no enviado al bot</span>
                        )}
                        {item.sender === "user" && (
                          <span className={`checks ${item.status}`}>
                            {item.status === "error"
                              ? "!"
                              : item.status === "sending"
                                ? "◷"
                                : item.status === "local"
                                  ? "◌"
                                  : "✓✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="typing" role="status" aria-live="polite" data-testid="request-progress">
                    <i /><i /><i />
                    <span>Esperando respuesta del bot · {formatElapsed(elapsedSeconds)} / {formatElapsed(CLIENT_REQUEST_TIMEOUT_MS / 1000)}</span>
                  </div>
                )}
              </div>
            </div>
            {requestFailure ? (
              <div className="error-banner request-failure" role="alert" data-testid="request-error">
                <strong>⚠ {requestFailure.title}</strong>
                <p>{requestFailure.message}</p>
                <div className="request-failure-meta">
                  <span><b>Origen:</b> {requestFailure.source}</span>
                  {requestFailure.httpStatus !== null && (
                    <span><b>HTTP:</b> {requestFailure.httpStatus}</span>
                  )}
                  <span><b>Código:</b> {requestFailure.code}</span>
                  <span><b>ID de soporte:</b> {requestFailure.requestId}</span>
                </div>
                {requestFailure.detail && (
                  <details>
                    <summary>Detalle técnico para soporte</summary>
                    <code>{requestFailure.detail}</code>
                  </details>
                )}
              </div>
            ) : error ? (
              <div className="error-banner" role="alert" data-testid="request-error">⚠ {error}</div>
            ) : null}
            <form
              className="composer"
              id="message-composer"
              data-testid="message-composer"
              onSubmit={sendMessage}
            >
              <button type="button" className="round-action" aria-label="Emoji">☺</button>
              <div className="media-actions">
                <input
                  ref={audioInputRef}
                  className="file-input-hidden"
                  id="audio-file-input"
                  data-testid="audio-file-input"
                  aria-label="Seleccionar archivo de audio"
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(event) => addMediaFiles(event, "audio")}
                />
                <input
                  ref={imageInputRef}
                  className="file-input-hidden"
                  id="image-file-input"
                  data-testid="image-file-input"
                  aria-label="Seleccionar archivo de imagen"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => addMediaFiles(event, "image")}
                />
                <button
                  className="media-button"
                  id="attach-audio-button"
                  data-testid="attach-audio"
                  type="button"
                  aria-label="Adjuntar audio"
                  title="Adjuntar audio"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <span aria-hidden="true">♫</span>
                </button>
                <button
                  className="media-button"
                  id="attach-image-button"
                  data-testid="attach-image"
                  type="button"
                  aria-label="Adjuntar imagen"
                  title="Adjuntar imagen"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <span aria-hidden="true">▧</span>
                </button>
              </div>
              <input
                id="message-input"
                data-testid="message-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escribe un mensaje"
                aria-label="Escribir mensaje de texto"
                disabled={isSending}
              />
              <button
                className="send-button"
                id="send-message-button"
                data-testid="send-message"
                type="submit"
                aria-label="Enviar mensaje de texto"
                title="Enviar mensaje"
                disabled={isSending || !message.trim() || !phone.trim()}
              >
                ➤
              </button>
            </form>
          </section>

          <aside
            className="metrics-panel"
            ref={metricsExportRef}
            aria-label="Métricas y seguimiento de la conversación"
            data-testid="conversation-metrics"
            data-schema-version="2"
            data-total-turns={turns.length}
            data-completed-turns={completedTurns.length}
            data-failed-turns={failedTurns}
          >
            <pre
              className="rpa-tracking-snapshot"
              data-testid="conversation-tracking-json"
              aria-label="Datos de tracking de conversación en JSON"
              hidden
            >
              {JSON.stringify(trackingSnapshot)}
            </pre>
            <header className="metrics-header">
              <p className="eyebrow">Nova Insure · seguimiento de ejecución</p>
              <h2>Métricas de la conversación</h2>
              <p className="metrics-subtitle">
                {selectedProfileName} ({isKnownClient ? "Cliente" : selectedProfile === "custom" ? "Perfil personalizado" : "Prospecto"})
              </p>
            </header>

            <div className="metrics-summary">
              <div className="metric-tile">
                <span>Teléfono</span>
                <strong>{phone.trim() || "Sin definir"}</strong>
              </div>
              <div className="metric-tile">
                <span>Atención humana global</span>
                <strong
                  data-testid="metric-human-attention"
                  data-value={escalatedTurns > 0 ? "true" : completedTurns.some((turn) => turn.humanAttention === false) ? "false" : ""}
                  className={escalatedTurns > 0 ? "metric-warning" : ""}
                >
                  {attentionSummary}
                </strong>
              </div>
              <div className="metric-tile">
                <span>Turnos evaluados</span>
                <strong data-testid="metric-turn-count" data-value={completedTurns.length}>
                  {completedTurns.length}{turns.length > completedTurns.length ? ` / ${turns.length}` : ""}
                </strong>
              </div>
              <div className="metric-tile">
                <span>Resultado API</span>
                <strong
                  data-testid="metric-api-result"
                  data-successful-turns={successfulTurns.length}
                  data-failed-turns={failedTurns}
                  data-unverified-turns={unverifiedTurns}
                  className={failedTurns > 0 ? "metric-error" : unverifiedTurns > 0 ? "metric-warning" : successfulTurns.length > 0 ? "metric-success" : ""}
                >
                  {completedTurns.length === 0
                    ? "Pendiente"
                    : `${successfulTurns.length} correctos · ${failedTurns} errores · ${unverifiedTurns} sin verificar`}
                </strong>
              </div>
              <div className="metric-tile metric-tile-wide">
                <span>Cadena de agentes observada</span>
                <strong>{observedAgents.length > 0 ? observedAgents.join(" → ") : "Sin datos del endpoint"}</strong>
              </div>
              <div className="metric-tile">
                <span>Latencia promedio</span>
                <strong data-testid="metric-average-latency" data-value-ms={averageLatency ?? ""}>
                  {formatLatency(averageLatency)}
                </strong>
              </div>
            </div>

            <div className="turn-list-heading">
              <div>
                <p className="eyebrow">Trazabilidad técnica</p>
                <h3>Desglose por turno</h3>
              </div>
              <span>{turns.length} total</span>
            </div>

            {turns.length === 0 ? (
              <div className="metrics-empty" data-testid="metrics-empty">
                <span aria-hidden="true">⌁</span>
                <strong>Sin turnos registrados</strong>
                <p>Envía un mensaje para ver agente, intención, fase, atención humana y latencia reportados por el endpoint.</p>
              </div>
            ) : (
              <div className="turn-list">
                {turns.map((turn, index) => {
                  const turnFailed = turn.error !== null;
                  const retryInfo = apiRetryInfo(turn.apiTiming);
                  return (
                    <article
                      className={`turn-card${turnFailed ? " turn-card-error" : ""}`}
                      key={turn.id}
                      data-testid="tracked-turn"
                      data-turn-number={index + 1}
                      data-turn-id={turn.id}
                      data-turn-status={getTurnStatus(turn)}
                      data-request-id={turn.requestId}
                      data-http-status={turn.httpStatus ?? ""}
                      data-api-success={turn.apiSuccess === null ? "" : String(turn.apiSuccess)}
                      data-agent={turn.agent ?? ""}
                      data-intent={turn.intent ?? ""}
                      data-phase={turn.phase ?? ""}
                      data-human-attention={turn.humanAttention === null ? "" : String(turn.humanAttention)}
                      data-session-id={turn.sessionId ?? ""}
                      data-latency-ms={turn.latencyMs ?? ""}
                      data-api-total-ms={turn.apiTiming?.total_ms ?? ""}
                      data-api-flowise-ms={turn.apiTiming?.flowise_ms ?? ""}
                      data-api-delivery-ms={turn.apiTiming?.entrega_ms ?? ""}
                      data-api-return-ms={turn.apiTiming?.devolucion_ms ?? ""}
                      data-api-retry={turn.apiTiming?.reintento_ejecutado === null || turn.apiTiming?.reintento_ejecutado === undefined ? "" : String(turn.apiTiming.reintento_ejecutado)}
                      data-profile-id={turn.profileId}
                      data-branch={turn.branch}
                      data-universe={turn.universe ?? ""}
                      data-case-number={turn.caseNumber ?? ""}
                      data-error-source={turn.errorSource ?? ""}
                      data-error-code={turn.errorCode ?? ""}
                      data-started-at={turn.startedAt}
                      data-completed-at={turn.completedAt ?? ""}
                      aria-label={`Turno ${index + 1} · ${getTurnStatus(turn)}`}
                    >
                      <div className="turn-card-heading">
                        <strong>Turno {index + 1}</strong>
                        <span data-testid="turn-latency" data-value-ms={turn.latencyMs ?? ""}>
                          {formatLatency(turn.latencyMs)}
                        </span>
                      </div>
                      <div className="turn-metrics">
                        <span data-testid="turn-http-status" data-value={turn.httpStatus ?? ""}><b>HTTP:</b> {turn.httpStatus ?? (turn.completedAt ? "Sin respuesta" : "En curso")}</span>
                        <span><b>API:</b> {turn.apiSuccess === null ? (turn.completedAt ? "Sin dato" : "En curso") : turn.apiSuccess ? "Correcto" : "Error"}</span>
                        <span data-testid="turn-agent" data-value={turn.agent ?? ""}><b>Agente:</b> {turn.agent || "No reportado"}</span>
                        <span data-testid="turn-phase" data-value={turn.phase ?? ""}><b>Fase:</b> {turn.phase || "No reportada"}</span>
                        <span className="turn-intent" data-testid="turn-intent" data-value={turn.intent ?? ""}><b>Intención:</b> {turn.intent || "No reportada"}</span>
                        <span data-testid="turn-human-attention" data-value={turn.humanAttention === null ? "" : String(turn.humanAttention)}><b>Atención humana:</b> {turn.humanAttention === null ? "Sin dato" : turn.humanAttention ? "Sí (activada)" : "No"}</span>
                        <span data-testid="turn-api-total-ms" data-value-ms={turn.apiTiming?.total_ms ?? ""}><b>Total API:</b> {formatReportedDuration(turn.apiTiming?.total_ms)}</span>
                        <span data-testid="turn-api-flowise-ms" data-value-ms={turn.apiTiming?.flowise_ms ?? ""}><b>Flowise:</b> {formatReportedDuration(turn.apiTiming?.flowise_ms)}</span>
                        <span data-testid="turn-api-retry" data-value={retryInfo.primary ? String(retryInfo.primary.executed) : ""}><b>{retryInfo.primary?.label ?? "Reintento"}:</b> {retryInfo.primary ? retryInfo.primary.executed ? "Sí" : "No" : "No reportado"}</span>
                        {retryInfo.additionalStages.map((retry) => (
                          <span
                            key={`${retry.index}-${retry.stage}`}
                            data-testid="turn-api-retry-stage"
                            data-value={String(retry.executed)}
                          >
                            <b>Reintento · {retry.stage}:</b> {retry.executed ? "Sí" : "No"}
                          </span>
                        ))}
                      </div>
                      {turn.error && (
                        <p className="turn-error">
                          {turn.error}
                          {turn.errorSource && <span>Origen: {turn.errorSource}</span>}
                          {turn.errorCode && <span>Código: {turn.errorCode}</span>}
                        </p>
                      )}
                      <details className="turn-details">
                        <summary>Ver intercambio y datos de sesión</summary>
                        <dl>
                          <dt>Solicitud</dt>
                          <dd data-testid="turn-question">{turn.question}</dd>
                          <dt>Perfil / teléfono</dt>
                          <dd>{turn.profileName} · {turn.phone}</dd>
                          <dt>Rama</dt>
                          <dd data-testid="turn-branch">{turn.branch}</dd>
                          <dt>Universo</dt>
                          <dd data-testid="turn-universe">{turn.universe || "No aplica"}</dd>
                          <dt>Número de caso</dt>
                          <dd data-testid="turn-case-number">{turn.caseNumber || "No indicado"}</dd>
                          <dt>Tiempo total API</dt>
                          <dd data-testid="turn-api-total-seconds">
                            {turn.apiTiming?.total_seconds === null || turn.apiTiming?.total_seconds === undefined
                              ? "No reportado"
                              : `${turn.apiTiming.total_seconds} s (${formatReportedDuration(turn.apiTiming.total_ms)})`}
                          </dd>
                          <dt>Entrega y recepción</dt>
                          <dd data-testid="turn-api-delivery-ms">
                            {formatReportedDuration(turn.apiTiming?.entrega_ms)}
                          </dd>
                          <dt>Procesamiento Flowise</dt>
                          <dd data-testid="turn-api-flowise-detail">
                            {formatReportedDuration(turn.apiTiming?.flowise_ms)}
                          </dd>
                          <dt>Devolución y persistencia</dt>
                          <dd data-testid="turn-api-return-ms">
                            {formatReportedDuration(turn.apiTiming?.devolucion_ms)}
                          </dd>
                          <dt>Tiempo total (campo API)</dt>
                          <dd data-testid="turn-api-time-ms">
                            {turn.apiTiming?.time_ms ?? "No reportado"}
                          </dd>
                          <dt>Tiempo total en `time`</dt>
                          <dd data-testid="turn-api-nested-total-ms">
                            {turn.apiTiming?.time?.total_ms === null || turn.apiTiming?.time?.total_ms === undefined
                              ? "No reportado"
                              : formatReportedDuration(turn.apiTiming.time.total_ms)}
                          </dd>
                          <dt>Tiempo Flowise (campo API)</dt>
                          <dd data-testid="turn-api-time-flowise-ms">
                            {turn.apiTiming?.time_flowise_ms ?? "No reportado"}
                          </dd>
                          <dt>Timers de nivel raíz</dt>
                          <dd data-testid="turn-api-root-timers">
                            {turn.apiTiming && hasApiTimingData(turn.apiTiming.topLevel)
                              ? JSON.stringify(turn.apiTiming.topLevel)
                              : "No reportados"}
                          </dd>
                          <dt>Reintento ejecutado</dt>
                          <dd data-testid="turn-api-retry-detail">
                            {turn.apiTiming?.reintento_ejecutado === null || turn.apiTiming?.reintento_ejecutado === undefined
                              ? "No reportado"
                              : turn.apiTiming.reintento_ejecutado ? "Sí" : "No"}
                          </dd>
                          <dt>Resumen de tiempos</dt>
                          <dd data-testid="turn-api-time-summary">
                            {turn.apiTiming?.time_summary ?? "No reportado"}
                          </dd>
                          <dt>Desglose de etapas</dt>
                          <dd data-testid="turn-api-time-breakdown">
                            {turn.apiTiming?.breakdown.length
                              ? turn.apiTiming.breakdown.map((stage, stageIndex) => (
                                  <div key={`${stage.etapa ?? "stage"}-${stageIndex}`}>
                                    <b>{stage.etapa ?? "Etapa"}</b>: {formatReportedDuration(stage.duracion_ms)}
                                    {stage.intento_1_ms !== null && ` · Intento 1: ${formatReportedDuration(stage.intento_1_ms)}`}
                                    {stage.reintento_ms !== null && ` · Reintento: ${formatReportedDuration(stage.reintento_ms)}`}
                                    {stage.reintento_ejecutado !== null && ` · Reintento ejecutado: ${stage.reintento_ejecutado ? "Sí" : "No"}`}
                                    {stage.descripcion && ` · ${stage.descripcion}`}
                                  </div>
                                ))
                              : "No reportado"}
                          </dd>
                          <dt>Origen del error</dt>
                          <dd>{turn.errorSource || "Ninguno"}</dd>
                          <dt>Código del error</dt>
                          <dd>{turn.errorCode || "Ninguno"}</dd>
                          <dt>Detalle técnico</dt>
                          <dd>{turn.errorDetail || "Ninguno"}</dd>
                          <dt>Respuesta</dt>
                          <dd data-testid="turn-response">
                            {turn.response || "No se recibió respuesta del endpoint."}
                          </dd>
                          <dt>Session ID</dt>
                          <dd data-testid="turn-session-id" data-value={turn.sessionId ?? ""}>
                            {turn.sessionId || "No reportado"}
                          </dd>
                          <dt>Request ID</dt>
                          <dd>{turn.requestId}</dd>
                          <dt>Inicio</dt>
                          <dd>{new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "medium" }).format(new Date(turn.startedAt))}</dd>
                        </dl>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
            <footer className="metrics-footer">
              <span>Latencia calculada desde el envío hasta la respuesta</span>
              <strong>{averageLatency === null ? "Esperando primera respuesta" : `Promedio: ${formatLatency(averageLatency)}`}</strong>
            </footer>
          </aside>
        </div>
        <footer>
          Las conversaciones no se guardan. Audio e imagen se muestran localmente y no se envían al bot.
        </footer>
      </section>
    </main>
  );
}

export default App;
