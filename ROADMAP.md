# Strivelin Do — Project Roadmap & Task List

This roadmap tracks completed features and planned future tasks. Kept directly in the workspace for version control.

---

## Phase 1: Core Enhancements (Completed)

- [x] Create database migration (add target_date, is_recurring, recurrence_rule, recurrence_parent_id)
- [x] Update server component (page.tsx) — sort completed last
- [x] Update Goal interface in DashboardClient.tsx
- [x] Add target date input to spotlight form
- [x] Add recurring toggle + frequency selector to spotlight form
- [x] Implement client-side sorting (pending first → by target date → by created_at)
- [x] Add "Completed" separator in the goals list
- [x] Display target date on goal cards with overdue/due-today indicators
- [x] Display recurring icon on recurring goals
- [x] Implement auto-spawn logic for recurring goals on server side
- [x] Add recurring frequency edit to goal edit mode
- [x] Add CSS styles for new UI elements
- [x] Configure custom email sender/template in Supabase Auth settings

---

## Phase 2: Teams & Collaborative Tasks (Planned)

- [ ] **Teams/Groups Functionality**:
  - [ ] Database schema for teams, team memberships, and team-associated goals.
  - [ ] UI to create, invite, and join groups/teams.
  - [ ] Shared task view where any team member can check off a goal.
  - [ ] Activity Log / History tracking (who created, modified, completed, or reopened a task).
- [ ] **Collaborative UX Rework**:
  - [ ] Rework the User Experience (UX) based on team sharing constraints and feedback.
