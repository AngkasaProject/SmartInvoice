import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300"
      : "bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-300";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex gap-4 p-5 sm:p-6">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-rose-100 text-rose-600"
                : "bg-indigo-100 text-indigo-600"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2
              id="confirm-dialog-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-message"
              className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
