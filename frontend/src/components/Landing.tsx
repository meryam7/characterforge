import { Download, Fingerprint, MousePointerClick, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Run } from '../App'
import type { User } from '../lib/types'
import AuthForm from './AuthForm'
import CommunityGallery from './CommunityGallery'

const FEATURES = [
  { icon: Fingerprint, title: 'Consistent identity', text: 'One seed, one description, one reference. Every new pose and outfit still looks like the same character.' },
  { icon: MousePointerClick, title: 'Click to edit any part', text: 'Click the hair, jacket or boots, describe the change, and only that area is repainted.' },
  { icon: Download, title: 'Game-ready exports', text: 'Transparent PNGs, sprite sheets with an atlas, and a drop-in Godot 4 pack.' },
]

type Props = { onAuthed: (u: User) => void; run: Run; banner: ReactNode }

export default function Landing({ onAuthed, run, banner }: Props) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-14 px-4 py-10 lg:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <span className="chip inline-flex items-center gap-1.5"><Sparkles size={12} /> Free AI character design studio</span>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Design characters that{' '}
            <span className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">stay themselves</span>
          </h1>
          <p className="max-w-xl text-violet-200/80">
            CharaForge turns a description (and an optional reference picture) into a character you can restyle, re-pose
            and edit piece by piece, then export straight into your game, comic or animation.
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="panel space-y-1.5 p-4">
                <Icon size={18} className="text-violet-300" />
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-xs text-violet-300/70">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          {banner}
          <AuthForm onAuthed={onAuthed} run={run} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold">Made by the community</h2>
        <CommunityGallery run={run} compact />
      </div>

      <footer className="mt-auto border-t border-white/10 pt-6 text-center text-xs text-violet-300/50">
        CharaForge · characters for games, comics and animation
      </footer>
    </div>
  )
}
