import { ChangeEvent, FormEvent, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";

type ApiResponse = {
  success?: boolean | string;
  message?: string;
  human_attention?: boolean | string;
  intent?: string;
  agent?: string;
  phase?: string;
  sessionId?: string;
};

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
};

const PROFILES: Profile[] = [
  { id: "adrian", emoji: "👤", name: "Adrian Gonzalo Silva Ortiz", phone: "+5493813544275" },
  { id: "axel", emoji: "🧑‍💻", name: "Axel F Green", phone: "+529681198133" },
  { id: "oscar", emoji: "🧔", name: "Oscar Tellez", phone: "+19123109148" },
  { id: "custom", emoji: "✏️", name: "Custom", phone: "" },
];

const ENDPOINT = "/api/nova";

function currentTime() {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function formatInlineWhatsApp(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenPattern =
    /```([^`\n]+)```|`([^`\n]+)`|\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])|~([^~\n]+)~/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    const key = `${match.index}-${match[0]}`;
    if (match[1]) {
      parts.push(<code className="whatsapp-code" key={key}>{content}</code>);
    } else if (match[2]) {
      parts.push(<code className="whatsapp-code" key={key}>{content}</code>);
    } else if (match[3]) {
      parts.push(<strong key={key}>{formatInlineWhatsApp(content)}</strong>);
    } else if (match[4]) {
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
  return text.split("\n").map((line, index) => (
    <Fragment key={index}>
      {formatInlineWhatsApp(line)}
      {index < text.split("\n").length - 1 && <br />}
    </Fragment>
  ));
}

function App() {
  const [selectedProfile, setSelectedProfile] = useState("oscar");
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isExporting, setIsExporting] = useState<"png" | "jpeg" | "txt" | null>(null);
  const [error, setError] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const chatExportRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
  const selectedProfileData = PROFILES.find((profile) => profile.id === selectedProfile);
  const phone = selectedProfileData?.phone || customPhone;

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(
    () => () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedPhone || !trimmedMessage || isSending) return;
    setError("");
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
    setIsSending(true);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: trimmedPhone, message: trimmedMessage }),
      });

      const contentType = response.headers.get("content-type") || "";
      const data: ApiResponse | string = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const detail = typeof data === "string" ? data : data.message;
        throw new Error(detail || `La API respondió con HTTP ${response.status}.`);
      }

      const botText =
        typeof data === "string" ? data : data.message || "El bot no devolvió un mensaje.";
      setMessages((current) =>
        current.map((item) =>
          item.id === outgoingId ? { ...item, status: "sent" as const } : item,
        ).concat({
          id: crypto.randomUUID(),
          text: botText,
          sender: "bot",
          time: currentTime(),
        }),
      );
    } catch (requestError) {
      const detail =
        requestError instanceof Error
          ? requestError.message
          : "No fue posible contactar al bot.";
      setMessages((current) =>
        current.map((item) =>
          item.id === outgoingId ? { ...item, status: "error" as const } : item,
        ),
      );
      setError(detail);
    } finally {
      setIsSending(false);
    }
  }

  function clearConversation() {
    attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    attachmentUrlsRef.current = [];
    setMessages([]);
    setError("");
  }

  function addMediaFiles(event: ChangeEvent<HTMLInputElement>, kind: "audio" | "image") {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((file) => file.type.startsWith(`${kind}/`));
    if (validFiles.length !== files.length) {
      setError(`Solo se pueden agregar archivos de ${kind === "audio" ? "audio" : "imagen"}.`);
    } else {
      setError("");
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
    setError("");
  }

  async function exportConversation(format: "png" | "jpeg") {
    const chat = chatExportRef.current;
    if (!chat || messages.length === 0 || isExporting) return;

    setIsExporting(format);
    setError("");

    try {
      await document.fonts.ready;
      const fullHeight =
        (chat.querySelector<HTMLElement>(".chat-header")?.offsetHeight ?? 0) +
        (conversationRef.current?.scrollHeight ?? 0);
      const options = {
        backgroundColor: "#efeae2",
        pixelRatio: 2,
        width: chat.scrollWidth,
        height: fullHeight,
        style: {
          height: `${fullHeight}px`,
          maxHeight: "none",
          overflow: "visible",
        },
      };
      const dataUrl =
        format === "png"
          ? await toPng(chat, options)
          : await toJpeg(chat, { ...options, quality: 0.95 });
      const link = document.createElement("a");
      link.download = `nova-insure-conversacion-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (exportError) {
      const detail =
        exportError instanceof Error
          ? exportError.message
          : "No fue posible generar la imagen.";
      setError(`No se pudo exportar la conversación: ${detail}`);
    } finally {
      setIsExporting(null);
    }
  }

  function exportConversationAsText() {
    if (messages.length === 0 || isExporting) return;

    setIsExporting("txt");
    setError("");

    try {
      const transcript = [
        "NOVA INSURE · CONVERSACIÓN DE WHATSAPP",
        `Número: ${phone.trim()}`,
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
      setError(`No se pudo exportar la conversación: ${detail}`);
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <main className="app-shell">
      <section className="simulator">
        <header className="topbar">
          <div className="brand-mark">N</div>
          <div>
            <p className="eyebrow">Nova Insure</p>
            <h1>Simulador de WhatsApp</h1>
          </div>
          <div className="connection-pill"><span /> API conectada</div>
        </header>

        <div className="workspace">
          <aside className="control-panel">
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
            <label htmlFor="profile">Perfil de prueba</label>
            <select
              id="profile"
              data-testid="profile-select"
              aria-label="Seleccionar perfil de prueba"
              value={selectedProfile}
              onChange={(event) => handleProfileChange(event.target.value)}
            >
              {PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.emoji} {profile.name} · {profile.phone || "Ingresa un teléfono"}
                </option>
              ))}
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
              <p className="selected-phone">Teléfono: {phone}</p>
            )}
            <div className="endpoint-note">
              <span className="status-dot" />
              <div><strong>Nova Bot</strong><small>Sesión en tiempo real</small></div>
            </div>
            <button
              className="clear-button"
              id="clear-conversation-button"
              data-testid="clear-conversation"
              aria-label="Limpiar toda la conversación"
              type="button"
              onClick={clearConversation}
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
                  <span>{isSending ? "escribiendo..." : "en línea"}</span>
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
                {isSending && <div className="typing"><i /><i /><i /></div>}
              </div>
            </div>
            {error && <div className="error-banner" role="alert" data-testid="request-error">⚠ {error}</div>}
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
        </div>
        <footer>
          Las conversaciones no se guardan. Audio e imagen se muestran localmente y no se envían al bot.
        </footer>
      </section>
    </main>
  );
}

export default App;
