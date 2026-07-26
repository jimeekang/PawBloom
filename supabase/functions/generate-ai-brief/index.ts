import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient } from "../_shared/supabase.ts";
import { AiBriefRequestError, parseAiBriefRequest } from "./contract.ts";

// Brief copy per requested language. The disclaimer wording must keep
// satisfying the client-side hasRequiredDisclaimer check (AI_SAFETY.md).
const briefCopy = {
  en: {
    disclaimer: "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.",
    diaryReviewed: (count: number) => `${count} diary records were reviewed.`,
    dosesReviewed: (count: number) => `${count} medication records were reviewed.`,
    skippedDoses: (count: number) => `${count} medication records were marked skipped.`,
    noSkippedDoses: "No skipped medication records were found.",
    lowCondition: (count: number) => `${count} low-condition records may be worth discussing with a veterinarian.`,
    noLowCondition: "No repeated low-condition pattern was found in the reviewed records.",
    questionsForVet: [
      "When did the appetite, water, stool, or energy change first appear?",
      "Should the current medication schedule continue unchanged?",
    ],
  },
  ko: {
    disclaimer: "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
    diaryReviewed: (count: number) => `다이어리 기록 ${count}건을 검토했습니다.`,
    dosesReviewed: (count: number) => `투약 기록 ${count}건을 검토했습니다.`,
    skippedDoses: (count: number) => `건너뜀으로 표시된 투약 기록이 ${count}건 있습니다.`,
    noSkippedDoses: "건너뜀으로 표시된 투약 기록은 없습니다.",
    lowCondition: (count: number) => `컨디션이 낮게 기록된 날이 ${count}건 있어 수의사와 상의해 볼 만합니다.`,
    noLowCondition: "검토한 기록에서 반복되는 저컨디션 패턴은 발견되지 않았습니다.",
    questionsForVet: [
      "식욕, 물 섭취, 배변, 기력 변화는 언제 처음 나타났나요?",
      "현재 투약 스케줄을 그대로 유지해도 될까요?",
    ],
  },
} as const;

const sourceFailureMessage = "Unable to load records for brief generation";

class AiBriefSourceError extends Error {
  constructor() {
    super(sourceFailureMessage);
    this.name = "AiBriefSourceError";
  }
}

function failSourceQuery(source: string, cause: unknown): never {
  console.error(`generate-ai-brief ${source} query failed`, cause);
  throw new AiBriefSourceError();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = parseAiBriefRequest(await readJson<unknown>(request));
    await requirePetMember(supabase, body.petId, user.id);

    const until = new Date().toISOString();
    const since = new Date(Date.parse(until) - body.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const [entriesResult, dosesResult] = await Promise.all([
      supabase
        .from("diary_entries")
        .select("category,summary,occurred_at,condition_score")
        .eq("pet_id", body.petId)
        .is("superseded_by", null)
        .gte("occurred_at", since)
        .lte("occurred_at", until)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("medication_doses")
        .select("medication_name,status,scheduled_at,reaction_note")
        .eq("pet_id", body.petId)
        .gte("scheduled_at", since)
        .lte("scheduled_at", until)
        .order("scheduled_at", { ascending: false }),
    ]).catch((error: unknown) => failSourceQuery("source records", error));

    if (entriesResult.error) failSourceQuery("diary entries", entriesResult.error);
    if (dosesResult.error) failSourceQuery("medication doses", dosesResult.error);

    const entries = entriesResult.data ?? [];
    const doses = dosesResult.data ?? [];

    const missedDoses = doses.filter((dose) => dose.status === "skipped").length;
    const lowCondition = entries.filter((entry) => Number(entry.condition_score ?? 5) <= 2).length;

    const copy = briefCopy[body.language];
    const payload = {
      rangeDays: body.rangeDays,
      highlights: [
        copy.diaryReviewed(entries.length),
        copy.dosesReviewed(doses.length),
        missedDoses > 0 ? copy.skippedDoses(missedDoses) : copy.noSkippedDoses,
        lowCondition > 0 ? copy.lowCondition(lowCondition) : copy.noLowCondition,
      ],
      questionsForVet: [...copy.questionsForVet],
      disclaimer: copy.disclaimer,
    };

    const { data: brief, error } = await supabase
      .from("ai_briefs")
      .insert({
        pet_id: body.petId,
        range_days: body.rangeDays,
        payload,
        created_by: user.id,
      })
      .select("id,created_at")
      .single();

    if (error) {
      console.error("generate-ai-brief persistence failed", error);
      return errorResponse("Unable to save generated brief", 500);
    }

    return jsonResponse({ briefId: brief.id, createdAt: brief.created_at, payload });
  } catch (error) {
    if (error instanceof AiBriefRequestError) return errorResponse(error.message, 400);
    if (error instanceof AiBriefSourceError) return errorResponse(error.message, 500);
    return errorResponse(error instanceof Error ? error.message : "Failed to generate brief", 400);
  }
});
