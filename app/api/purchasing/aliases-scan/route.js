import { loadLatestScanPayload } from "../../../../lib/purchasingAliasesScan.js";
import { requireOwnerAdmin } from "../../../../lib/purchasingAliasesAuth.js";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const auth = await requireOwnerAdmin(req, businessId);
    if (auth.error) return auth.error;

    const { fileName, mtimeMs, data } = loadLatestScanPayload();

    const { data: reviews, error: revErr } = await auth.admin
      .from("purchasing_alias_cluster_reviews")
      .select("cluster_id, status, canonical_name, reviewed_at")
      .eq("business_id", businessId)
      .eq("scan_file", fileName);

    if (revErr && !/does not exist/i.test(revErr.message || "")) throw revErr;

    const reviewMap = {};
    for (const r of reviews || []) {
      reviewMap[r.cluster_id] = {
        status: r.status,
        canonical_name: r.canonical_name,
        reviewed_at: r.reviewed_at,
      };
    }

    return Response.json({
      scanFile: fileName,
      scanMtime: new Date(mtimeMs).toISOString(),
      generatedAt: data.generatedAt,
      businessId: data.businessId,
      summary: data.summary,
      clusters: data.clusters || [],
      suspects: data.suspects || [],
      reviews: reviewMap,
    });
  } catch (e) {
    const msg = e.message || String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
