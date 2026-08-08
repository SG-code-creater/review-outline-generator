import { NextResponse } from "next/server";

// 临时诊断接口：检查服务端环境变量是否就位（不暴露任何值）
// 部署后访问 GET /api/debug-env 即可看到各变量是否存在
// ⚠️ 用完后建议删除此文件，避免信息泄露

export async function GET() {
  const check = (key: string) => {
    const val = process.env[key];
    return { key, exists: !!val, length: val?.length ?? 0 };
  };

  return NextResponse.json({
    envChecks: [
      check("MIMO_API_KEY"),
      check("MIMO_BASE_URL"),
      check("MIMO_MODEL"),
      check("DEEPSEEK_API_KEY"),
      check("CLERK_SECRET_KEY"),
      check("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      check("SUPABASE_URL"),
      check("SUPABASE_SERVICE_ROLE_KEY"),
    ],
    nodeEnv: process.env.NODE_ENV,
    hint: "如果 MIMO_API_KEY exists=false，说明 EdgeOne 环境变量未正确配置或未触发重新部署",
  });
}
