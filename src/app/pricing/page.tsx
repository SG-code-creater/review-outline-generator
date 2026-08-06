import Link from "next/link";

export default function Pricing() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          学盒 · 会员方案
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          免费先用，会员无限生成。一杯奶茶钱，承包你整个学期的复习。
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {/* 免费版 */}
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">免费版</h2>
            <p className="mt-1 text-3xl font-bold text-zinc-900">
              ¥0<span className="text-sm font-normal text-zinc-500"> / 永久</span>
            </p>
          </div>
          <ul className="flex flex-1 flex-col gap-2 text-sm text-zinc-600">
            <li>✓ 每日 5 次免费生成</li>
            <li>✓ 结构化 Markdown 提纲</li>
            <li>✓ 一键复制结果</li>
            <li className="text-zinc-400">✗ 无限次生成</li>
            <li className="text-zinc-400">✗ 后续高级功能（PDF 问答等）</li>
          </ul>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            开始使用
          </Link>
        </div>

        {/* 会员版 */}
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-900 bg-zinc-900 p-6">
          <div>
            <h2 className="text-lg font-semibold text-white">会员版</h2>
            <p className="mt-1 text-3xl font-bold text-white">
              ¥9.9<span className="text-sm font-normal text-zinc-400"> / 月</span>
            </p>
          </div>
          <ul className="flex flex-1 flex-col gap-2 text-sm text-zinc-200">
            <li>✓ 无限次提纲生成</li>
            <li>✓ 全部免费版功能</li>
            <li>✓ 优先体验新功能（PDF 上传问答等）</li>
            <li>✓ 学生专享价，可随时取消</li>
          </ul>
          <button
            disabled
            className="cursor-not-allowed rounded-full bg-zinc-700 px-4 py-2 text-center text-sm font-medium text-zinc-300"
            title="支付功能开发中"
          >
            即将开放订阅
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-zinc-400">
        当前为公开测试版，所有功能免费可用。订阅功能上线后此处可开通会员。
      </p>
    </main>
  );
}
