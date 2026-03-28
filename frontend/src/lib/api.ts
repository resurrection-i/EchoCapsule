import { API_BASE } from "./contracts";

// ========== SIWE auth ==========

export async function getNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error("Failed to get nonce");
  return res.json();
}

export async function verifySiwe(data: {
  address: string;
  signature: string;
  nonce: string;
}): Promise<{ token: string; address: string; role: string }> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Verify failed" }));
    throw new Error(err.error || "Verify failed");
  }
  return res.json();
}

export async function getMe(token: string): Promise<{ address: string; role: string }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Invalid token");
  return res.json();
}

// Upload photo to IPFS
export async function uploadPhoto(file: File): Promise<{ cid: string; ipfs_url: string }> {
  const formData = new FormData();
  formData.append("photo", file);

  const res = await fetch(`${API_BASE}/upload/photo`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "unknown error" }));
    throw new Error(`Upload failed: ${body.detail ?? body.error ?? res.status}`);
  }
  return res.json();
}

// Submit emotion update task
export async function submitEmotionUpdate(data: {
  emotion_id: number;
  photo_cid: string;
  music_id: number;
  mood_text: string;
  signature: string;
  deadline: number;
}): Promise<{ task_id: number; status: string }> {
  const res = await fetch(`${API_BASE}/emotion/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Submit failed (${res.status})` }));
    throw new Error(err.error || err.detail || `Submit failed (${res.status})`);
  }
  return res.json();
}

// Poll task status
export async function getTaskStatus(taskId: number): Promise<{
  task_id: number;
  status: string;
  tx_hash: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/task/${taskId}`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Latest emotion
export async function getLatestEmotion(): Promise<{
  emotion_id: number;
  photo_cid: string;
  music_id: number;
  mood_text: string;
}> {
  const res = await fetch(`${API_BASE}/emotion/latest`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Emotion history
export async function getEmotionHistory(page = 1, pageSize = 20): Promise<{
  total: number;
  data: Array<{
    id: number;
    emotion_id: number;
    photo_cid: string;
    music_id: number;
    mood_text: string;
    created_at: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/emotion/history?page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Send comfort (free)
export async function sendComfort(walletAddress: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/comfort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  if (!res.ok) throw new Error("Send failed");
  return res.json();
}

// Global comfort count
export async function getComfortCount(): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/comfort/count`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Idol: super-comfort (paid) messages
export async function getSuperComforts(params?: {
  page?: number;
  limit?: number;
  sort?: "time" | "amount";
}): Promise<{
  data: Array<{
    id: number;
    wallet_address: string;
    message: string;
    amount: string;
    tx_hash: string;
    block_number: number;
    created_at: string;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const p = params?.page ?? 1;
  const l = params?.limit ?? 10;
  const s = params?.sort ?? "time";
  const res = await fetch(`${API_BASE}/comfort/super?page=${p}&limit=${l}&sort=${s}`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Today’s free comfort already used?
export async function checkTodayFree(address: string): Promise<{ used: boolean }> {
  const res = await fetch(`${API_BASE}/comfort/today-free?address=${address}`);
  if (!res.ok) return { used: false };
  return res.json();
}

// ========== Aggregates ==========

// Fan comfort heatmap (~365d)
export async function getComfortHeatmap(address: string): Promise<{
  data: Array<{ date: string; count: number }>;
}> {
  const res = await fetch(`${API_BASE}/comfort/heatmap?address=${address}`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Top fans
export async function getTopFans(): Promise<{
  data: Array<{ address: string; count: number }>;
}> {
  const res = await fetch(`${API_BASE}/comfort/top-fans`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Fan’s comfort count
export async function getMyComfortCount(address: string): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/comfort/my-count?address=${address}`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Emotion radar (idol)
export async function getEmotionRadar(): Promise<{
  data: Array<{ emotion_id: number; count: number }>;
}> {
  const res = await fetch(`${API_BASE}/emotion/radar`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}

// Comfort stats per history row
export async function getEmotionComfortStats(): Promise<{
  data: Array<{ history_id: number; comfort_count: number }>;
}> {
  const res = await fetch(`${API_BASE}/emotion/comfort-stats`);
  if (!res.ok) throw new Error("Query failed");
  return res.json();
}
