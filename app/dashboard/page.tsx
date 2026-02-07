// app/dashboard/page.tsx
/*  import { getCurrentUser, logoutUser } from '@/app/actions/auth'; 
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell'; // Nous allons créer ce composant juste après
 */
// Ce composant s'exécute sur le serveur
/* export default async function DashboardPage() {
    return <DashboardShell/>;
    }
  const user = await getCurrentUser();

  // Sécurité : si pas d'utilisateur, rediriger (le middleware le fait déjà, mais c'est une double sécurité)
  if (!user) {
    redirect('/login');
  }  */

  // On passe les données utilisateur au composant Client 

  import DashboardShell from '@/components/DashboardShell';

export default async function DashboardPage() {
  // Utilisateur fictif pour les tests
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    level: 5,
    xp: 1250,
    sats: 50000,
    createdAt: new Date(),
  };

  return <DashboardShell user={mockUser} />;
}