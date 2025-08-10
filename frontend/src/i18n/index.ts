export type Messages = Record<string, string>;

const uz: Messages = {
  appTitle: "Uz→En O‘rganish",
  folders: "Jildlar",
  yourFolders: "Jildlaringiz",
  newFolder: "Yangi jild",
  newFolderPlaceholder: "Jild nomi",
  createIn: "Yaratiladigan joy: {place}",
  root: "Ildiz",
  back: "Orqaga",
  loadingFolders: "Jildlar yuklanmoqda…",
  noFoldersYet: "Hozircha jildlar yo‘q",
  nameLabel: "Nomi",
  nameHelper: "1–100 ta belgi",
  nameExists: "Bunday nom allaqachon mavjud",
  cancel: "Bekor qilish",
  create: "Yaratish",
  folderCreated: "Jild yaratildi",
  unauthorized: "Ruxsat yo‘q",
  loginWithTelegram: "Telegram orqali kirish",
  loggingIn: "Kirish…",
  loggedInAs: "Kirish holati:",
  helloTitle: "Assalomu alaykum, O‘zbekcha–Inglizcha o‘rganish ilovasi",
  environmentTWA: "Muhit: Telegram WebApp ✅",
  andHelloName: "— Salom, {name}!",
  errorLoadFolders: "Jildlarni yuklab bo‘lmadi",
  errorCreateFolder: "Jild yaratishda xatolik",
};

const en: Messages = {
  appTitle: "Uz→En Learning",
  folders: "Folders",
  yourFolders: "Your folders",
  newFolder: "New Folder",
  newFolderPlaceholder: "Folder name",
  createIn: "Create in: {place}",
  root: "Root",
  back: "Back",
  loadingFolders: "Loading folders…",
  noFoldersYet: "No folders yet",
  nameLabel: "Name",
  nameHelper: "1–100 characters",
  nameExists: "Name already exists",
  cancel: "Cancel",
  create: "Create",
  folderCreated: "Folder created",
  unauthorized: "Unauthorized",
  loginWithTelegram: "Login with Telegram",
  loggingIn: "Logging in…",
  loggedInAs: "Logged in as:",
  helloTitle: "Hello, Uzbek-English Learning App",
  environmentTWA: "Environment: Telegram WebApp ✅",
  andHelloName: "— Hello, {name}!",
  errorLoadFolders: "Failed to load folders",
  errorCreateFolder: "Failed to create folder",
};

const dict: Record<string, Messages> = { uz, en };
let currentLocale = "uz";

export function setLocale(locale: string) {
  currentLocale = dict[locale] ? locale : "en";
}

export function getLocale() {
  return currentLocale;
}

export function t(
  key: keyof Messages,
  vars?: Record<string, string | number>
): string {
  const msg =
    (dict[currentLocale] && dict[currentLocale][key]) ||
    dict.en[key] ||
    String(key);
  if (!vars) return msg;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    msg
  );
}
