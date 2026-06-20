// lib/staffMessages.js — pengumuman admin/owner ke staf (via app_state)

export function createStaffMessage({ title, body, targetType = "all", targetValue = null, author }) {
  const t = String(title || "").trim();
  const b = String(body || "").trim();
  if (!t || !b) throw new Error("Judul dan isi pengumuman wajib diisi.");

  return {
    id: "msg" + Date.now() + Math.random().toString(36).slice(2, 5),
    title: t,
    body: b,
    createdAt: new Date().toISOString(),
    createdBy: author?.name || "Admin",
    createdById: author?.id || null,
    target: { type: targetType, value: targetValue || null },
    readBy: [],
  };
}

/** Apakah pesan ditujukan ke user ini? */
export function messageForUser(msg, user) {
  if (!msg?.target) return true;
  const { type, value } = msg.target;
  if (type === "all" || !type) return true;
  if (type === "role") return (user?.role || "") === value;
  if (type === "outlet") return (user?.outlet || "") === value;
  return false;
}

export function visibleStaffMessages(messages, user) {
  return (messages || [])
    .filter(m => messageForUser(m, user))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function unreadStaffCount(messages, user) {
  const uid = user?.id;
  if (!uid) return 0;
  return visibleStaffMessages(messages, user).filter(m => !(m.readBy || []).includes(uid)).length;
}

export function markStaffMessageRead(messages, messageId, userId) {
  const list = [...(messages || [])];
  const i = list.findIndex(m => m.id === messageId);
  if (i < 0) return list;
  const readBy = new Set(list[i].readBy || []);
  if (userId) readBy.add(userId);
  list[i] = { ...list[i], readBy: [...readBy] };
  return list;
}

export function formatMessageTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
