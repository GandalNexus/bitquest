import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "../course-form";

export const metadata = { title: "Nouveau cours — Admin BitQuest" };

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/courses">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau cours</CardTitle>
          <CardDescription>
            Crée un parcours vide ; les chapitres et leçons s&apos;ajoutent ensuite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm
            mode="create"
            initial={{
              slug: "",
              title: "",
              subtitle: "",
              description: "",
              coverIcon: "BookOpen",
              order: 0,
              publishedAt: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
