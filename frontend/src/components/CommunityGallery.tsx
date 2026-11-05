import { Globe2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl } from '../lib/api'
import { timeAgo } from '../lib/format'
import type { PublicDesign } from '../lib/types'

type Props = { run: Run; compact?: boolean }

/** Public showcase of designs users chose to share. Works logged out (landing page) and logged in. */
export default function CommunityGallery({ run, compact = false }: Props) {
  const [items, setItems] = useState<PublicDesign[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    run('Loading community gallery', async () => {
      const page = await api.gallery()
      setItems(page.items)
      setNext(page.next_before)
      setLoaded(true)
    })
  }, [run])

  const more = () =>
    run('Loading more', async () => {
      const page = await api.gallery(next)
      setItems((prev) => [...prev, ...page.items])
      setNext(page.next_before)
    })

  const shown = compact ? items.slice(0, 12) : items

  return (
    <section className="space-y-4">
      {!compact && (
        <header>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Globe2 size={18} /> Community gallery</h2>
          <p className="text-sm text-violet-300/70">Characters shared by CharaForge creators. Share yours with the "Share to community" button in the studio.</p>
        </header>
      )}
      {loaded && items.length === 0 && (
        <p className="panel p-6 text-center text-sm text-violet-300/70">Nothing shared yet. Be the first to publish a design!</p>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {shown.map((d) => (
          <li key={d.id} className="panel overflow-hidden">
            <img src={fileUrl(d.image_url)} alt={`${d.character_name}: ${d.prompt}`} loading="lazy" className="aspect-[2/3] w-full bg-white object-cover" />
            <div className="space-y-0.5 p-2">
              <div className="truncate text-sm font-medium">{d.character_name}</div>
              <div className="truncate text-[11px] text-violet-300/70">{d.prompt}</div>
              <div className="truncate text-[11px] text-violet-300/50">by {d.author} · {d.style} · {timeAgo(d.published_at)}</div>
            </div>
          </li>
        ))}
      </ul>
      {!compact && next && (
        <div className="text-center"><button className="btn-ghost" onClick={more}>Load more</button></div>
      )}
    </section>
  )
}
