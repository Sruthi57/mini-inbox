import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Contact, ContactStatus, Agency } from '../lib/supabase'

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  discarded: 'Discarded',
}

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: 'bg-clay-500 text-white',
  contacted: 'bg-sage-500 text-white',
  discarded: 'bg-ink-200 text-ink-600',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ContactRow({
  contact,
  onStatusChange,
  isNew,
}: {
  contact: Contact
  onStatusChange: (id: string, status: ContactStatus) => void
  isNew: boolean
}) {
  const [updating, setUpdating] = useState(false)

  async function handleStatusChange(status: ContactStatus) {
    setUpdating(true)
    await onStatusChange(contact.id, status)
    setUpdating(false)
  }

  return (
    <div
      className={`
        border-b border-ink-100 last:border-0 px-6 py-5 flex items-start gap-5
        transition-all duration-500
        ${isNew ? 'animate-slide-in bg-clay-400/5' : 'bg-white hover:bg-ink-50/50'}
      `}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-ink-900 flex-shrink-0 flex items-center justify-center">
        <span className="font-display text-ink-50 text-sm font-semibold">
          {contact.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-body font-semibold text-ink-900 text-sm">{contact.name}</p>
            <p className="font-mono text-ink-400 text-xs mt-0.5">{contact.email}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Status badge */}
            <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[contact.status]}`}>
              {STATUS_LABELS[contact.status]}
            </span>
            <span className="text-xs font-body text-ink-400 whitespace-nowrap">
              {formatDate(contact.created_at)}
            </span>
          </div>
        </div>

        <p className="font-body text-ink-600 text-sm mt-2 leading-relaxed line-clamp-2">
          {contact.message}
        </p>

        {/* Status changer */}
        <div className="mt-3 flex gap-2">
          {(['new', 'contacted', 'discarded'] as ContactStatus[]).map(s => (
            <button
              key={s}
              disabled={contact.status === s || updating}
              onClick={() => handleStatusChange(s)}
              className={`
                text-xs font-body px-3 py-1 rounded-sm border transition-colors duration-150
                ${contact.status === s
                  ? 'border-ink-900 bg-ink-900 text-ink-50 cursor-default'
                  : 'border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-700 disabled:opacity-40'
                }
              `}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Inbox() {
  const { user, signOut } = useAuth()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [newContactIds, setNewContactIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [liveCount, setLiveCount] = useState(0)

  // Fetch the agency linked to this user's profile
  useEffect(() => {
    async function fetchAgencyAndContacts() {
      if (!user) return

      // Get agent's agency_id from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single()

      if (!profile?.agency_id) {
        setLoading(false)
        return
      }

      const { data: agencyData } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', profile.agency_id)
        .single()

      setAgency(agencyData)

      // Fetch contacts
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false })

      setContacts(contactsData ?? [])
      setLoading(false)
    }

    fetchAgencyAndContacts()
  }, [user])

  // Realtime subscription
  useEffect(() => {
    if (!agency) return

    const channel = supabase
      .channel(`contacts:agency_id=eq.${agency.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
          filter: `agency_id=eq.${agency.id}`,
        },
        (payload) => {
          const newContact = payload.new as Contact
          setContacts(prev => [newContact, ...prev])
          setNewContactIds(prev => new Set([...prev, newContact.id]))
          setLiveCount(c => c + 1)
          // Remove "new" highlight after 5s
          setTimeout(() => {
            setNewContactIds(prev => {
              const next = new Set(prev)
              next.delete(newContact.id)
              return next
            })
          }, 5000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `agency_id=eq.${agency.id}`,
        },
        (payload) => {
          const updated = payload.new as Contact
          setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agency])

  const handleStatusChange = useCallback(async (id: string, status: ContactStatus) => {
    await supabase
      .from('contacts')
      .update({ status })
      .eq('id', id)
    // Optimistic update (realtime will also sync it)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }, [])

  const statusCounts = contacts.reduce(
    (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-ink-900 text-ink-50 border-b border-ink-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-ink-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-ink-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <div>
              <span className="font-display text-ink-50 text-base">
                {agency ? agency.name : 'Inbox'}
              </span>
              {agency && (
                <span className="ml-2 font-mono text-ink-500 text-xs">/{agency.slug}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sage-400 animate-pulse-dot" />
              <span className="font-body text-xs text-ink-400">Live</span>
            </div>

            <button
              onClick={signOut}
              className="font-body text-xs text-ink-400 hover:text-ink-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'New', count: statusCounts['new'] ?? 0, color: 'text-clay-500' },
            { label: 'Contacted', count: statusCounts['contacted'] ?? 0, color: 'text-sage-500' },
            { label: 'Discarded', count: statusCounts['discarded'] ?? 0, color: 'text-ink-400' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-ink-100 rounded-sm px-5 py-4">
              <p className={`font-display text-3xl font-semibold ${s.color}`}>{s.count}</p>
              <p className="font-body text-xs text-ink-400 mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Live toast notification count */}
        {liveCount > 0 && (
          <div className="mb-4 animate-slide-in flex items-center gap-2 bg-clay-500/10 border border-clay-500/20 rounded-sm px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-clay-500 animate-pulse-dot" />
            <p className="font-body text-sm text-clay-600">
              <span className="font-semibold">{liveCount}</span> new contact{liveCount !== 1 ? 's' : ''} received this session
            </p>
          </div>
        )}

        {/* Inbox heading */}
        <div className="flex items-end justify-between mb-4">
          <h1 className="font-display text-2xl text-ink-900">
            Contacts
          </h1>
          <span className="font-body text-xs text-ink-400">
            {contacts.length} total
          </span>
        </div>

        {/* Contact list */}
        <div className="bg-white border border-ink-100 rounded-sm overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-ink-300 animate-pulse-dot"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-10 h-10 text-ink-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
              </svg>
              <p className="font-display text-ink-400 italic text-lg">No contacts yet</p>
              <p className="font-body text-ink-300 text-sm mt-1">
                Share your form link and leads will appear here in real time.
              </p>
            </div>
          ) : (
            contacts.map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onStatusChange={handleStatusChange}
                isNew={newContactIds.has(contact.id)}
              />
            ))
          )}
        </div>

        {agency && (
          <div className="mt-6 flex items-center gap-2">
            <span className="font-body text-xs text-ink-400">Public form:</span>
            <code className="font-mono text-xs text-ink-600 bg-ink-100 px-2 py-1 rounded-sm">
              {window.location.origin}/c/{agency.slug}
            </code>
          </div>
        )}
      </main>
    </div>
  )
}
