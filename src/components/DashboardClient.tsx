'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Trash2, Edit3, ListTodo, Filter, X, LogOut, Calendar, Repeat, HelpCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Goal {
  id: string
  title: string
  completed: boolean
  tags: string[]
  created_at: string
  target_date: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_parent_id: string | null
}

interface DashboardClientProps {
  initialGoals: Goal[]
  userEmail: string
}

// Helper: format a date string to readable form
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper: get due status for styling
function getDueStatus(dateStr: string | null): 'overdue' | 'due-today' | 'upcoming' | 'none' {
  if (!dateStr) return 'none'
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'due-today'
  return 'upcoming'
}

// Helper: get today's date as YYYY-MM-DD
function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Helper: get yesterday's date as YYYY-MM-DD
function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Helper: get tomorrow's date as YYYY-MM-DD
function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Helper: get next occurrence date based on recurrence rule
function getNextOccurrenceDate(rule: string): string {
  const today = new Date()
  const next = new Date(today)

  switch (rule) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekdays':
      do { next.setDate(next.getDate() + 1) } while (next.getDay() === 0 || next.getDay() === 6)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    default:
      next.setDate(next.getDate() + 1)
  }

  return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0')
}

// Sort goals: pending first, then by target_date (nearest first, nulls last), then by created_at desc
function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    // Completed last
    if (a.completed !== b.completed) return a.completed ? 1 : -1

    // By target_date ascending (nulls last)
    if (a.target_date && b.target_date) {
      const cmp = a.target_date.localeCompare(b.target_date)
      if (cmp !== 0) return cmp
    } else if (a.target_date && !b.target_date) {
      return -1
    } else if (!a.target_date && b.target_date) {
      return 1
    }

    // By created_at descending
    return b.created_at.localeCompare(a.created_at)
  })
}

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

type DateView = 'yesterday' | 'today' | 'tomorrow' | 'inbox'

