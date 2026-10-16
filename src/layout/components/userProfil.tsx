import { UserRound } from 'lucide-react'

export default function UserProfile() {
  return (
    <div className="flex shrink-0 items-center gap-8 rounded-full border border-slate-200 px-8 py-6" aria-label="Profil pengguna">
      <span className="flex h-[3.2rem] w-[3.2rem] items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <UserRound aria-hidden="true" size={16} />
      </span>
    </div>
  )
}
