// 競合の判断（docs/05 の6節）。純粋な部品。
//
// ファイルごとに、手元と Notion のそれぞれを「前回同期したときの自分の側」と比べる（基底は2つの SHA-256 を持つ）。
//   手元が変わった・Notion は変わっていない → export（書き出す）
//   手元は変わっていない・Notion が変わった → import（取り込む）
//   両方変わった                              → conflict（自動でマージしない）。ただし両方が同じ中身になっていれば converged
// 「無い」も1つの状態として扱う（null）。手元で消した → Notion からも消す、Notion で消した → 手元からも消す。

/** 前回同期したときの、ファイル1つの基底 */
export interface BaseEntry {
  /** 手元の共有する形（settings.json は ignoredSettings を除いた形）の SHA-256。無かったら null */
  local: string | null;
  /** Notion の本文の SHA-256。無かったら null */
  remote: string | null;
}

export type Decision = "none" | "export" | "import" | "conflict" | "converged";

/**
 * @param local  今の手元の共有する形の SHA-256（無ければ null）
 * @param remote 今の Notion の本文の SHA-256（無ければ null）
 * @param base   前回の基底（初めてなら undefined。両側とも無かったものとして扱う）
 */
export function decide(local: string | null, remote: string | null, base: BaseEntry | undefined): Decision {
  const b: BaseEntry = base ?? { local: null, remote: null };
  const localChanged = local !== b.local;
  const remoteChanged = remote !== b.remote;
  if (!localChanged && !remoteChanged) return "none";
  if (localChanged && !remoteChanged) return "export";
  if (!localChanged && remoteChanged) return "import";
  return local === remote ? "converged" : "conflict";
}

export interface FileDecision {
  name: string;
  decision: Decision;
  local: string | null;
  remote: string | null;
}

/** 名前の集まり全部について判断する（手元・Notion・基底のどれかにある名前） */
export function decideAll(
  local: ReadonlyMap<string, string | null>,
  remote: ReadonlyMap<string, string | null>,
  base: Readonly<Record<string, BaseEntry>>,
): FileDecision[] {
  const names = new Set<string>([...local.keys(), ...remote.keys(), ...Object.keys(base)]);
  const out: FileDecision[] = [];
  for (const name of names) {
    const l = local.get(name) ?? null;
    const r = remote.get(name) ?? null;
    if (l === null && r === null) continue; // 両方とも無い（基底だけに残っている）は何もしない
    out.push({ name, decision: decide(l, r, base[name]), local: l, remote: r });
  }
  return out;
}
