import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Agency } from '../lib/supabase'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function ContactForm() {
  const { agencySlug } = useParams<{ agencySlug: string }>()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [agencyLoading, setAgencyLoading] = useState(true)
  const [agencyNotFound, setAgencyNotFound] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function fetchAgency() {
      if (!agencySlug) return
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('slug', agencySlug)
        .single()

      if (error || !data) {
        setAgencyNotFound(true)
      } else {
        setAgency(data)
      }
      setAgencyLoading(false)
    }
    fetchAgency()
  }, [agencySlug])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!agency) return

    setFormState('loading')
    setErrorMsg('')

    const { error } = await supabase
      .from('contacts')
      .insert({
        agency_id: agency.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        status: 'new',
      })

    if (error) {
      setFormState('error')
      setErrorMsg(error.message)
    } else {
      setFormState('success')
    }
  }

  if (agencyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-ink-400 animate-pulse-dot"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (agencyNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-display text-4xl text-ink-300 mb-3">404</p>
          <p className="font-body text-ink-500">This agency doesn't exist.</p>
        </div>
      </div>
    )
  }

  if (formState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-fade-up max-w-sm">
          <div className="w-14 h-14 rounded-full bg-sage-500 flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-ink-900 mb-2">Message sent</h2>
          <p className="font-body text-ink-500 text-sm leading-relaxed">
            Thank you. The team at <span className="text-ink-700 font-medium">{agency?.name}</span> will be in touch shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header strip */}
      <div className="border-b border-ink-100 bg-white/60 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-ink-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-ink-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <span className="font-display text-ink-700 text-sm italic">{agency?.name}</span>
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg animate-fade-up">
          {/* Headline */}
          <div className="mb-10">
            <h1 className="font-display text-4xl md:text-5xl text-ink-900 leading-tight mb-3">
              Get in touch<span className="text-clay-500">.</span>
            </h1>
            <p className="font-body text-ink-500 text-base leading-relaxed">
              Leave your details and we'll reach out as soon as possible.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-body text-xs font-medium text-ink-500 uppercase tracking-wider mb-2">
                Full name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="input-field"
                disabled={formState === 'loading'}
              />
            </div>

            <div>
              <label className="block font-body text-xs font-medium text-ink-500 uppercase tracking-wider mb-2">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="input-field"
                disabled={formState === 'loading'}
              />
            </div>

            <div>
              <label className="block font-body text-xs font-medium text-ink-500 uppercase tracking-wider mb-2">
                Message
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="I'm interested in a 3-bedroom apartment in the downtown area..."
                className="input-field resize-none"
                disabled={formState === 'loading'}
              />
            </div>

            {formState === 'error' && (
              <p className="text-sm font-body text-clay-600 bg-clay-400/10 border border-clay-400/20 rounded-sm px-4 py-3">
                {errorMsg || 'Something went wrong. Please try again.'}
              </p>
            )}

            <button
              type="submit"
              disabled={formState === 'loading'}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {formState === 'loading' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending…
                </>
              ) : (
                'Send message'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
