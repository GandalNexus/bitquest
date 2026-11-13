/**
 * Wrapper Studio : réutilise la page admin `NewCoursePage`. Le form
 * `CourseForm` détecte le préfixe courant via `useContentBasePath()`
 * et route ses redirects vers `/studio/courses`.
 */
export { default } from "@/app/(admin)/admin/courses/new/page";
export { metadata } from "@/app/(admin)/admin/courses/new/page";
