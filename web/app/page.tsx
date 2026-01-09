import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to dashboard - this is a live hub, not a landing page
  redirect('/dashboard')
}