export default function DashboardClient({ initialGoals, userEmail }: DashboardClientProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [goals, setGoals] = useState<Goal[]>(sortGoals(initialGoals))
  const [newGoalText, setNewGoalText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  
  // Date-based Swiper View State
  const [dateView, setDateView] = useState<DateView>('today')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Profile Avatar Dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Keyboard / Tips Dialog state
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Tag Dropdown state
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownTags, setDropdownTags] = useState<string[]>([])
  const [activeDropdownIndex, setActiveDropdownIndex] = useState(0)

  // Inline editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingTargetDate, setEditingTargetDate] = useState('')
  const [editingIsRecurring, setEditingIsRecurring] = useState(false)
  const [editingRecurrenceRule, setEditingRecurrenceRule] = useState('daily')

  // New goal form extras
  const [newTargetDate, setNewTargetDate] = useState('')
  const [newIsRecurring, setNewIsRecurring] = useState(false)
  const [newRecurrenceRule, setNewRecurrenceRule] = useState('daily')

  // Visual toggle sliding state
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync state if initialGoals changes
  useEffect(() => {
    setGoals(sortGoals(initialGoals))
  }, [initialGoals])

  // Auto-spawn recurring goal instances on dashboard load
  const spawnRecurringGoals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const recurringTemplates = goals.filter(g => g.is_recurring && !g.completed && !g.recurrence_parent_id)

    for (const template of recurringTemplates) {
      const today = todayStr()

      const existingChild = goals.find(g =>
        g.recurrence_parent_id === template.id &&
        g.target_date === today &&
        !g.completed
      )

      if (existingChild) continue

      const completedChild = goals.find(g =>
        g.recurrence_parent_id === template.id &&
        g.target_date === today &&
        g.completed
      )

      if (completedChild) continue

      const newId = crypto.randomUUID()
      const newGoal: Goal = {
        id: newId,
        title: template.title,
        completed: false,
        tags: [...template.tags],
        created_at: new Date().toISOString(),
        target_date: today,
        is_recurring: false,
        recurrence_rule: null,
        recurrence_parent_id: template.id
      }

      setGoals(prev => sortGoals([...prev, newGoal]))

      await supabase.from('goals').insert({
        id: newId,
        user_id: user.id,
        title: template.title,
        completed: false,
        tags: template.tags,
        target_date: today,
        is_recurring: false,
        recurrence_rule: null,
        recurrence_parent_id: template.id
      })
    }
  }, [goals, supabase])

  // Run auto-spawn once on mount
  const hasSpawned = useRef(false)
  useEffect(() => {
    if (!hasSpawned.current && goals.length > 0) {
      hasSpawned.current = true
      spawnRecurringGoals()
    }
  }, [goals.length, spawnRecurringGoals])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      )

      if (isTyping) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur()
        }
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === '1') {
        setStatusFilter('all')
      } else if (e.key === '2') {
        setStatusFilter('pending')
      } else if (e.key === '3') {
        setStatusFilter('completed')
      } else if (e.key === 'c' || e.key === 'C') {
        setSelectedTag(null)
      } else if (e.key === '?' || e.key === '/') {
        if (e.key === '?') {
          e.preventDefault()
          setShowHelpModal(prev => !prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Extract all unique tags
  const availableTags = Array.from(
    new Set(['work', 'health', 'personal', ...goals.flatMap(goal => goal.tags)])
  ).filter(tag => tag !== 'general')

  const handleInputChange = (text: string) => {
    setNewGoalText(text)
    
    const match = text.match(/\/([a-zA-Z0-9-]*)$/)
    if (match) {
      const query = match[1].toLowerCase()
      const filtered = availableTags.filter(tag => tag.toLowerCase().startsWith(query))
      setDropdownTags(filtered)
      setShowDropdown(filtered.length > 0)
      setActiveDropdownIndex(0)
    } else {
      setShowDropdown(false)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && dropdownTags.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveDropdownIndex(prev => (prev + 1) % dropdownTags.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveDropdownIndex(prev => (prev - 1 + dropdownTags.length) % dropdownTags.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectDropdownTag(dropdownTags[activeDropdownIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowDropdown(false)
      }
    }
  }

  const selectDropdownTag = (tag: string) => {
    const lastSlashIndex = newGoalText.lastIndexOf('/')
    const prefix = newGoalText.substring(0, lastSlashIndex)
    setNewGoalText(`${prefix}/${tag} `)
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const parseGoalText = (text: string) => {
    const tagRegex = /\/([a-zA-Z0-9-]+)/g
    const tags: string[] = []
    let match
    
    while ((match = tagRegex.exec(text)) !== null) {
      tags.push(match[1].toLowerCase())
    }

    const cleanTitle = text.replace(tagRegex, '').trim()
    return { title: cleanTitle, tags }
  }

  const handleAddGoal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newGoalText.trim()) return

    const { title, tags } = parseGoalText(newGoalText)
    if (!title) return

    // Default target date based on the active tab view (to be helpful)
    let finalTargetDate = newTargetDate || null
    if (!newTargetDate) {
      if (dateView === 'today') finalTargetDate = todayStr()
      else if (dateView === 'tomorrow') finalTargetDate = tomorrowStr()
      else if (dateView === 'yesterday') finalTargetDate = yesterdayStr()
    }

    const tempId = crypto.randomUUID()
    const newGoal: Goal = {
      id: tempId,
      title,
      completed: false,
      tags: tags.length > 0 ? tags : ['general'],
      created_at: new Date().toISOString(),
      target_date: finalTargetDate,
      is_recurring: newIsRecurring,
      recurrence_rule: newIsRecurring ? newRecurrenceRule : null,
      recurrence_parent_id: null
    }
    
    setGoals(prev => sortGoals([newGoal, ...prev]))
    setNewGoalText('')
    setNewTargetDate('')
    setNewIsRecurring(false)
    setNewRecurrenceRule('daily')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('goals').insert({
      id: tempId,
      user_id: user.id,
      title,
      completed: false,
      tags: tags.length > 0 ? tags : ['general'],
      target_date: finalTargetDate,
      is_recurring: newIsRecurring,
      recurrence_rule: newIsRecurring ? newRecurrenceRule : null,
      recurrence_parent_id: null
    })

    if (error) {
      console.error('Error inserting goal:', error)
      setGoals(prev => prev.filter(g => g.id !== tempId))
    }
  }

  const handleToggleGoal = async (id: string) => {
    const goalToToggle = goals.find(g => g.id === id)
    if (!goalToToggle) return

    if (goalToToggle.is_recurring && !goalToToggle.recurrence_parent_id) return

    const nextCompletedState = !goalToToggle.completed

    // Toggle completed status in list instantly (without sorting yet)
    setGoals(prev => prev.map(goal => 
      goal.id === id ? { ...goal, completed: nextCompletedState } : goal
    ))

    // Trigger visual slide animation
    setAnimatingId(id)

    // Wait for slide animation to complete before re-sorting array
    setTimeout(() => {
      setGoals(prev => sortGoals([...prev]))
      setAnimatingId(null)
    }, 400)

    const { error } = await supabase
      .from('goals')
      .update({ completed: nextCompletedState })
      .eq('id', id)

    if (error) {
      console.error('Error toggling goal:', error)
      // Rollback on error
      setGoals(prev => sortGoals(prev.map(goal => 
        goal.id === id ? { ...goal, completed: !nextCompletedState } : goal
      )))
    }
  }

  const handleDeleteGoal = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    const backupGoals = [...goals]
    setGoals(prev => prev.filter(goal => goal.id !== id))
    if (editingGoalId === id) setEditingGoalId(null)

    const { error } = await supabase.from('goals').delete().eq('id', id)

    if (error) {
      console.error('Error deleting goal:', error)
      setGoals(backupGoals)
    }
  }

  const handleStartEditing = (e: React.MouseEvent, goal: Goal) => {
    e.stopPropagation()
    setEditingGoalId(goal.id)
    const tagsSuffix = goal.tags.filter(t => t !== 'general').map(t => `/${t}`).join(' ')
    setEditingText(`${goal.title}${tagsSuffix ? ' ' + tagsSuffix : ''}`)
    setEditingTargetDate(goal.target_date || '')
    setEditingIsRecurring(goal.is_recurring)
    setEditingRecurrenceRule(goal.recurrence_rule || 'daily')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingText.trim()) return
    const { title, tags } = parseGoalText(editingText)
    if (!title) return

    const backupGoals = [...goals]
    setGoals(prev => sortGoals(prev.map(goal => 
      goal.id === id 
        ? {
            ...goal,
            title,
            tags: tags.length > 0 ? tags : ['general'],
            target_date: editingTargetDate || null,
            is_recurring: editingIsRecurring,
            recurrence_rule: editingIsRecurring ? editingRecurrenceRule : null
          } 
        : goal
    )))
    setEditingGoalId(null)

    const { error } = await supabase
      .from('goals')
      .update({
        title,
        tags: tags.length > 0 ? tags : ['general'],
        target_date: editingTargetDate || null,
        is_recurring: editingIsRecurring,
        recurrence_rule: editingIsRecurring ? editingRecurrenceRule : null
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating goal:', error)
      setGoals(backupGoals)
    }
  }

  const handleCancelEdit = () => {
    setEditingGoalId(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  // Swipe gesture handlers
  const minSwipeDistance = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    const views: DateView[] = ['yesterday', 'today', 'tomorrow', 'inbox']
    const currentIndex = views.indexOf(dateView)
    
    if (isLeftSwipe && currentIndex < views.length - 1) {
      setDateView(views[currentIndex + 1])
    } else if (isRightSwipe && currentIndex > 0) {
      setDateView(views[currentIndex - 1])
    }
  }

  // 1. Filter Goals based on status filter & tag filter
  const statusFiltered = goals.filter(goal => {
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'pending' && !goal.completed) ||
      (statusFilter === 'completed' && goal.completed)
    
    const matchesTag = !selectedTag || goal.tags.includes(selectedTag)
    return matchesStatus && matchesTag
  })

  // 2. Further Filter by dateView Slider
  const today = todayStr()
  const yesterday = yesterdayStr()
  const tomorrow = tomorrowStr()

  const filteredGoals = statusFiltered.filter(goal => {
    if (dateView === 'inbox') {
      return !goal.target_date
    }
    if (dateView === 'today') {
      return goal.target_date === today
    }
    if (dateView === 'tomorrow') {
      return goal.target_date === tomorrow
    }
    if (dateView === 'yesterday') {
      // Show yesterday's goals AND any overdue tasks (due before today, uncompleted)
      return goal.target_date && (goal.target_date === yesterday || (goal.target_date < today && !goal.completed))
    }
    return true
  })

  const pendingGoals = filteredGoals.filter(g => !g.completed)
  const completedGoals = filteredGoals.filter(g => g.completed)

  const countAll = goals.length
  const countPending = goals.filter(g => !g.completed).length
  const countCompleted = goals.filter(g => g.completed).length

  // Initials for avatar
  const initials = userEmail
    ? userEmail.split('@')[0].substring(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="app-container">
      <header className="header-compact">
        <div className="header-logo-row">
          <h1><span className="brand-company">Strivelin</span> Do</h1>
          
          <div className="header-actions">
            <button 
              type="button" 
              className="icon-action-btn"
              onClick={() => setShowHelpModal(true)}
              title="Show Keyboard Shortcuts & Guide"
            >
              <HelpCircle size={18} />
            </button>

            <div className="avatar-wrapper" ref={profileMenuRef}>
              <button 
                type="button"
                className="avatar-btn" 
                onClick={() => setShowProfileMenu(prev => !prev)}
                title="Profile Settings"
              >
                {initials}
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  <p className="profile-email">{userEmail}</p>
                  <hr className="profile-divider" />
                  <button onClick={handleSignOut} className="profile-signout-btn">
                    <LogOut size={14} style={{ marginRight: '0.4rem', display: 'inline' }} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Spotlight Input Box */}
      <form onSubmit={handleAddGoal} className="spotlight-wrapper" style={{ position: 'relative' }}>
        <div className="spotlight-input-row">
          <Plus className="spotlight-icon" size={24} />
          <input
            ref={inputRef}
            type="text"
            className="spotlight-input"
            placeholder="What is your next target? Add inline tags using /tag (e.g. Write reports /work)"
            value={newGoalText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
        </div>

        {/* Suggestions dropdown */}
        {showDropdown && dropdownTags.length > 0 && (
          <div className="tag-dropdown">
            {dropdownTags.map((tag, idx) => (
              <div
                key={tag}
                className={`tag-dropdown-item ${idx === activeDropdownIndex ? 'active' : ''}`}
                onClick={() => selectDropdownTag(tag)}
              >
                #{tag}
              </div>
            ))}
          </div>
        )}

        {/* Always-visible options row: Target Date + Recurrence */}
        <div className="form-extras-row">
          <div className="form-extra-item">
            <Calendar size={14} />
            <label>Due date</label>
            <input
              type="date"
              className="date-input"
              value={newTargetDate}
              onChange={(e) => setNewTargetDate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              min={todayStr()}
            />
            {newTargetDate && (
              <button type="button" className="clear-date-btn" onClick={() => setNewTargetDate('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="form-extra-item">
            <Repeat size={14} />
            <label className="recurring-toggle-label">
              <input
                type="checkbox"
                checked={newIsRecurring}
                onChange={(e) => setNewIsRecurring(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              Recurring
            </label>
            {newIsRecurring && (
              <select
                className="recurrence-select"
                value={newRecurrenceRule}
                onChange={(e) => setNewRecurrenceRule(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {RECURRENCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="spotlight-footer">
          <span>
            {newGoalText.trim() ? (
              <>Press <kbd>Enter</kbd> to add target</>
            ) : (
              <>Tip: Use tags to categorize like <code>/work</code> or <code>/health</code></>
            )}
          </span>
          <div className="shortcuts">
            <span>Focus: <kbd>Esc</kbd> / <kbd>N</kbd></span>
          </div>
        </div>
      </form>

      {/* Date Slider Selector */}
      <div className="date-view-slider">
        <button 
          onClick={() => setDateView('yesterday')}
          className={`slider-btn ${dateView === 'yesterday' ? 'active' : ''}`}
        >
          Yesterday
        </button>
        <button 
          onClick={() => setDateView('today')}
          className={`slider-btn ${dateView === 'today' ? 'active' : ''}`}
        >
          Today
        </button>
        <button 
          onClick={() => setDateView('tomorrow')}
          className={`slider-btn ${dateView === 'tomorrow' ? 'active' : ''}`}
        >
          Tomorrow
        </button>
        <button 
          onClick={() => setDateView('inbox')}
          className={`slider-btn ${dateView === 'inbox' ? 'active' : ''}`}
        >
          Inbox
        </button>
      </div>

      {/* Dashboard & Filters */}
      <div className="nav-filters">
        <div className="tabs">
          <button 
            onClick={() => setStatusFilter('all')} 
            className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
          >
            All <span className="goal-count">{countAll}</span>
          </button>
          <button 
            onClick={() => setStatusFilter('pending')} 
            className={`tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          >
            Pending <span className="goal-count">{countPending}</span>
          </button>
          <button 
            onClick={() => setStatusFilter('completed')} 
            className={`tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
          >
            Completed <span className="goal-count">{countCompleted}</span>
          </button>
        </div>

        <div className="shortcuts" style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Filters: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
        </div>
      </div>

      {/* Quick Tag Filtering Bar */}
      {availableTags.length > 0 && (
        <div className="tags-bar">
          <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Filter size={12} /> Tags:
          </span>
          <button 
            onClick={() => setSelectedTag(null)} 
            className={`tag-filter ${!selectedTag ? 'active' : ''}`}
          >
            All
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`tag-filter ${selectedTag === tag ? 'active' : ''}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Goals Content List — swipable container */}
      <div 
        className="goals-list-swipeable"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {filteredGoals.length > 0 ? (
          <>
            {/* Pending Goals */}
            {pendingGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isAnimating={animatingId === goal.id}
                editingGoalId={editingGoalId}
                editingText={editingText}
                editingTargetDate={editingTargetDate}
                editingIsRecurring={editingIsRecurring}
                editingRecurrenceRule={editingRecurrenceRule}
                setEditingText={setEditingText}
                setEditingTargetDate={setEditingTargetDate}
                setEditingIsRecurring={setEditingIsRecurring}
                setEditingRecurrenceRule={setEditingRecurrenceRule}
                onToggle={handleToggleGoal}
                onDelete={handleDeleteGoal}
                onStartEditing={handleStartEditing}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
              />
            ))}

            {/* Separator */}
            {pendingGoals.length > 0 && completedGoals.length > 0 && (
              <div className="completed-separator">
                <span>Completed</span>
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isAnimating={animatingId === goal.id}
                editingGoalId={editingGoalId}
                editingText={editingText}
                editingTargetDate={editingTargetDate}
                editingIsRecurring={editingIsRecurring}
                editingRecurrenceRule={editingRecurrenceRule}
                setEditingText={setEditingText}
                setEditingTargetDate={setEditingTargetDate}
                setEditingIsRecurring={setEditingIsRecurring}
                setEditingRecurrenceRule={setEditingRecurrenceRule}
                onToggle={handleToggleGoal}
                onDelete={handleDeleteGoal}
                onStartEditing={handleStartEditing}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
              />
            ))}
          </>
        ) : (
          <div className="empty-state">
            <ListTodo className="empty-icon" size={48} />
            <h3>No targets for {dateView}</h3>
            <p>
              {selectedTag 
                ? `You don't have any goals tagged with #${selectedTag} right now.`
                : "Swipe left/right to view other days, or add a goal above."
              }
            </p>
          </div>
        )}
      </div>

      {/* Help Dialog Modal */}
      {showHelpModal && (
        <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>Strivelin Do Guide</h3>
              <button className="help-modal-close" onClick={() => setShowHelpModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="help-modal-body">
              <div className="help-section">
                <h4>Swipe Gestures</h4>
                <p>Swipe left/right on the list to toggle views (Yesterday ⇄ Today ⇄ Tomorrow ⇄ Inbox).</p>
              </div>
              <div className="help-section">
                <h4>Inline Tagging</h4>
                <p>Add tags automatically by typing <code>/tagname</code> directly in your goal text (e.g. <code>Do chores /home</code>).</p>
              </div>
              <div className="help-section">
                <h4>Keyboard Shortcuts</h4>
                <ul>
                  <li><kbd>N</kbd> — Focus task entry</li>
                  <li><kbd>Esc</kbd> — Unfocus task entry / cancel edit</li>
                  <li><kbd>1</kbd> — Show All goals filter</li>
                  <li><kbd>2</kbd> — Show Pending filter</li>
                  <li><kbd>3</kbd> — Show Completed filter</li>
                  <li><kbd>?</kbd> — Toggle this guide</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── GoalCard Component ──────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal
  isAnimating: boolean
  editingGoalId: string | null
  editingText: string
  editingTargetDate: string
  editingIsRecurring: boolean
  editingRecurrenceRule: string
  setEditingText: (v: string) => void
  setEditingTargetDate: (v: string) => void
  setEditingIsRecurring: (v: boolean) => void
  setEditingRecurrenceRule: (v: string) => void
  onToggle: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  onStartEditing: (e: React.MouseEvent, goal: Goal) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
}

function GoalCard({
  goal,
  isAnimating,
  editingGoalId,
  editingText,
  editingTargetDate,
  editingIsRecurring,
  editingRecurrenceRule,
  setEditingText,
  setEditingTargetDate,
  setEditingIsRecurring,
  setEditingRecurrenceRule,
  onToggle,
  onDelete,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
}: GoalCardProps) {
  const isEditing = editingGoalId === goal.id
  const dueStatus = goal.completed ? 'none' : getDueStatus(goal.target_date)
  const isRecurringTemplate = goal.is_recurring && !goal.recurrence_parent_id
  const isRecurringChild = !!goal.recurrence_parent_id

  const animationClass = isAnimating
    ? (goal.completed ? 'animating-slide-down' : 'animating-slide-up')
    : ''

  return (
    <div 
      className={`goal-card ${goal.completed ? 'completed' : ''} ${dueStatus !== 'none' ? `due-${dueStatus}` : ''} ${animationClass}`}
      onClick={() => onToggle(goal.id)}
    >
      <div className="goal-left">
        <div className={`checkbox-ring ${isRecurringTemplate ? 'recurring-template' : ''}`}>
          {isRecurringTemplate ? (
            <Repeat size={12} strokeWidth={2.5} />
          ) : (
            <Check size={14} strokeWidth={3} />
          )}
        </div>
        
        {isEditing ? (
          <div className="edit-form-container" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className="spotlight-input"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(goal.id)
                if (e.key === 'Escape') onCancelEdit()
              }}
              autoFocus
              style={{ borderBottom: '1px solid #6366f1', padding: '2px 0' }}
            />
            <div className="edit-extras-row">
              <div className="form-extra-item compact">
                <Calendar size={12} />
                <input
                  type="date"
                  className="date-input small"
                  value={editingTargetDate}
                  onChange={(e) => setEditingTargetDate(e.target.value)}
                />
                {editingTargetDate && (
                  <button type="button" className="clear-date-btn" onClick={() => setEditingTargetDate('')}>
                    <X size={10} />
                  </button>
                )}
              </div>
              <div className="form-extra-item compact">
                <label className="recurring-toggle-label small">
                  <input
                    type="checkbox"
                    checked={editingIsRecurring}
                    onChange={(e) => setEditingIsRecurring(e.target.checked)}
                  />
                  <Repeat size={12} />
                </label>
                {editingIsRecurring && (
                  <select
                    className="recurrence-select small"
                    value={editingRecurrenceRule}
                    onChange={(e) => setEditingRecurrenceRule(e.target.value)}
                  >
                    {RECURRENCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="goal-text-container">
            <div className="goal-title-row">
              <span className="goal-title">{goal.title}</span>
              {(isRecurringTemplate || isRecurringChild) && (
                <span className="recurring-badge" title={isRecurringTemplate ? `Recurring ${goal.recurrence_rule}` : 'Recurring instance'}>
                  <Repeat size={11} />
                  {isRecurringTemplate && goal.recurrence_rule && (
                    <span className="recurrence-label">{goal.recurrence_rule}</span>
                  )}
                </span>
              )}
            </div>
            <div className="goal-meta-row">
              <div className="goal-tags">
                {goal.tags.filter(t => t !== 'general').map(tag => (
                  <span key={tag} className={`tag-badge ${['work', 'health', 'personal'].includes(tag) ? tag : 'default'}`}>
                    {tag}
                  </span>
                ))}
              </div>
              {goal.target_date && (
                <span className={`due-badge ${dueStatus}`}>
                  <Calendar size={11} />
                  {formatDate(goal.target_date)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="goal-actions">
        {isEditing ? (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onSaveEdit(goal.id); }} 
              className="action-btn"
              title="Save Edit"
            >
              <Check size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onCancelEdit(); }} 
              className="action-btn"
              title="Cancel Edit"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={(e) => onStartEditing(e, goal)} 
              className="action-btn"
              title="Edit Goal"
            >
              <Edit3 size={16} />
            </button>
            <button 
              onClick={(e) => onDelete(e, goal.id)} 
              className="action-btn delete"
              title="Delete Goal"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
