import { redirect } from 'next/navigation'

export default function LoginPage() {
  // Hub is the landing + auth page; "enter #GRNDS" triggers Discord OAuth
  redirect('/hub')
}
