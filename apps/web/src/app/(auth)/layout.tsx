export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f6f8fa' }}>
      {/* Topbar */}
      <nav style={{ background: '#24292f' }} className="px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 text-white text-sm font-semibold">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="3" width="16" height="12" rx="2" stroke="white" strokeWidth="1.5"/>
            <path d="M5 7h8M5 10.5h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          MPC · 工程招投标管理系统
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-[340px]">{children}</div>
      </div>
    </div>
  )
}
