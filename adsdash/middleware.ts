import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for supabase auth cookie
  const hasSession = request.cookies.getAll().some(c => 
    c.name.includes('sb-') && c.name.includes('-auth-token')
  )

  // Not logged in and trying to access protected page
  if (!hasSession && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in and on login page - go to dashboard
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
