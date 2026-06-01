import { useTranslations } from "next-intl";

export interface StatusCounts {
  under_review: number;
  planned: number;
  in_progress: number;
  released: number;
}

const statusConfig = [
  {
    key: "statusUnderReview",
    field: "under_review" as const,
    color: "bg-clay-500",
  },
  { key: "statusPlanned", field: "planned" as const, color: "bg-blue-500" },
  {
    key: "statusInProgress",
    field: "in_progress" as const,
    color: "bg-moss-600",
  },
  { key: "statusReleased", field: "released" as const, color: "bg-violet-500" },
];

export default function StatusLegend({ counts }: { counts: StatusCounts }) {
  const t = useTranslations("featureRequests");
  const hasAny = Object.values(counts).some((v) => v > 0);

  if (!hasAny) return null;

  return (
    <div className="card-tactile flex flex-col gap-4 p-6">
      <h3 className="font-heading text-[15px] font-bold tracking-tight text-ink-900">
        {t("statusLegend")}
      </h3>
      <div className="flex flex-col gap-3">
        {statusConfig.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`h-[7px] w-[7px] rounded-full ${s.color}`} />
            <span className="flex-1 text-[13px] font-medium text-ink-600">
              {t(s.key)}
            </span>
            <span className="font-heading text-[13px] font-bold tabular-nums text-ink-500">
              {counts[s.field]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
