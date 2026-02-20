import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { getUserQuests } from '@/app/actions/quests';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const quests = await getUserQuests(user.id);

  return <DashboardShell user={user} quests={quests} />;
}