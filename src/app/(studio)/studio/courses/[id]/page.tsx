/**
 * Wrapper Studio : réutilise la page admin `EditCoursePage`. Les
 * forms `CourseForm` et `ChapterForm` détectent le préfixe via
 * `useContentBasePath()` et routent leurs redirects vers `/studio`.
 *
 * Note : les `<Link href="/admin/..."/>` SSR dans le wrapper restent
 * admin-préfixés (ce sont des Server Components, pas de hook). Un
 * EDITOR cliquant « Retour à la liste » depuis Studio tombera sur
 * `/admin/courses` → layout admin le laisse passer (gate EDITOR+).
 */
export { default } from "@/app/(admin)/admin/courses/[id]/page";
export const dynamic = "force-dynamic";
