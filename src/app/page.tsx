import WebcamFeed from "@/components/WebCamFeed";
import Dashboard from "@/components/Dashboard";

/**
 * Main Training Page
 * Built with Next.js App Router.
 * Features a high-performance webcam feed and a real-time analytics dashboard.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-950 text-white selection:bg-emerald-500/30">
      {/* Background Glow Effect */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse duration-[8s]" />
      </div>

      <div className="w-full max-w-6xl px-4 py-12 space-y-12">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M21 7h-2v2h2V7zm-2-2h-2v2h2V5zm-2-2h-2v2h2V3zm-2 2h-2v2h2V5zm-2 2H9v2h2V7zM7 9H5v2h2V9zm-2-2H3v2h2V7zm0-2H3v2h2V5z" /></svg>
              </div>
              <h1 className="text-4xl font-black tracking-tight uppercase italic leading-none">
                Gym<span className="text-emerald-500">AI</span>
              </h1>
            </div>
            <p className="text-zinc-500 font-medium max-w-sm">
              Level up your training with real-time AI form correction and biomechanics tracking.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> System Active</span>
            <span className="w-px h-4 bg-zinc-800" />
            <span>v1.0.4 Beta</span>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Training Zone */}
          <section className="lg:col-span-8 space-y-4 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Live Training Zone</h2>
              <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] text-emerald-500 font-bold uppercase tracking-widest leading-none">
                4K Camera Ready
              </div>
            </div>
            <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden group">
              <WebcamFeed />
            </div>
          </section>

          {/* Performance Dashboard */}
          <aside className="lg:col-span-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
            <div className="px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Performance Analytics</h3>
            </div>
            <Dashboard />
          </aside>
        </div>

        {/* Footer Info */}
        <footer className="pt-24 pb-12 border-t border-zinc-900 flex flex-col items-center justify-center gap-4 opacity-30 text-center grayscale grayscale-0 transition-all hover:opacity-100">
          <p className="max-w-md text-sm leading-relaxed text-zinc-500">
            Pro-level biomechanics tracking using MediaPipe BlazePose and Node.js.
            All processing happens locally in your browser for maximum privacy and performance.
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="w-8 h-8 rounded-full border border-zinc-500/20" />
            <div className="w-8 h-8 rounded-full border border-zinc-500/20" />
            <div className="w-8 h-8 rounded-full border border-zinc-500/20" />
          </div>
        </footer>
      </div>
    </main>
  );
}
