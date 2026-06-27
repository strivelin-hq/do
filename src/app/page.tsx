import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from '@/components/DashboardClient'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch initial goals linked to authenticated user_id
  // Sort: pending first (completed pushed to bottom), then by target_date (nearest due first), then newest first
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .order('completed', { ascending: true })
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching goals:', error)
  }

  return (
    <DashboardClient 
      initialGoals={goals || []} 
      userEmail={user.email || ''} 
    />
  )
}
