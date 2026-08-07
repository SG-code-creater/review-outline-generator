import { NextRequest } from "next/server";
import { verifyToken } from "@clerk/nextjs/server";

// 从请求中解析 Clerk 登录用户 id（sub）。
// 读 __session cookie（或 Bearer），verifyToken 手动校验，绕开 EdgeOne 不支持的 middleware。
// 与 /api/generate、/api/flashcards 中的逻辑一致，集中到此复用。
export async function getUserIdFromReq(req: NextRequest): Promise<string | null> {
  try {
    const cookieToken =
      req.cookies.get("__session")?.value ||
      req.cookies.get("__clerk_session")?.value;
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const token = cookieToken || bearer;
    if (!token) return null;
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return (claims.sub as string) ?? null;
  } catch {
    return null;
  }
}
