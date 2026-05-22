// apps/web/src/middleware.ts
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (shouldSkip(pathname)) return NextResponse.next()

  const hasRefreshToken = request.cookies.has('refresh_token')

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
