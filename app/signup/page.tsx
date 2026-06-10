import { redirect } from 'next/navigation'

// Magic-link login both signs in and creates accounts (shouldCreateUser), so a
// separate password signup no longer exists. Keep this route as a redirect so
// existing links / bookmarks to /signup still work.
export default function SignupPage() {
  redirect('/login')
}
