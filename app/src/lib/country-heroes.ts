/** Modern topographic hero cards for country hub pages — matches the landing hero language. */

export const COUNTRY_HEROES: Record<
  string,
  { key: string; name: string; src: string }
> = {
  JP: { key: "JP", name: "Japan", src: "/countries/heroes-modern/jp.png" },
  CN: { key: "CN", name: "China", src: "/countries/heroes-modern/cn.png" },
  TH: { key: "TH", name: "Thailand", src: "/countries/heroes-modern/th.png" },
  PH: { key: "PH", name: "Philippines", src: "/countries/heroes-modern/ph.png" },
  KR: { key: "KR", name: "South Korea", src: "/countries/heroes-modern/kr.png" },
  SG: { key: "SG", name: "Singapore", src: "/countries/heroes-modern/sg.png" },
  MY: { key: "MY", name: "Malaysia", src: "/countries/heroes-modern/my.png" },
  TW: { key: "TW", name: "Chinese Taipei", src: "/countries/heroes-modern/tw.png" },
  VN: { key: "VN", name: "Vietnam", src: "/countries/heroes-modern/vn.png" },
  KH: { key: "KH", name: "Cambodia", src: "/countries/heroes-modern/kh.png" },
  HK: { key: "HK", name: "Hong Kong", src: "/countries/heroes-modern/hk.png" },
  MN: { key: "MN", name: "Mongolia", src: "/countries/heroes-modern/mn.png" },
};

export function getCountryHero(countryKey: string) {
  return COUNTRY_HEROES[countryKey.toUpperCase()] ?? null;
}
