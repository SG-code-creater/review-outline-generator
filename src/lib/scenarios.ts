// 垂直备考场景：用于让 DeepSeek 针对特定考试调整提纲/闪卡的组织方式与侧重点。
// 这是与"通用大厂工具"拉开定位的最低成本动作（仅改 prompt，无需后端）。

export const SCENARIOS = ["通用", "考研", "考公", "期末"] as const;
export type Scenario = (typeof SCENARIOS)[number];

// 每个场景追加到 system prompt 末尾的指导语（空字符串=不加）
const SCENARIO_GUIDANCE: Record<Scenario, string> = {
  通用: "",
  考研:
    "用户正在准备研究生入学考试（考研）。请侧重：核心考点与重难点、易混淆概念的辨析、与历年真题风格对齐的知识点；闪卡问题可提示常见考法。",
  考公:
    "用户正在准备公务员录用考试（考公，行测/申论）。请侧重：高频考点、法律与时政要点、行测解题套路；闪卡突出易错点与速记口诀。",
  期末:
    "用户正在准备大学课程期末考试。请侧重：章节知识框架、老师强调的重点、典型计算/证明题套路；闪卡突出考前速记。",
};

export function scenarioGuidance(s: unknown): string {
  const key = SCENARIOS.includes(s as Scenario) ? (s as Scenario) : "通用";
  const g = SCENARIO_GUIDANCE[key];
  return g ? `\n\n【用户场景】${g}` : "";
}
