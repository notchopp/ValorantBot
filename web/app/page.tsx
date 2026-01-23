import { redirect } from 'next/navigation'

export default function Home() {
  // Hub is the landing page (3D logo + enter #GRNDS → Discord auth)
  redirect('/hub')
}
