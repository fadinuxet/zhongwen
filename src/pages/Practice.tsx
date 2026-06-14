import { Link } from 'react-router-dom'
import { BookOpenIcon, MicIcon, QuizIcon, ToneIcon } from '../components/Icons'

const MODES = [
  {
    to: '/reading',
    label: 'Sentences you can read',
    desc: 'Phrases that unlock as you learn their words',
    Icon: BookOpenIcon,
    tint: 'bg-violet-50 text-violet-600',
  },
  {
    to: '/quiz',
    label: 'Quiz',
    desc: 'Multiple choice · typing · listening',
    Icon: QuizIcon,
    tint: 'bg-brand-50 text-brand-600',
  },
  {
    to: '/pronounce',
    label: 'Pronunciation',
    desc: 'Say it out loud — get instant feedback',
    Icon: MicIcon,
    tint: 'bg-emerald-50 text-emerald-600',
    note: 'needs mic + internet',
  },
  {
    to: '/shadow',
    label: 'Shadowing',
    desc: 'Hear a sentence, repeat it — the fluency power-move',
    Icon: MicIcon,
    tint: 'bg-teal-50 text-teal-600',
    note: 'needs mic + internet',
  },
  {
    to: '/tones',
    label: 'Tone trainer',
    desc: 'Train your ear for the four tones',
    Icon: ToneIcon,
    tint: 'bg-sky-50 text-sky-600',
  },
]

export default function Practice() {
  return (
    <div className="px-4 pt-safe sm:pt-8">
      <header className="mb-4 mt-4 px-1 sm:mt-0">
        <h1 className="text-2xl font-bold text-slate-900">Practice</h1>
        <p className="text-sm text-slate-500">Different ways to drill what you're learning.</p>
      </header>

      <div className="space-y-3">
        {MODES.map(({ to, label, desc, Icon, tint, note }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition-colors hover:ring-brand-300 active:scale-[0.99]"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{label}</span>
                {note && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">{note}</span>}
              </div>
              <div className="text-sm text-slate-500">{desc}</div>
            </div>
            <span className="text-slate-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
