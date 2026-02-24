import { NextResponse } from 'next/server'
export function middleware() { return NextResponse.next() }
export const config = { matcher: [] }
```

Also — while you're there, click `adsdash/app/login/page.tsx` → ✏️ → find the line that says:
```
window.location.replace('/dashboard')
```
Change it to:
```
window.location.href = 'https://adsdash-3hph6b9dp-infobytechit-jpgs-projects.vercel.app/dashboard'
