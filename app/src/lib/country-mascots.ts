/** Clean sticker mascots for country marks / featured leaders. */

export const COUNTRY_MASCOTS: Record<
  string,
  { key: string; name: string; animal: string; src: string }
> = {
  TH: {
    key: "TH",
    name: "Thailand",
    animal: "Asian elephant",
    src: "/countries/mascots/sticker/th.png",
  },
  CN: {
    key: "CN",
    name: "China",
    animal: "Giant panda",
    src: "/countries/mascots/sticker/cn.png",
  },
  JP: {
    key: "JP",
    name: "Japan",
    animal: "Tanuki",
    src: "/countries/mascots/sticker/jp.png",
  },
  KR: {
    key: "KR",
    name: "South Korea",
    animal: "Korean tiger",
    src: "/countries/mascots/sticker/kr.png",
  },
  PH: {
    key: "PH",
    name: "Philippines",
    animal: "Carabao",
    src: "/countries/mascots/sticker/ph.png",
  },
  SG: {
    key: "SG",
    name: "Singapore",
    animal: "Otter",
    src: "/countries/mascots/sticker/sg.png",
  },
  MY: {
    key: "MY",
    name: "Malaysia",
    animal: "Malayan tapir",
    src: "/countries/mascots/sticker/my.png",
  },
  TW: {
    key: "TW",
    name: "Chinese Taipei",
    animal: "Formosan black bear",
    src: "/countries/mascots/sticker/tw.png",
  },
  VN: {
    key: "VN",
    name: "Vietnam",
    animal: "Water buffalo",
    src: "/countries/mascots/sticker/vn.png",
  },
  KH: {
    key: "KH",
    name: "Cambodia",
    animal: "Peacock",
    src: "/countries/mascots/sticker/kh.png",
  },
  HK: {
    key: "HK",
    name: "Hong Kong",
    animal: "Chinese white dolphin",
    src: "/countries/mascots/sticker/hk.png",
  },
  MN: {
    key: "MN",
    name: "Mongolia",
    animal: "Mongolian horse",
    src: "/countries/mascots/sticker/mn.png",
  },
};

export function getCountryMascot(countryKey: string) {
  return COUNTRY_MASCOTS[countryKey.toUpperCase()] ?? null;
}
