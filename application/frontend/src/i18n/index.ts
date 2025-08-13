import { useEffect, useState } from "react";

export const locales = [
  { code: "en", label: "English" },
  { code: "uz", label: "O'zbek" },
];

let current = "en";

const strings: Record<string, Record<string, string>> = {
  en: {
    appTitle: "LinguaText",
    helloTitle: "Study English by Text",
    environmentTWA: "Welcome to the app!",
    andHelloName: "and hello, {name}!",
    folders: "Folders",
    texts: "Texts",
    vocabulary: "Vocabulary",
    newFolder: "New folder",
    createIn: "Create in {place}",
    root: "Root",
    nameLabel: "Name",
    newFolderPlaceholder: "My folder",
    nameHelper: "1-100 characters",
    cancel: "Cancel",
    create: "Create",
    unauthorized: "Please log in",
    errorLoadFolders: "Failed to load folders",
    folderCreated: "Folder created",
    nameExists: "Name already exists",
    rename: "Rename",
    delete: "Delete",
    confirmDeleteFolder: "Delete this folder (and everything inside)?",
    confirmDeleteText: "Delete this text?",
    failed: "Failed",
    addText: "Add text",
    titleLabel: "Title",
    uzRawLabel: "Uzbek text",
    enRawLabel: "English text",
    pleaseFillAllFieldsCorrectly: "Please fill all fields correctly",
    createText: "Create text",
    textCreated: "Text created",
    failedOpenEditor: "Failed to open editor",
    textUpdated: "Text updated",
    library: "Library",
    makeGlobal: "Make global",
    unpublish: "Unpublish",
    published: "Published",
    unpublished: "Unpublished",
    import: "Import",
    importFolder: "Import folder",
    namePrefix: "Name prefix",
    imported: "Imported",
    back: "Back",
    loading: "Loading...",
    addToVocabulary: "Add to vocabulary",
    wordLabel: "Word",
    translationLabel: "Translation",
    noteLabel: "Note",
    save: "Save",
    noSentences: "No items found",
    translationFirst: "Translation first",
    wordFirst: "Word first",
    search: "Search",
  },
  uz: {
    appTitle: "LinguaText",
    helloTitle: "Matn orqali ingliz tilini o'rganing",
    environmentTWA: "Ilovaga xush kelibsiz!",
    andHelloName: "salom, {name}!",
    folders: "Jildlar",
    texts: "Matnlar",
    vocabulary: "Lug'at",
    newFolder: "Yangi jild",
    createIn: "Qayerda yaratish: {place}",
    root: "Ildiz",
    nameLabel: "Nomi",
    newFolderPlaceholder: "Mening jildim",
    nameHelper: "1-100 ta belgi",
    cancel: "Bekor qilish",
    create: "Yaratish",
    unauthorized: "Iltimos, tizimga kiring",
    errorLoadFolders: "Jildlarni yuklab bo'lmadi",
    folderCreated: "Jild yaratildi",
    nameExists: "Bunday nom allaqachon mavjud",
    rename: "Nomini o'zgartirish",
    delete: "O'chirish",
    confirmDeleteFolder: "Bu jildni (ichidagini ham) o'chiraymi?",
    confirmDeleteText: "Bu matnni o'chiraymi?",
    failed: "Xatolik",
    addText: "Matn qo'shish",
    titleLabel: "Sarlavha",
    uzRawLabel: "O'zbekcha matn",
    enRawLabel: "Inglizcha matn",
    pleaseFillAllFieldsCorrectly: "Maydonlarni to'g'ri to'ldiring",
    createText: "Matn yaratish",
    textCreated: "Matn yaratildi",
    failedOpenEditor: "Tahrirlash oynasini ochib bo'lmadi",
    textUpdated: "Yangilandi",
    library: "Kutubxona",
    makeGlobal: "Ommaviy qilish",
    unpublish: "Ommaviydan olish",
    published: "Ommaviy qilindi",
    unpublished: "Ommaviydan olindi",
    import: "Import",
    importFolder: "Jildni import qilish",
    namePrefix: "Nom oldidan qo'shimcha",
    imported: "Import qilindi",
    back: "Orqaga",
    loading: "Yuklanmoqda...",
    addToVocabulary: "Lug'atga qo'shish",
    wordLabel: "So'z",
    translationLabel: "Tarjima",
    noteLabel: "Izoh",
    save: "Saqlash",
    noSentences: "Hali hech narsa yo'q",
    translationFirst: "Avval tarjima",
    wordFirst: "Avval so'z",
    search: "Qidirish",
  },
};

export function t(key: string, params?: Record<string, string | number>) {
  const dict = strings[current] || strings.en;
  let value = dict[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

export function setLocale(code: string) {
  current = strings[code] ? code : "en";
  try {
    localStorage.setItem("locale", current);
  } catch {}
}

export function ensureInitialLocale() {
  try {
    const saved = localStorage.getItem("locale");
    if (saved && strings[saved]) current = saved;
  } catch {}
}

export function useLocale() {
  const [loc, setLoc] = useState(current);
  useEffect(() => {
    setLoc(current);
  }, []);
  return loc;
}

export function getLocale() {
  return current;
}
