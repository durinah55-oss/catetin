import { readScanFile } from "../../../../lib/purchasingAliasesScan.js";
import { requireOwnerAdmin } from "../../../../lib/purchasingAliasesAuth.js";

function findCluster(scanData, clusterId) {
  const clusters = scanData.clusters || [];
  return clusters.find((c) => c.cluster_id === clusterId) || null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { businessId, scanFile, clusterId, action, canonicalName } = body;

    if (!businessId || !scanFile || clusterId == null || !action) {
      return Response.json({ error: "businessId, scanFile, clusterId, action wajib." }, { status: 400 });
    }
    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "action harus approve atau reject." }, { status: 400 });
    }

    const auth = await requireOwnerAdmin(req, businessId);
    if (auth.error) return auth.error;

    const scanData = readScanFile(scanFile);
    const cluster = findCluster(scanData, clusterId);
    if (!cluster) {
      return Response.json({ error: `Cluster #${clusterId} tidak ditemukan di ${scanFile}.` }, { status: 404 });
    }

    const canonical = String(canonicalName || cluster.canonical_suggestion || "").trim().toLowerCase();
    if (action === "approve" && !canonical) {
      return Response.json({ error: "canonicalName wajib saat approve." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const reviewRow = {
      business_id: businessId,
      scan_file: scanFile,
      cluster_id: clusterId,
      status: action === "approve" ? "approved" : "rejected",
      canonical_name: action === "approve" ? canonical : null,
      reviewed_by: auth.user.id,
      reviewed_at: now,
    };

    const { error: revErr } = await auth.admin
      .from("purchasing_alias_cluster_reviews")
      .upsert(reviewRow, { onConflict: "business_id,scan_file,cluster_id" });

    if (revErr) {
      if (/does not exist/i.test(revErr.message || "")) {
        return Response.json({
          error: "Tabel review belum ada. Jalankan supabase/migrations/purchasing_item_aliases.sql",
        }, { status: 500 });
      }
      throw revErr;
    }

    let aliasesSaved = 0;
    if (action === "approve") {
      const members = cluster.members || [];
      const rows = members
        .map((m) => String(m.name || "").trim().toLowerCase())
        .filter((alias) => alias && alias !== canonical)
        .map((alias) => ({
          business_id: businessId,
          canonical_name: canonical,
          alias_name: alias,
          verified_by: auth.user.id,
          verified_at: now,
        }));

      if (rows.length) {
        const { error: aliasErr } = await auth.admin
          .from("purchasing_item_aliases")
          .upsert(rows, { onConflict: "business_id,alias_name" });

        if (aliasErr) {
          if (/does not exist/i.test(aliasErr.message || "")) {
            return Response.json({
              error: "Tabel purchasing_item_aliases belum ada. Jalankan migration SQL.",
            }, { status: 500 });
          }
          throw aliasErr;
        }
        aliasesSaved = rows.length;
      }
    }

    return Response.json({
      ok: true,
      clusterId,
      status: reviewRow.status,
      canonical_name: reviewRow.canonical_name,
      aliasesSaved,
    });
  } catch (e) {
    const msg = e.message || String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
