export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4" style={{ background: '#f6f8fa' }}>
      <div className="w-full max-w-[340px]">{children}</div>
    </div>
  )
}
