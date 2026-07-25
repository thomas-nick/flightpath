import { createFileRoute, notFound } from "@tanstack/react-router";
import { CourseHubView } from "../../components/flightpath/course-hub";
import { PageShell } from "../../components/flightpath/site-chrome";
import { getCourseBySlug } from "../../lib/courses";

export const Route = createFileRoute("/courses/$slug")({
  loader: ({ params }) => {
    const course = getCourseBySlug(params.slug);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.course;
    return {
      meta: [
        {
          title: c
            ? `${c.name} Disc Golf Course — Flightpath Asia`
            : "Course — Flightpath Asia",
        },
        {
          name: "description",
          content: c
            ? `${c.name}, ${c.country || c.country_key}: ${c.event_count} PDGA tournaments hosted and ${c.distinct_winners} distinct winners in the Asia archive.`
            : "Asia disc golf course hub.",
        },
      ],
    };
  },
  component: CoursePage,
});

function CoursePage() {
  const { course } = Route.useLoaderData();
  return (
    <PageShell>
      <CourseHubView course={course} />
    </PageShell>
  );
}
