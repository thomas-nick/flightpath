import { Link } from "@tanstack/react-router";
import { courseSlugFromLocation, getCourseBySlug } from "../../lib/courses";

/**
 * Renders the host venue of an event as a link to its course page when the
 * venue exists in the courses dataset, otherwise plain text. Used on event
 * rows across the events archive and country hubs.
 */
export function CourseLink({
  location,
  className,
  selfSlug,
}: {
  location: string | undefined | null;
  className?: string;
  /** When set, render plain text instead of a link if the venue resolves to this slug. */
  selfSlug?: string;
}) {
  const text = location?.trim() || "Asia";
  const slug = courseSlugFromLocation(location);
  const course = slug ? getCourseBySlug(slug) : null;
  if (!course || (selfSlug && course.slug === selfSlug)) {
    return <span className={className}>{course ? course.name : text}</span>;
  }
  return (
    <Link
      to="/courses/$slug"
      params={{ slug: course.slug }}
      className={className ?? "fp-course-link"}
    >
      {course.name}
    </Link>
  );
}
