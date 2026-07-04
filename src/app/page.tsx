import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from '@/components/DashboardClient'

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

function todayStr(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Helper: check if a recurring template should spawn an instance today (Server-side)
function shouldSpawnToday(template: Goal): boolean {
  const rule = template.recurrence_rule
  if (!rule) return false

  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  if (rule === 'daily') {
    return true
  }
  if (rule === 'weekdays') {
    // Monday (1) to Friday (5)
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }
  if (rule === 'weekly') {
    // Spawn only if the day of week matches the template's creation day of week
    const createdDate = new Date(template.created_at)
    return dayOfWeek === createdDate.getDay()
  }
  if (rule === 'monthly') {
    // Spawn only if the day of month matches the template's creation day of month
    const createdDate = new Date(template.created_at)
    return today.getDate() === createdDate.getDate()
  }

  return true
}

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Fetch current goals
  const { data: allGoals, error: fetchError } = await supabase
    .from('goals')
    .select('*')

  if (fetchError) {
    console.error('Error fetching goals:', fetchError)
  }

  const goalsList: Goal[] = allGoals || []

  // 2. Identify templates that need spawning today
  const today = todayStr()
  const templates = goalsList.filter(g => g.is_recurring && !g.completed && !g.recurrence_parent_id)
  
  let needsReload = false

  for (const template of templates) {
    if (!shouldSpawnToday(template)) continue

    // Check if child already spawned for today (completed or uncompleted)
    const hasChildToday = goalsList.some(g =>
      g.recurrence_parent_id === template.id &&
      g.target_date === today
    )

    if (hasChildToday) continue

    // Spawn a new child goal
    const newId = crypto.randomUUID()
    const { error: insertError } = await supabase.from('goals').insert({
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

    if (insertError) {
      console.error('Error auto-spawning recurring template:', insertError)
    } else {
      needsReload = true
    }
  }

  // 3. Re-fetch goals if we auto-spawned new items to ensure sorting and initialGoals are fresh
  let finalGoals = goalsList
  if (needsReload) {
    const { data: updatedGoals } = await supabase
      .from('goals')
      .select('*')
    if (updatedGoals) {
      finalGoals = updatedGoals
    }
  }

  // Sort: pending first (completed pushed to bottom), then by target_date (nearest due first), then newest first
  const sortedGoals = finalGoals.sort((a, b) => {
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

  return (
    <DashboardClient 
      initialGoals={sortedGoals} 
      userEmail={user.email || ''} 
    />
  )
}
