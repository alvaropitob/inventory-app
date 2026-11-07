"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ClipboardEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerPqrAttachments, type PqrUploadedFile } from "@/app/dashboard/pqr/actions";
import {
  PQR_ATTACHMENT_BUCKET, PQR_MAX_FILE_BYTES, PQR_MAX_FILES_PER_SUBMIT, detectImageType, type PqrActionResult,
} from "@/lib/pqr";

interface Props {
  /** "create" opens the new ticket afterwards; "comment" stays on the page and refreshes it. */
  mode: "create" | "comment";
  action: (formData: FormData) => Promise<PqrActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  /** Server-rendered form fields. */
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Extra content rendered after the file picker (e.g. internal-note checkbox). */
  footer?: ReactNode;
  /** Padding for the attachment picker and action buttons, to align them with the form fields. */
  actionsPadding?: string;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function PqrSubmitForm({ mode, action, submitLabel, pendingLabel = "Enviando…", children, className, style, footer, actionsPadding }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setError(null);
    const accepted: File[] = [];
    for (const file of incoming) {
      if (files.length + accepted.length >= PQR_MAX_FILES_PER_SUBMIT) {
        setError(`Puedes adjuntar hasta ${PQR_MAX_FILES_PER_SUBMIT} capturas por envío.`);
        break;
      }
      if (file.size > PQR_MAX_FILE_BYTES) { setError(`«${file.name}» supera los 5 MB.`); continue; }
      if (!(await detectImageType(file))) { setError(`«${file.name}» no es una imagen PNG, JPG o WebP.`); continue; }
      accepted.push(file);
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
  }

  function onPaste(event: ClipboardEvent<HTMLFormElement>) {
    const pasted = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (pasted.length) { event.preventDefault(); void addFiles(pasted); }
  }

  async function uploadAll(ticketId: string): Promise<string | null> {
    const supabase = createClient();
    const uploaded: PqrUploadedFile[] = [];
    for (const file of files) {
      const type = await detectImageType(file);
      if (!type) return `«${file.name}» no es una imagen válida.`;
      const path = `${ticketId}/${crypto.randomUUID()}.${type.ext}`;
      const { error: uploadError } = await supabase.storage.from(PQR_ATTACHMENT_BUCKET).upload(path, file, { contentType: type.mime, upsert: false });
      if (uploadError) return `No se pudo subir «${file.name}»: ${uploadError.message}`;
      uploaded.push({ path, name: file.name.replace(/[\\/]/g, "_"), mime: type.mime, size: file.size });
    }
    const result = await registerPqrAttachments(ticketId, uploaded);
    return result.ok ? null : result.error;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) { setError(result.error); return; }
      const uploadError = files.length ? await uploadAll(result.ticketId) : null;
      if (mode === "create") {
        const note = uploadError
          ? `error=${encodeURIComponent(`La solicitud se registró, pero las capturas no se adjuntaron (${uploadError}). Puedes agregarlas en un comentario.`)}`
          : `success=${encodeURIComponent("Solicitud registrada. Puedes seguir su avance desde esta página.")}`;
        router.push(`/dashboard/pqr/${result.ticketId}?${note}`);
        return;
      }
      if (uploadError) setError(`El comentario se publicó, pero las capturas no se adjuntaron: ${uploadError}`);
      else { form.reset(); setFiles([]); }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} onPaste={onPaste} className={className} style={style}>
      {children}
      <div style={{ padding: actionsPadding }}>
      <div style={{ display: "grid", gap: ".5rem", marginTop: ".85rem" }}>
        <div>
          <input
            ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }}
          />
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={pending || files.length >= PQR_MAX_FILES_PER_SUBMIT}>
            Adjuntar captura
          </button>
          <span className="cell-secondary" style={{ marginLeft: ".75rem" }}>
            PNG, JPG o WebP · máx. 5 MB · hasta {PQR_MAX_FILES_PER_SUBMIT}. También puedes pegar con Ctrl+V.
          </span>
        </div>
        <p className="form-hint" style={{ margin: 0 }}>Antes de adjuntar, oculta nombres de pacientes y otros datos personales visibles en la pantalla.</p>
        {files.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} style={{ width: 130, display: "grid", gap: ".25rem" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[index]} alt={`Vista previa de ${file.name}`} style={{ width: 130, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                <span className="cell-secondary" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>{file.name}</span>
                <span className="cell-secondary">{formatSize(file.size)}</span>
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {footer}
      {error && <p className="alert-error" role="alert" style={{ marginTop: ".75rem" }}>{error}</p>}
      <div style={{ display: "flex", gap: ".75rem", justifyContent: "flex-end", marginTop: ".85rem" }}>
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? pendingLabel : submitLabel}</button>
      </div>
      </div>
    </form>
  );
}

