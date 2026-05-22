// apps/web/src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']
const SKIP_PATHS = ['/_next', '/favicon.ico', '/api/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
function shouldSkip(pathname: string) {
  return SKIP_PATHS.some((p) => pathname.startsWith(p))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (shouldSkip(pathname)) return NextResponse.next()

  // 检查 logged_in 标记 cookie（path='/'，所有请求都会携带）
  // refresh_token 的 path='/api/auth/refresh'，proxy 无法读取
  const hasRefreshToken = request.cookies.has('logged_in')

  if (isPublicPath(pathname) && hasRefreshToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (!isPublicPath(pathname) && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
