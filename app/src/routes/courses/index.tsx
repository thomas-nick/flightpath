import { createFileRoute } from "@tanstack/react-router";
import { CourseDirectory } from "../../components/flightpath/course-directory";
import { CourseDirectoryHero } from "../../components/flightpath/course-directory-hero";
import { PageShell } from "../../components/flightpath/site-chrome";
import { totalCourses } from "../../lib/courses";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — Flightpath Asia" },
      {
        name: "description",
        content: `Browse ${totalCourses()} disc golf courses across Asia — holes, par, year established, location map, and tournaments played at each.`,
      },
    ],
  }),
  component: CoursesIndex,
});

function CoursesIndex() {
  return (
    <PageShell>
      <CourseDirectoryHero />
      <CourseDirectory />
    </PageShell>
  );
}
