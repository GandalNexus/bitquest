import { getQuestById, getQuizByQuestId } from '@/app/actions/quests';
import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import QuestPage from './QuestPage';

export default async function QuestDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const questId = parseInt(params.id);
  const quest = await getQuestById(questId);
  const quiz = await getQuizByQuestId(questId);

  if (!quest) {
    return <div>Quest not found</div>;
  }

  return <QuestPage quest={quest} quiz={quiz} user={user} />;
}
