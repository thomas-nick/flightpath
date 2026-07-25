/** Photographic country card images (Higgsfield gpt_image_2). Falls back to
 * the topographic heroes in country-heroes.ts when a photo is missing. */

export const COUNTRY_PHOTOS: Record<
  string,
  { key: string; name: string; src: string }
> = {
  JP: { key: "JP", name: "Japan", src: "/countries/photos/jp.png" },
  CN: { key: "CN", name: "China", src: "/countries/photos/cn.png" },
  TH: { key: "TH", name: "Thailand", src: "/countries/photos/th.png" },
  PH: { key: "PH", name: "Philippines", src: "/countries/photos/ph.png" },
  KR: { key: "KR", name: "South Korea", src: "/countries/photos/kr.png" },
  SG: { key: "SG", name: "Singapore", src: "/countries/photos/sg.png" },
  MY: { key: "MY", name: "Malaysia", src: "/countries/photos/my.png" },
  TW: { key: "TW", name: "Chinese Taipei", src: "/countries/photos/tw.png" },
  VN: { key: "VN", name: "Vietnam", src: "/countries/photos/vn.png" },
  KH: { key: "KH", name: "Cambodia", src: "/countries/photos/kh.png" },
  HK: { key: "HK", name: "Hong Kong", src: "/countries/photos/hk.png" },
  MN: { key: "MN", name: "Mongolia", src: "/countries/photos/mn.png" },
};

export function getCountryPhoto(countryKey: string) {
  return COUNTRY_PHOTOS[countryKey.toUpperCase()] ?? null;
}
