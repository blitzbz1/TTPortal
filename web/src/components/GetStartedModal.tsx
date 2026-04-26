"use client";

import { useTranslations } from "next-intl";
import { X, Globe, Download } from "lucide-react";
import { useEffect, useRef } from "react";

interface GetStartedModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GetStartedModal({
  open,
  onClose,
}: GetStartedModalProps) {
  const t = useTranslations("getStartedModal");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-md w-full bg-transparent p-0 backdrop:bg-ink-900/55 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="relative overflow-hidden rounded-[28px] border border-ink-100 bg-surface p-8 shadow-[0_40px_80px_-24px_rgba(12,29,19,0.35)]">
        {/* decorative top band */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-moss-700 via-moss-500 to-clay-500"
        />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900"
        >
          <X className="h-[18px] w-[18px]" />
        </button>

        <span className="kicker mb-3 inline-flex items-center gap-2 text-clay-700">
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-clay-500" />
          Get TTPortal
        </span>

        <h3 className="mb-2 font-heading text-[26px] font-bold tracking-tight text-ink-900">
          {t("title")}
        </h3>
        <p className="mb-7 text-[14.5px] leading-relaxed text-ink-600">
          {t("subtitle")}
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://blitzbz1.github.io/TTPortal/app/"
            className="group flex items-center gap-4 rounded-2xl border border-ink-100 bg-paper/60 p-5 transition-all hover:-translate-y-[1px] hover:border-moss-300 hover:bg-moss-50/60"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-moss-700 to-moss-900 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              <Globe className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-heading text-[15.5px] font-bold text-ink-900">
                {t("webTitle")}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-600">
                {t("webDescription")}
              </p>
            </div>
          </a>

          <a
            href="https://github.com/blitzbz1/TTPortal/releases/download/v0.0.3-alpha/ttportal-v0.0.3-alpha.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-2xl border border-ink-100 bg-paper/60 p-5 transition-all hover:-translate-y-[1px] hover:border-clay-300 hover:bg-clay-50/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-clay-500 to-clay-700 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <Download className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-heading text-[15.5px] font-bold text-ink-900">
                {t("apkTitle")}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-600">
                {t("apkDescription")}
              </p>
            </div>
          </a>
        </div>
      </div>
    </dialog>
  );
}
