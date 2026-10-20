import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 문서 거버넌스 규칙 (AGENTS.md 역할 라우팅 계약):
// 1. 모든 md 파일은 300줄 이하.
// 2. 모든 md 파일은 owner_role frontmatter로 단일 역할에 배타 배정된다.
//    역할→모델·effort 매핑은 AGENTS.md 라우팅 표에만 둔다 (모델 교체 시 frontmatter 불변).
//    - lead: 계획/기획/PM/앱디자인(비코드)/분석
//    - integrator: QA·최종 통합 판정
//    - codex: 코딩/DB/보안/git/배포 등 구현 전반
// 3. domain은 owner_role과 일치하는 집합에 속해야 한다 (교차 소유 금지).

const MAX_LINES = 300;
const DOMAINS_BY_OWNER = {
  lead: new Set(["planning", "product-design", "analysis", "pm"]),
  integrator: new Set(["qa"]),
  codex: new Set(["implementation", "database", "security", "release", "git"]),
};
// README.md는 저장소 공개 첫 화면이라 frontmatter를 면제한다 (소유는 AGENTS.md 라우팅 표로 선언).
// PRIVACY_POLICY.md는 앱이 링크하는 대외 게시 문서다 — frontmatter가 GitHub에서
// 표로 렌더되어 내부 메타데이터가 이용자에게 노출되므로 면제한다 (소유: 라우팅 표).
const FRONTMATTER_EXEMPT = new Set(["README.md", "docs/product/PRIVACY_POLICY.md"]);

const root = process.cwd();
const tracked = execSync("git ls-files '*.md'", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const errors = [];

for (const relPath of tracked) {
  const text = readFileSync(join(root, relPath), "utf8");
  const lines = text.split("\n");
  const lineCount = text.endsWith("\n") ? lines.length - 1 : lines.length;

  if (lineCount > MAX_LINES) {
    errors.push(`${relPath}: ${lineCount}줄 — ${MAX_LINES}줄 제한 초과`);
  }

  if (FRONTMATTER_EXEMPT.has(relPath)) continue;

  if (lines[0] !== "---") {
    errors.push(`${relPath}: frontmatter 없음 (첫 줄이 '---'가 아님)`);
    continue;
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    errors.push(`${relPath}: frontmatter 닫는 '---' 없음`);
    continue;
  }
  const fm = Object.fromEntries(
    lines
      .slice(1, end)
      .map((line) => line.match(/^([A-Za-z_]+):\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]])
  );

  const owner = fm.owner_role;
  if (!owner || !Object.hasOwn(DOMAINS_BY_OWNER, owner)) {
    errors.push(`${relPath}: owner_role이 없거나 허용값이 아님 (${owner ?? "누락"})`);
    continue;
  }
  if (!fm.domain || !DOMAINS_BY_OWNER[owner].has(fm.domain)) {
    errors.push(
      `${relPath}: domain '${fm.domain ?? "누락"}'은 ${owner} 소유 도메인(${[...DOMAINS_BY_OWNER[owner]].join(", ")})에 속하지 않음`
    );
  }
  if (fm.edit_policy !== "exclusive") {
    errors.push(`${relPath}: edit_policy는 'exclusive'여야 함 (${fm.edit_policy ?? "누락"})`);
  }
}

if (errors.length) {
  console.error(`docs verification failed (${errors.length}건):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`docs verification passed (${tracked.length} md files, ≤${MAX_LINES} lines, exclusive ownership).`);
