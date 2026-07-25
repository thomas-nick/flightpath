/** National crest stickers — lithograph seals matching the hero topographic language. */

export const COUNTRY_CRESTS: Record<
  string,
  { key: string; name: string; src: string }
> = {
  JP: { key: "JP", name: "Japan", src: "/countries/crests/jp.png" },
  CN: { key: "CN", name: "China", src: "/countries/crests/cn.png" },
  TH: { key: "TH", name: "Thailand", src: "/countries/crests/th.png" },
  PH: { key: "PH", name: "Philippines", src: "/countries/crests/ph.png" },
  KR: { key: "KR", name: "South Korea", src: "/countries/crests/kr.png" },
  SG: { key: "SG", name: "Singapore", src: "/countries/crests/sg.png" },
  MY: { key: "MY", name: "Malaysia", src: "/countries/crests/my.png" },
  TW: { key: "TW", name: "Chinese Taipei", src: "/countries/crests/tw.png" },
  VN: { key: "VN", name: "Vietnam", src: "/countries/crests/vn.png" },
  KH: { key: "KH", name: "Cambodia", src: "/countries/crests/kh.png" },
  HK: { key: "HK", name: "Hong Kong", src: "/countries/crests/hk.png" },
  MN: { key: "MN", name: "Mongolia", src: "/countries/crests/mn.png" },
};

export function getCountryCrest(countryKey: string) {
  return COUNTRY_CRESTS[countryKey.toUpperCase()] ?? null;
}
