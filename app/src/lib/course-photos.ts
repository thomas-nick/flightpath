/** Higgsfield-generated photographic course heroes (gpt_image_2) for the top
 * 12 most-played Asian courses. Falls back to the Leaflet map / flag tile
 *  elsewhere when a photo is absent. */

export const COURSE_PHOTOS: Record<string, { slug: string; src: string }> = {
  "laem-sor-beach-disc-golf-course": {
    slug: "laem-sor-beach-disc-golf-course",
    src: "/courses/photos/laem-sor-beach-disc-golf-course.png",
  },
  "samui-disc-golf": { slug: "samui-disc-golf", src: "/courses/photos/samui-disc-golf.png" },
  "gymkhana-disc-golf": {
    slug: "gymkhana-disc-golf",
    src: "/courses/photos/gymkhana-disc-golf.png",
  },
  "lanna-rocks-disc-golf-course": {
    slug: "lanna-rocks-disc-golf-course",
    src: "/courses/photos/lanna-rocks-disc-golf-course.png",
  },
  "mango-valley-dg": { slug: "mango-valley-dg", src: "/courses/photos/mango-valley-dg.png" },
  "rock-n-river-disc-golf-course": {
    slug: "rock-n-river-disc-golf-course",
    src: "/courses/photos/rock-n-river-disc-golf-course.png",
  },
  "sand-creek-disc-golf": {
    slug: "sand-creek-disc-golf",
    src: "/courses/photos/sand-creek-disc-golf.png",
  },
  "bei-jing-wen-yu-he-fei-gao-gong-yuan": {
    slug: "bei-jing-wen-yu-he-fei-gao-gong-yuan",
    src: "/courses/photos/bei-jing-wen-yu-he-fei-gao-gong-yuan.png",
  },
  "ngp-hitachi-kaihin": {
    slug: "ngp-hitachi-kaihin",
    src: "/courses/photos/ngp-hitachi-kaihin.png",
  },
  "siem-reap-disc-golf-course": {
    slug: "siem-reap-disc-golf-course",
    src: "/courses/photos/siem-reap-disc-golf-course.png",
  },
  "wat-chedi-temple-course": {
    slug: "wat-chedi-temple-course",
    src: "/courses/photos/wat-chedi-temple-course.png",
  },
  "daegu-environment-resources-park": {
    slug: "daegu-environment-resources-park",
    src: "/courses/photos/daegu-environment-resources-park.png",
  },
};

export function getCoursePhoto(slug: string): { slug: string; src: string } | null {
  return COURSE_PHOTOS[slug] ?? null;
}
