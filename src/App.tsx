import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { auth, db, storage } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

type Screen = "onboarding" | "landing" | "auth" | "home" | "match" | "chat" | "privacy" | "terms" | "contact";
type AuthMode = "login" | "register";
type Tab = "home" | "chat" | "profile" | "premium";
type Mood = { id: string; emoji: string; title: string; desc: string; color: string };
type Message = { id: number | string; from: "me" | "bot" | "system"; text: string; time?: string; uid?: string; type?: "text" | "voice" | "image"; voiceUrl?: string; duration?: string; imageUrl?: string };
type Plan = { name: string; price: string; tag: string; features: string[]; highlight?: boolean };
type OnboardingSlide = { emoji: string; title: string; text: string; tag: string };
type MatchMetric = { label: string; value: number; icon: string };
type ActivityItem = { icon: string; title: string; text: string; time: string };
type DiscoverCard = { emoji: string; title: string; tag: string; match: number };
type RegionProfile = { country: string; city: string; language: string; timezone: string; mode: "local" | "country" | "global" };
type SupportMessage = { id: number; from: "user" | "support"; text: string; time: string };
type AppNotification = { id: number; title: string; text: string; time: string; read: boolean; icon: string };
type VibeStory = { id: number; imageUrl: string; caption: string; time: string };
type SavedAura = { id: number; name: string; mood: string; match: number; lastSeen: string; avatar: string };
type GlobalRoomMessage = { id: number; user: string; text: string; country: string; time: string };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ONBOARDING: OnboardingSlide[] = [
  {
    emoji: "💜",
    tag: "Premium mood matching",
    title: "Gerçek bağlar kur.",
    text: "Lyvora, seçtiğin moda göre daha zarif, akıcı ve gerçek sohbet hissi veren premium bir deneyim sunar."
  },
  {
    emoji: "💬",
    tag: "Fluid live experience",
    title: "Gerçek uygulama hissiyle akar.",
    text: "Akıcı yazıyor efekti, canlı online hissi ve yumuşak mesaj geçişleriyle premium app deneyimi."
  },
  {
    emoji: "🚀",
    tag: "Signature app polish",
    title: "Launch-ready sosyal deneyim.",
    text: "İlk ekrandan sohbet akışına kadar modern, temiz ve launch-ready bir mobil deneyim sunar."
  }
];

const MOODS: Mood[] = [
  { id: "bored", emoji: "✦", title: "Sıkıldım", desc: "Kafa dağıtan yumuşak sohbet.", color: "#38bdf8" },
  { id: "night", emoji: "☾", title: "Gece modu", desc: "Loş, sakin ve derin konuşmalar.", color: "#818cf8" },
  { id: "bond", emoji: "◈", title: "Gerçek bağ", desc: "Samimi ve anlayışlı eşleşme.", color: "#d946ef" },
  { id: "game", emoji: "⌘", title: "Oyun modu", desc: "Mini oyun, soru ve eğlence.", color: "#22c55e" },
  { id: "busy", emoji: "◎", title: "Kafam dolu", desc: "Rahatlatan yavaş tempo sohbet.", color: "#f59e0b" },
  { id: "sad", emoji: "◌", title: "Üzgünüm", desc: "Nazik ve destekleyici konuşma.", color: "#60a5fa" },
  { id: "happy", emoji: "✺", title: "Mutluyum", desc: "Enerjini paylaşabileceğin biri.", color: "#f472b6" },
  { id: "random", emoji: "✧", title: "Rastgele", desc: "Sürpriz bir eşleşme başlat.", color: "#a78bfa" }
];

const PLANS: Plan[] = [
  { name: "Free", price: "₺0", tag: "Başlangıç", features: ["Ücretsiz başlangıç planı", "Günlük sınırlı sohbet", "Mood seçimi", "Anonim eşleşme"] },
  { name: "Premium", price: "₺49", tag: "En popüler", highlight: true, features: ["1 aylık Premium erişim", "Sınırsız sohbet", "Öncelikli eşleşme", "Premium tema", "Yazıyor efekti"] },
  { name: "Ultra", price: "₺99", tag: "VIP", features: ["1 aylık Ultra erişim", "Özel mood odaları", "Favori kişiler", "Gelişmiş filtreler", "Ultra rozet"] }
];

const TESTIMONIALS = [
  {
    name: "Mert",
    text: "Gerçekten uygulama gibi hissettiriyor. Gece modu aşırı iyi.",
    tag: "Premium member"
  },
  {
    name: "Selin",
    text: "Mood sistemi şaşırtıcı derecede doğal çalışıyor.",
    tag: "Early access"
  },
  {
    name: "Ege",
    text: "Bir premium sosyal ürün ile mobil app birleşmiş gibi.",
    tag: "Creator"
  }
];

const FAQS = [
  {
    q: "Lyvora anonim mi?",
    a: "Evet. Sohbetler mood bazlı ve anonim başlar."
  },
  {
    q: "Premium ne sağlıyor?",
    a: "Daha gelişmiş eşleşme, sınırsız sohbet ve premium tema."
  },
  {
    q: "Gerçek zamanlı mı çalışıyor?",
    a: "Canlı presence ve premium realtime hissi destekleniyor."
  }
];

const FINAL_POLISH_NOTES = [
  "Premium mood engine active",
  "Realtime presence synced",
  "Cinematic UI polish enabled"
];

const AVATARS = ["◈", "✦", "✧", "☾", "◎", "⌘", "✺", "◇"];

const REPORT_REASONS = [
  "Spam",
  "Taciz",
  "Fake profil",
  "Uygunsuz içerik",
  "Rahatsız edici davranış"
];

const REGION_PRESETS = [
  { country: "Türkiye", city: "İstanbul", language: "tr", timezone: "Europe/Istanbul" },
  { country: "Türkiye", city: "Ankara", language: "tr", timezone: "Europe/Istanbul" },
  { country: "Türkiye", city: "İzmir", language: "tr", timezone: "Europe/Istanbul" },
  { country: "Germany", city: "Berlin", language: "de", timezone: "Europe/Berlin" },
  { country: "France", city: "Paris", language: "fr", timezone: "Europe/Paris" },
  { country: "United Kingdom", city: "London", language: "en", timezone: "Europe/London" },
  { country: "United States", city: "New York", language: "en", timezone: "America/New_York" },
  { country: "Global", city: "Worldwide", language: "en", timezone: "UTC" }
];

function detectRegionProfile(): RegionProfile {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const language = (typeof navigator !== "undefined" ? navigator.language : "en").split("-")[0] || "en";

  const matchedPreset =
    REGION_PRESETS.find((item) => item.timezone === timezone && item.language === language) ||
    REGION_PRESETS.find((item) => item.timezone === timezone) ||
    REGION_PRESETS.find((item) => item.language === language) ||
    REGION_PRESETS[REGION_PRESETS.length - 1];

  return {
    country: matchedPreset.country,
    city: matchedPreset.city,
    language,
    timezone,
    mode: matchedPreset.country === "Global" ? "global" : "local"
  };
}

function regionMatchLabel(region: RegionProfile) {
  if (region.mode === "global") return "Global eşleşme";
  if (region.mode === "country") return `${region.country} geneli`;
  return `${region.city} yakın çevre`;
}

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 18;
const MESSAGE_MAX_LENGTH = 600;

const SPLASH_TRANSLATIONS: Record<string, {
  headline: string;
  subline: string;
  loading: string;
  wait: string;
  badges: string[];
}> = {
  tr: {
    headline: "Lyvora ile anonim bir hayata hoş geldiniz",
    subline: "Kendin ol. Özgürce sohbet et. Gerçek kimliğini gizli tut. Burada yargı yok, sadece sen varsın.",
    loading: "Yükleniyor...",
    wait: "Lütfen bekleyin",
    badges: ["Gizli", "Güvenli", "Sınırsız", "Gerçek"]
  },
  en: {
    headline: "Welcome to an anonymous life with Lyvora",
    subline: "Be yourself. Chat freely. Keep your real identity private. No judgment here, just you.",
    loading: "Loading...",
    wait: "Please wait",
    badges: ["Private", "Safe", "Unlimited", "Real"]
  },
  de: {
    headline: "Willkommen in einem anonymen Leben mit Lyvora",
    subline: "Sei du selbst. Chatte frei. Halte deine echte Identität privat. Keine Bewertung, nur du.",
    loading: "Wird geladen...",
    wait: "Bitte warten",
    badges: ["Privat", "Sicher", "Unbegrenzt", "Echt"]
  },
  fr: {
    headline: "Bienvenue dans une vie anonyme avec Lyvora",
    subline: "Sois toi-même. Discute librement. Garde ta vraie identité privée. Ici, pas de jugement.",
    loading: "Chargement...",
    wait: "Veuillez patienter",
    badges: ["Privé", "Sécurisé", "Illimité", "Réel"]
  },
  es: {
    headline: "Bienvenido a una vida anónima con Lyvora",
    subline: "Sé tú mismo. Chatea libremente. Mantén tu identidad real privada. Aquí no hay juicio.",
    loading: "Cargando...",
    wait: "Por favor espera",
    badges: ["Privado", "Seguro", "Ilimitado", "Real"]
  },
  ar: {
    headline: "مرحباً بك في حياة مجهولة مع Lyvora",
    subline: "كن على طبيعتك. تحدث بحرية. حافظ على هويتك الحقيقية خاصة. هنا لا يوجد حكم عليك.",
    loading: "جارٍ التحميل...",
    wait: "يرجى الانتظار",
    badges: ["خاص", "آمن", "غير محدود", "حقيقي"]
  },
  ru: {
    headline: "Добро пожаловать в анонимную жизнь с Lyvora",
    subline: "Будь собой. Общайся свободно. Сохраняй настоящую личность в тайне. Здесь нет осуждения.",
    loading: "Загрузка...",
    wait: "Пожалуйста, подождите",
    badges: ["Приватно", "Безопасно", "Безлимитно", "Настояще"]
  }
};

function getSplashLocale() {
  const language = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  const code = language.split("-")[0];
  return SPLASH_TRANSLATIONS[code] || SPLASH_TRANSLATIONS.en;
}

function readSavedState<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveState<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage kullanılamazsa uygulama normal çalışmaya devam eder.
  }
}

const ACTIVITY_FEED: ActivityItem[] = [
  { icon: "💜", title: "Yeni eşleşme", text: "Gece modu odasında biri seninle uyumlu.", time: "şimdi" },
  { icon: "🔥", title: "Profil ziyareti", text: "Bir kullanıcı premium profilini görüntüledi.", time: "2 dk" },
  { icon: "✨", title: "Mood sync", text: "Enerjin 3 kişiyle yüksek uyumda.", time: "5 dk" },
  { icon: "🎧", title: "Session active", text: "Night energy mix sohbet temposuna geçti.", time: "8 dk" }
];

const DISCOVER_CARDS: DiscoverCard[] = [
  { emoji: "☾", title: "Gece Sohbetçisi", tag: "Sakin tempo", match: 96 },
  { emoji: "⌘", title: "Oyun Modu", tag: "Eğlenceli akış", match: 89 },
  { emoji: "◈", title: "Derin Bağ", tag: "Samimi konuşma", match: 93 }
];

const MATCH_METRICS: MatchMetric[] = [
  { label: "Mood uyumu", value: 94, icon: "💜" },
  { label: "Sohbet temposu", value: 88, icon: "💬" },
  { label: "Enerji yakınlığı", value: 91, icon: "✨" }
];

const REPLIES: Record<string, string[]> = {
  sad: ["Buradayım. Yavaş yavaş anlatabilirsin. 💜", "Seni yargılamadan dinliyorum.", "Bugün ağır geldiyse sorun değil. Bir cümleyle başlayalım."],
  game: ["Oyun modu açıldı 🎮 İlk soru: 3 kelimeyle bugünün nasıl geçti?", "Mini oyun: Ben bir kelime yazacağım, sen aklına geleni yaz. Kelime: gece ✨", "Hızlı seçim: müzik mi film mi?"],
  happy: ["Bu enerji güzel geldi 😁 Bugünün en iyi anı neydi?", "Harika! Bunu kutlayalım. Bana iyi gelen şeyi anlat.", "Mutlu mod bulaşıcıdır, devam et ✨"],
  default: ["Anladım. Bazen böyle konuşmak gerçekten iyi geliyor.", "Güzel söyledin. Biraz daha açmak ister misin?", "Buradayım. Konu nereye giderse gitsin dinlerim."]
};

const AI_OPENERS: Record<string, string[]> = {
  night: [
    "Gece enerjin nasıl?",
    "Bugün seni en çok ne düşündürdü?",
    "Şu an dinlediğin bir şarkı olsaydı ne olurdu?"
  ],
  bond: [
    "Gerçekten konuşmak istediğin bir şey var mı?",
    "Sence iyi bir bağ nasıl başlar?",
    "Bugün kalbinde kalan şey neydi?"
  ],
  game: [
    "Hızlı oyun: müzik mi film mi?",
    "3 kelimeyle bugünün nasıl geçti?",
    "Bir kelime seç: gece, ateş, rüya."
  ],
  default: [
    "Bugün enerjin nasıl?",
    "Şu an ne konuşmak iyi gelir?",
    "Bana küçük bir ipucu ver, sohbeti ben başlatayım."
  ]
};

function getAiOpeners(mood?: Mood | null) {
  if (!mood) return AI_OPENERS.default;
  return AI_OPENERS[mood.id] || AI_OPENERS.default;
}

const RADIO_TRACKS = [
  { title: "Night energy mix", vibe: "Dark ambient", src: "/music/night-energy.mp3", mood: "🌙" },
  { title: "Chill wave", vibe: "Soft lofi", src: "/music/chill-wave.mp3", mood: "💜" },
  { title: "Focus dream", vibe: "Deep focus", src: "/music/focus-dream.mp3", mood: "🧠" },
  { title: "Soft piano", vibe: "Calm session", src: "/music/soft-piano.mp3", mood: "☁️" }
];

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => readSavedState<Screen>("lyvora_screen", "onboarding"));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<Tab>(() => readSavedState<Tab>("lyvora_active_tab", "home"));
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("◈");
  const [profilePhoto, setProfilePhoto] = useState<string>(() => readSavedState<string>("lyvora_profile_photo", ""));
  const [profileBio, setProfileBio] = useState<string>(() => readSavedState<string>("lyvora_profile_bio", "Anonim kal, gerçek bağ kur."));
  const [profileVibe, setProfileVibe] = useState<string>(() => readSavedState<string>("lyvora_profile_vibe", "Gece enerjisi"));
  const [profileCity, setProfileCity] = useState<string>(() => readSavedState<string>("lyvora_profile_city", "İstanbul"));
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(() => readSavedState<Mood | null>("lyvora_selected_mood", null));
  const [activeRoomId, setActiveRoomId] = useState("demo-room");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("Yeni eşleşmeler hazır 💜");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => readSavedState<"dark" | "light">("lyvora_theme", "dark"));
  const [onboardingStep, setOnboardingStep] = useState(() => readSavedState<number>("lyvora_onboarding_step", 0));
  const [matchingStep, setMatchingStep] = useState(0);
  const [matchPulse, setMatchPulse] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const featuresRef = useRef<HTMLElement | null>(null);
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const onlineCount = useMemo(() => Math.floor(Math.random() * 900 + 1300), []);
  const [liveOnlineCount, setLiveOnlineCount] = useState(onlineCount);
  const [deliveryState, setDeliveryState] = useState<"Gönderildi" | "İletildi" | "Görüldü">("Gönderildi");
  const [profileLevel] = useState(7);
  const [profileXP] = useState(78);
  const [dynamicToast, setDynamicToast] = useState("✨ Yeni premium eşleşme bulundu");
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [profileVisitors, setProfileVisitors] = useState(24);
  const [regionProfile, setRegionProfile] = useState<RegionProfile>(() => detectRegionProfile());
  const [regionalMatchScore, setRegionalMatchScore] = useState(96);
  const [activityPulse, setActivityPulse] = useState(0);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [savedAuras, setSavedAuras] = useState<SavedAura[]>(() => readSavedState<SavedAura[]>("lyvora_saved_auras", []));
  const [closeCircleOpen, setCloseCircleOpen] = useState(false);
  const [globalRoomOpen, setGlobalRoomOpen] = useState(false);
  const [globalMessage, setGlobalMessage] = useState("");
  const [globalMessages, setGlobalMessages] = useState<GlobalRoomMessage[]>([
    { id: 1, user: "NightAura", text: "anyone awake rn?", country: "🇺🇸", time: "02:14" },
    { id: 2, user: "Luna", text: "istanbul vibes tonight ✨", country: "🇹🇷", time: "02:16" },
    { id: 3, user: "Void", text: "music recommendations?", country: "🇩🇪", time: "02:17" }
  ]);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [vibeStories, setVibeStories] = useState<VibeStory[]>(() => readSavedState<VibeStory[]>("lyvora_vibe_stories", []));
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([
    {
      id: 1,
      title: "Lyvora hazır",
      text: "Yeni eşleşmeler ve mesaj bildirimleri burada görünecek.",
      time: "Şimdi",
      read: false,
      icon: "✦"
    }
  ]);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [authGuardNotice, setAuthGuardNotice] = useState("");
  const [blockedRooms, setBlockedRooms] = useState<string[]>(() => readSavedState<string[]>("lyvora_blocked_rooms", []));
  const [reportReason, setReportReason] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState("Spam");
  const [supportText, setSupportText] = useState("");
  const [supportTyping, setSupportTyping] = useState(false);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([
    { id: 1, from: "support", text: "Merhaba, Lyvora destek burası. Sana nasıl yardımcı olabiliriz?", time: "Şimdi" }
  ]);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, from: "system", text: "✨ Mood seç ve anonim sohbet ekranına geç." }
  ]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [showAiOpeners, setShowAiOpeners] = useState(true);
  const [onlinePresenceMap, setOnlinePresenceMap] = useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(3);
  const [isPremium, setIsPremium] = useState(true);
  const [premiumGlow, setPremiumGlow] = useState(true);

const MEMBERSHIP_PLANS = {
  free: {
    dailyMessages: 50,
    voiceSeconds: 15,
    profileViews: 5,
    swipeBoost: false,
    invisibleMode: false,
    hdPhoto: false,
    aiOpeners: 3
  },
  premium: {
    dailyMessages: 9999,
    voiceSeconds: 120,
    profileViews: 999,
    swipeBoost: true,
    invisibleMode: true,
    hdPhoto: true,
    aiOpeners: 999
  }
};

const currentPlan = isPremium ? MEMBERSHIP_PLANS.premium : MEMBERSHIP_PLANS.free;

  const [lastSeenLabel, setLastSeenLabel] = useState("şimdi aktif");
  const [presenceSynced, setPresenceSynced] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(() => readSavedState<number>("lyvora_last_read_at", Date.now()));

  function pushAppNotification(title: string, text: string, icon = "✦") {
    const nextNotification: AppNotification = {
      id: Date.now(),
      title,
      text,
      time: "Şimdi",
      read: false,
      icon
    };

    setAppNotifications((prev) => [nextNotification, ...prev].slice(0, 12));

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: text,
          icon: "/logo.svg"
        });
      } catch {}
    }
  }

  async function requestNotificationAccess() {
    if (typeof Notification === "undefined") {
      setToast("Bu tarayıcı bildirimleri desteklemiyor.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setToast("live signals açıldı ✦");
      pushAppNotification("live signals aktif", "Yeni match ve mesajları kaçırmayacaksın.", "🔔");
    } else {
      setToast("Bildirim izni verilmedi.");
    }
  }

  function markNotificationsRead() {
    setAppNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  function scrollToSection(target: "features" | "pricing") {
    const section = target === "features" ? featuresRef.current : pricingRef.current;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    audioRef.current?.pause();

    const audio = new Audio(RADIO_TRACKS[currentTrackIndex].src);
    audio.loop = false;
    audio.volume = 0.45;
    audio.onended = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % RADIO_TRACKS.length);
      setMusicPlaying(true);
    };

    audioRef.current = audio;

    if (musicPlaying) {
      audio.play().catch(() => setMusicPlaying(false));
    }

    return () => {
      audio.pause();
    };
  }, [currentTrackIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootLoading(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    saveState("lyvora_screen", screen);
  }, [screen]);

  useEffect(() => {
    if (screen === "chat") {
      setUnreadCount(0);
      const now = Date.now();
      setLastReadAt(now);
      saveState("lyvora_last_read_at", now);
    }
  }, [screen]);

  useEffect(() => {
    saveState("lyvora_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadCount(0);
      const now = Date.now();
      setLastReadAt(now);
      saveState("lyvora_last_read_at", now);
    }
  }, [activeTab]);

  useEffect(() => {
    saveState("lyvora_theme", theme);
  }, [theme]);

  useEffect(() => {
    saveState("lyvora_onboarding_step", onboardingStep);
  }, [onboardingStep]);

  useEffect(() => {
    saveState("lyvora_selected_mood", selectedMood);
  }, [selectedMood]);

  useEffect(() => {
    saveState("lyvora_profile_photo", profilePhoto);
  }, [profilePhoto]);

  useEffect(() => {
    saveState("lyvora_profile_bio", profileBio);
  }, [profileBio]);

  useEffect(() => {
    saveState("lyvora_profile_vibe", profileVibe);
  }, [profileVibe]);

  useEffect(() => {
    saveState("lyvora_profile_city", profileCity);
  }, [profileCity]);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsInstalledApp(Boolean(standalone));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalledApp(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installLyvoraApp() {
    if (!installPrompt) {
      setToast("📱 Tarayıcı menüsünden Ana ekrana ekle seçeneğini kullanabilirsin.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setToast("✅ Lyvora ana ekrana ekleniyor.");
      setIsInstalledApp(true);
    } else {
      setToast("📱 Kurulum iptal edildi.");
    }

    setInstallPrompt(null);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        upsertUserProfile(currentUser);
        if (screen === "auth" || screen === "landing") setScreen("home");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userPresenceRef = doc(db, "users", user.uid);

    const markOnline = async () => {
      try {
        await setDoc(
          userPresenceRef,
          {
            online: true,
            presence: "online",
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        setPresenceSynced(true);
      } catch (error) {
        console.warn("Presence online sync skipped:", error);
      }
    };

    const markOffline = async () => {
      try {
        await setDoc(
          userPresenceRef,
          {
            online: false,
            presence: "offline",
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } catch (error) {
        console.warn("Presence offline sync skipped:", error);
      }
    };

    markOnline();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") markOnline();
      else markOffline();
    };

    const handleBeforeUnload = () => {
      markOffline();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const presenceHeartbeat = window.setInterval(markOnline, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.clearInterval(presenceHeartbeat);
      markOffline();
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const presenceTicker = window.setInterval(() => {
      const active = Math.random() > 0.22;
      setOnlinePresenceMap((prev) => ({
        ...prev,
        bot: active
      }));
      setLastSeenLabel(active ? "şimdi aktif" : `${Math.floor(Math.random() * 8) + 1} dk önce`);
    }, 6000);

    return () => window.clearInterval(presenceTicker);
  }, []);

  useEffect(() => {
    if (!isRecordingVoice) return;

    const voiceRecordTicker = window.setInterval(() => {
      setVoiceDuration((prev) => Math.min(59, prev + 1));
    }, 1000);

    return () => window.clearInterval(voiceRecordTicker);
  }, [isRecordingVoice]);

  useEffect(() => {
    if (!activeRoomId || !user) return;

    const messagesQuery = query(
      collection(db, "rooms", activeRoomId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const liveMessages = snapshot.docs.map((messageDoc) => {
          const data = messageDoc.data();
          return {
            id: messageDoc.id,
            from: data.from || "bot",
            text: data.text || "",
            uid: data.uid || "",
            type: data.type || "text",
            voiceUrl: data.voiceUrl || "",
            imageUrl: data.imageUrl || "",
            duration: data.duration || "",
            time: data.createdAt ? "Şimdi" : ""
          } as Message;
        });

        if (liveMessages.length > 0) {
          setMessages((prev) => {
            const merged: Message[] = [...prev];

            liveMessages.forEach((liveMessage) => {
              const alreadyExists = merged.some((item) => {
                const sameId = String(item.id) === String(liveMessage.id);
                const sameContent =
                  item.from === liveMessage.from &&
                  item.text === liveMessage.text &&
                  item.uid === liveMessage.uid;

                return sameId || sameContent;
              });

              if (!alreadyExists) {
                merged.push(liveMessage);
              }
            });

            return merged;
          });
        }
      },
      (error) => {
        console.warn("Live chat listener skipped:", error);
      }
    );

    return () => unsubscribe();
  }, [activeRoomId, user]); // lv-firestore-chat-listener

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setLiveOnlineCount((prev) => Math.max(900, prev + Math.floor(Math.random() * 17) - 8));
    }, 2200);
    return () => window.clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (screen !== "match") return;

    const matchPulseTicker = window.setInterval(() => {
      setMatchPulse((prev) => (prev + 1) % 4);
    }, 520);

    return () => window.clearInterval(matchPulseTicker);
  }, [screen]); // lv-live-online-ticker

  useEffect(() => {
    const notifications = [
      "💜 Yeni mood eşleşmesi hazır",
      "🔥 Birisi profilini görüntüledi",
      "✨ Gece modu odası aktifleşti",
      "🎧 Yeni sohbet enerjisi bulundu"
    ];

    const pushTicker = window.setInterval(() => {
      const nextNotification = notifications[Math.floor(Math.random() * notifications.length)];
      setDynamicToast(nextNotification);
      pushAppNotification("Canlı aktivite", nextNotification.replace(/^\S+\s/, ""), "✦");
      setActivityPulse((prev) => prev + 1);
      setProfileVisitors((prev) => prev + Math.floor(Math.random() * 3));
      if (nextNotification.includes("eşleşme")) {
        setShowMatchModal(true);
        window.setTimeout(() => setShowMatchModal(false), 3200);
      }
    }, 5200);

    return () => window.clearInterval(pushTicker);
  }, []); // lv-push-system

  function requireSignedIn(actionText = "Bu işlem için giriş yapmalısın.") {
    if (user) return true;

    setAuthGuardNotice(actionText);
    setNotice(actionText);
    setScreen("auth");
    return false;
  }

  function cleanUsername(value: string) {
    return value.trim().replace(/\s+/g, "_").slice(0, USERNAME_MAX_LENGTH);
  }

  async function upsertUserProfile(currentUser: User, extra?: { username?: string; avatar?: string }) {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);

      const payload = {
        uid: currentUser.uid,
        email: currentUser.email || "",
        displayName: cleanUsername(extra?.username || currentUser.displayName || currentUser.email?.split("@")[0] || "Lyvora kullanıcısı"),
        avatar: extra?.avatar || avatar,
        premium: false,
        level: 1,
        xp: 0,
        regionCountry: regionProfile.country,
        regionCity: regionProfile.city,
        regionLanguage: regionProfile.language,
        regionTimezone: regionProfile.timezone,
        regionMode: regionProfile.mode,
        profileBio,
        profileVibe,
        profileCity,
        profilePhoto,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (!snap.exists()) {
        await setDoc(userRef, {
          ...payload,
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, payload);
      }
    } catch (error) {
      console.warn("Profile sync skipped:", error);
    }
  }

  async function createMoodRoom(mood: Mood) {
    const roomId = `${mood.id}-${Date.now()}`;
    setActiveRoomId(roomId);

    try {
      await setDoc(doc(db, "rooms", roomId), {
        roomId,
        moodId: mood.id,
        moodTitle: mood.title,
        moodEmoji: mood.emoji,
        status: "active",
        participants: user ? [user.uid] : [],
        regionCountry: regionProfile.country,
        regionCity: regionProfile.city,
        regionLanguage: regionProfile.language,
        regionTimezone: regionProfile.timezone,
        regionMode: regionProfile.mode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, "rooms", roomId, "messages"), {
        from: "system",
        text: `${mood.emoji} ${mood.title} modu açıldı. Gerçek Firestore odası oluşturuldu.`,
        uid: user?.uid || "system",
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Room sync skipped:", error);
    }

    return roomId;
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) return setNotice("E-posta ve şifre gerekli.");
    if (authMode === "register" && !username.trim()) return setNotice("Kayıt için kullanıcı adı gerekli.");
    if (authMode === "register" && cleanUsername(username).length < USERNAME_MIN_LENGTH) return setNotice("Kullanıcı adı en az 3 karakter olmalı.");
    if (password.length < 6) return setNotice("Şifre en az 6 karakter olmalı.");
    try {
      setLoading(true);
      setNotice("");
      if (authMode === "register") {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(result.user, { displayName: cleanUsername(username) });
        await upsertUserProfile(result.user, { username: cleanUsername(username), avatar });
        setUser(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        await upsertUserProfile(result.user);
        setUser(result.user);
      }
      setScreen("home");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") setNotice("Bu e-posta zaten kayıtlı.");
      else if (err.code === "auth/weak-password") setNotice("Şifre en az 6 karakter olmalı.");
      else if (err.code === "auth/invalid-email") setNotice("E-posta formatı hatalı.");
      else if (err.code === "auth/invalid-credential") setNotice("E-posta veya şifre hatalı.");
      else setNotice("Bir hata oluştu. Tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  function toggleRadio() {
    if (!audioRef.current) return;

    if (musicPlaying) {
      audioRef.current.pause();
      setMusicPlaying(false);
    } else {
      audioRef.current.play().then(() => setMusicPlaying(true)).catch(() => setNotice("Müzik dosyası bulunamadı. public/music klasörünü kontrol et."));
    }
  }

  function nextTrack() {
    setCurrentTrackIndex((prev) => (prev + 1) % RADIO_TRACKS.length);
    setMusicPlaying(true);
  }

  function previousTrack() {
    setCurrentTrackIndex((prev) => (prev - 1 + RADIO_TRACKS.length) % RADIO_TRACKS.length);
    setMusicPlaying(true);
  }

  function sendSupportMessage(text?: string) {
    const value = (text || supportText).trim();
    if (!value || supportTyping) return;

    setSupportMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: value, time: "Şimdi" }
    ]);

    setSupportText("");
    setSupportTyping(true);

    window.setTimeout(() => {
      setSupportTyping(false);
      setSupportMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "support",
          text: pickSupportReply(value),
          time: "Şimdi"
        }
      ]);
    }, 900);
  }

  function pickSupportReply(value: string) {
    const lower = value.toLowerCase();

    if (lower.includes("premium") || lower.includes("ödeme") || lower.includes("abonelik")) {
      return "Premium ve ödeme işlemleri yakında güvenli checkout sistemiyle aktif olacak. Şimdilik planları inceleyebilirsin.";
    }

    if (lower.includes("hesap") || lower.includes("giriş") || lower.includes("şifre")) {
      return "Hesap işlemleri için e-posta ve şifre bilgilerini kontrol et. Sorun devam ederse destek@lyvora.app üzerinden bize ulaşabilirsin.";
    }

    if (lower.includes("gizlilik") || lower.includes("kvkk") || lower.includes("veri")) {
      return "Gizlilik ve veri işleme detaylarını sayfanın altındaki Gizlilik Politikası bölümünden inceleyebilirsin.";
    }

    return "Mesajını aldık. Lyvora ekibi en kısa sürede destek akışını daha da geliştirecek. Şimdilik buradan hızlı yardım alabilirsin.";
  }

  async function reportActiveChat() {
    if (!requireSignedIn("Rapor göndermek için giriş yapmalısın.")) return;

    const reason = reportReason.trim() || selectedReportReason;
    if (reason.length < 3) {
      setToast("🚨 Rapor sebebi en az 3 karakter olmalı.");
      return;
    }

    try {
      await addDoc(collection(db, "reports"), {
        reporterId: user?.uid || "",
        roomId: activeRoomId,
        moodId: selectedMood?.id || "",
        moodTitle: selectedMood?.title || "",
        reason,
        selectedReason: selectedReportReason,
        status: "open",
        createdAt: serverTimestamp()
      });

      setToast("🚨 Rapor gönderildi. Teşekkürler.");
      setShowReportModal(false);
      setReportReason("");
    } catch (error) {
      console.warn("Report save skipped:", error);
      setToast("🚨 Rapor alındı. Bağlantı düzelince tekrar deneyebilirsin.");
      setShowReportModal(false);
      setReportReason("");
    }
  }

  function blockActiveChat() {
    setBlockedRooms((prev) => {
      const next = prev.includes(activeRoomId) ? prev : [...prev, activeRoomId];
      saveState("lyvora_blocked_rooms", next);
      return next;
    });

    setToast("⛔ Bu sohbet engellendi.");
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "system", text: "⛔ Bu eşleşme engellendi. Yeni bir mood seçerek devam edebilirsin.", time: "Şimdi" }
    ]);
    setScreen("home");
  }

  function handleProfilePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast("Profil fotoğrafı için görsel seçmelisin.");
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setToast("Fotoğraf 2.5MB altında olmalı.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(String(reader.result || ""));
      setToast("Profil fotoğrafı güncellendi ✦");
    };
    reader.readAsDataURL(file);
  }

  function removeProfilePhoto() {
    setProfilePhoto("");
    setToast("Profil fotoğrafı kaldırıldı.");
  }

  async function handleStoryUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast("Story için görsel seçmelisin.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast("Story görseli 5MB altında olmalı.");
      return;
    }

    try {
      setToast("Story yükleniyor...");

      let imageUrl = URL.createObjectURL(file);

      if (user && storage) {
        const path = `vibe-stories/${user.uid}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const fileRef = storageRef(storage, path);

        await uploadBytes(fileRef, file);
        imageUrl = await getDownloadURL(fileRef);
      }

      const nextStory: VibeStory = {
        id: Date.now(),
        imageUrl,
        caption: profileVibe || "Yeni vibe",
        time: "Şimdi"
      };

      setVibeStories((prev) => [nextStory, ...prev].slice(0, 8));
      pushAppNotification("Story paylaşıldı", "Vibe story profilinde görünüyor.", "✨");
      setToast("Story paylaşıldı ✨");
    } catch (error) {
      console.warn("Story upload skipped:", error);
      setToast("Story yüklenemedi.");
    } finally {
      event.target.value = "";
    }
  }

  function deleteStory(storyId: number) {
    setVibeStories((prev) => prev.filter((item) => item.id !== storyId));
    setToast("Story kaldırıldı.");
  }

async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast("Sadece görsel yükleyebilirsin.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast("Fotoğraf 5MB altında olmalı.");
      return;
    }

    if (!user) {
      setToast("Fotoğraf göndermek için giriş yapmalısın.");
      return;
    }

    try {
      setToast("Fotoğraf yükleniyor...");

      const path = `chat-images/${user.uid}/${activeRoomId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const fileRef = storageRef(storage, path);

      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);

      const imageMessage: Message = {
        id: Date.now(),
        from: "me",
        text: "Fotoğraf",
        type: "image",
        imageUrl,
        time: "Şimdi",
        uid: user.uid
      };

      setMessages((prev) => [...prev, imageMessage]);

      await addDoc(collection(db, "rooms", activeRoomId, "messages"), {
        from: "me",
        text: "Fotoğraf",
        uid: user.uid,
        type: "image",
        imageUrl,
        storagePath: path,
        createdAt: serverTimestamp()
      });

      pushAppNotification("Fotoğraf gönderildi", "Medyan güvenli şekilde yüklendi.", "📸");
      setDeliveryState("Gönderildi");
      window.setTimeout(() => setDeliveryState("İletildi"), 420);
      window.setTimeout(() => setDeliveryState("Görüldü"), 1150);

      setIsTyping(true);

      window.setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            from: "bot",
            text: "your vibe looks clean ✨",
            time: "Şimdi"
          }
        ]);
      }, 1200);
    } catch (error) {
      console.warn("Image upload failed:", error);
      setToast("Fotoğraf yüklenemedi. Storage ayarlarını kontrol et.");
    } finally {
      event.target.value = "";
    }
  }

async function logout() {
    await signOut(auth);
    setUser(null);
    setEmail("");
    setPassword("");
    setSelectedMood(null);
    try {
      window.localStorage.removeItem("lyvora_screen");
      window.localStorage.removeItem("lyvora_active_tab");
      window.localStorage.removeItem("lyvora_selected_mood");
    } catch {}
    setScreen("landing");
  }

  function saveCurrentAura() {
    const mood = selectedMood || MOODS[0];
    const nextAura: SavedAura = {
      id: Date.now(),
      name: `${mood.title} aura`,
      mood: mood.title,
      match: regionalMatchScore || 94,
      lastSeen: "şimdi aktif",
      avatar: mood.emoji
    };

    setSavedAuras((prev) => {
      const exists = prev.some((item) => item.mood === nextAura.mood);
      return exists ? prev : [nextAura, ...prev].slice(0, 12);
    });

    pushAppNotification("Aura kaydedildi", `${mood.title} favorilere eklendi.`, "◈");
    setToast("◈ Aura favorilere eklendi.");
  }

  function removeSavedAura(id: number) {
    setSavedAuras((prev) => prev.filter((item) => item.id !== id));
    setToast("Saved aura kaldırıldı.");
  }

  function reopenSavedAura(aura: SavedAura) {
    const mood = MOODS.find((item) => item.title === aura.mood) || selectedMood || MOODS[0];
    setCloseCircleOpen(false);
    startChat(mood);
  }

  
function sendGlobalMessage() {
    const trimmed = globalMessage.trim();
    if (!trimmed) return;

    const nextMessage: GlobalRoomMessage = {
      id: Date.now(),
      user: displayName || "anonymous",
      text: trimmed.slice(0, 180),
      country: "🌍",
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    setGlobalMessages((prev) => [...prev, nextMessage]);
    setGlobalMessage("");
    pushAppNotification("Global room", "Mesajın dünya odasına gönderildi.", "🌍");
  }

async function startChat(mood: Mood) {
    if (!requireSignedIn("Sohbet başlatmak için giriş yapmalısın.")) return;
    setSelectedMood(mood);
    const roomId = await createMoodRoom(mood);
    setActiveRoomId(roomId);
    setMatchingStep(0);
    setMatchPulse(0);
    setRegionalMatchScore(regionProfile.mode === "local" ? 97 : regionProfile.mode === "country" ? 92 : 84);
    setScreen("match");
    window.setTimeout(() => setMatchingStep(1), 700);
    window.setTimeout(() => setMatchingStep(2), 1400);
    window.setTimeout(() => {
      setIsTyping(true);
      setShowAiOpeners(true);
      setMessages([{ id: Date.now(), from: "system", text: `${mood.emoji} ${mood.title} modu açıldı. Anonim eşleşme bulundu.` }]);
      setScreen("chat");
      window.setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, { id: Date.now() + 1, from: "bot", text: "Selam, ben Deniz. Buradayım. Ne konuşalım?", time: "Şimdi" }]);
      }, 900);
    }, 2100);
  }

  function pickReply() {
    const key = selectedMood?.id && REPLIES[selectedMood.id] ? selectedMood.id : "default";
    const pool = REPLIES[key];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function formatVoiceDuration(seconds: number) {
    const safeSeconds = Math.max(1, Math.min(180, seconds || 1));
    const minutes = Math.floor(safeSeconds / 60);
    const rest = safeSeconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  async function startVoiceRecording() {
    if (!requireSignedIn("Sesli mesaj göndermek için giriş yapmalısın.")) return;
    if (blockedRooms.includes(activeRoomId)) return setToast("⛔ Bu sohbet engellendi.");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setToast("Bu tarayıcı ses kaydını desteklemiyor.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      setVoiceDuration(0);
      setIsRecordingVoice(true);
      setToast("🎙️ Ses kaydı başladı.");
    } catch (error) {
      console.warn("Voice permission skipped:", error);
      setToast("🎙️ Mikrofon izni gerekiyor.");
    }
  }

  async function finishVoiceRecording() {
    if (!isRecordingVoice) return;

    setIsRecordingVoice(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const duration = formatVoiceDuration(voiceDuration || 1);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve();
      };
      recorder.stop();
    });

    const voiceBlob = new Blob(voiceChunksRef.current, { type: "audio/webm" });

    if (!user) {
      setToast("Sesli mesaj göndermek için giriş yapmalısın.");
      setVoiceDuration(0);
      voiceChunksRef.current = [];
      return;
    }

    try {
      setToast("Ses yükleniyor...");

      const path = `voice-messages/${user.uid}/${activeRoomId}/${Date.now()}.webm`;
      const fileRef = storageRef(storage, path);

      await uploadBytes(fileRef, voiceBlob);
      const voiceUrl = await getDownloadURL(fileRef);

      const voiceMessage: Message = {
        id: Date.now(),
        from: "me",
        text: "Sesli mesaj",
        type: "voice",
        voiceUrl,
        duration,
        time: "Şimdi",
        uid: user.uid
      };

      setMessages((prev) => [...prev, voiceMessage]);

      await addDoc(collection(db, "rooms", activeRoomId, "messages"), {
        from: "me",
        text: "Sesli mesaj",
        uid: user.uid,
        type: "voice",
        voiceUrl,
        duration,
        storagePath: path,
        createdAt: serverTimestamp()
      });

      pushAppNotification("Sesli mesaj gönderildi", `${duration} uzunluğunda ses kaydı yüklendi.`, "🎙️");

      setDeliveryState("Gönderildi");
      window.setTimeout(() => setDeliveryState("İletildi"), 420);
      window.setTimeout(() => setDeliveryState("Görüldü"), 1150);
      setVoiceDuration(0);
      voiceChunksRef.current = [];
      setIsTyping(true);

      window.setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            from: "bot",
            text: "your aura sounds calm ✨",
            time: "Şimdi"
          }
        ]);
      }, 1100);
    } catch (error) {
      console.warn("Voice upload failed:", error);
      setToast("Ses yüklenemedi. Storage ayarlarını kontrol et.");
      setVoiceDuration(0);
      voiceChunksRef.current = [];
    }
  }

  function cancelVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorder.stop();
    }

    voiceChunksRef.current = [];
    setIsRecordingVoice(false);
    setVoiceDuration(0);
    setToast("🎙️ Ses kaydı iptal edildi.");
  }

  async function sendMessage(text?: string) {
    const value = (text || message).trim().slice(0, MESSAGE_MAX_LENGTH);
    if (!requireSignedIn("Mesaj göndermek için giriş yapmalısın.")) return;
    if (blockedRooms.includes(activeRoomId)) return setToast("⛔ Bu sohbet engellendi.");
    if (!value || isTyping) return;
    setMessages((prev) => [...prev, { id: Date.now(), from: "me", text: value, time: "Şimdi", uid: user?.uid }]);

    try {
      await addDoc(collection(db, "rooms", activeRoomId, "messages"), {
        from: "me",
        text: value,
        uid: user?.uid || "anonymous",
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Message save skipped:", error);
    }
    setDeliveryState("Gönderildi");
    window.setTimeout(() => setDeliveryState("İletildi"), 420);
    window.setTimeout(() => setDeliveryState("Görüldü"), 1150);
    setMessage("");
    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      const replyText = pickReply();
      setMessages((prev) => [...prev, { id: Date.now() + 1, from: "bot", text: replyText, time: "Şimdi" }]);
    }, 1000 + Math.floor(Math.random() * 600));
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Lyvora kullanıcısı";
  const currentTrack = RADIO_TRACKS[currentTrackIndex];
  const activeSlide = ONBOARDING[onboardingStep];
  const isLight = theme === "light";
  const pageStyle = isLight ? s.pageLight : s.page;
  const appPageStyle = isLight ? s.appPageLight : s.appPage;

  if (bootLoading) return <SplashScreen />;

  if (screen === "onboarding") {
    return (
      <main style={pageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
        <ThemeFX light={isLight} />
        <button style={s.themeToggle} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀️" : "🌙"}</button>
        <section style={s.onboardShell} className="lv-pop">
          <div style={s.onboardPhone} className="lv-float-soft">
            <div style={s.onboardTopLine}>
              <span style={s.liveTinyDot}></span>
              Lyvora live
            </div>
            <div style={s.onboardOrb}>{activeSlide.emoji}</div>
            <div style={s.onboardMiniCard}>
              <b>{activeSlide.tag}</b>
              <span>{activeSlide.text}</span>
            </div>
            <div style={s.onboardMessageOne}>Mood enerjin okunuyor...</div>
            <div style={s.onboardMessageTwo}>En uygun eşleşme hazırlanıyor ✨</div>
          </div>

          <div style={s.onboardCopy}>
            <span style={s.heroBadge}>{activeSlide.tag}</span>
            <h1 style={s.onboardTitle}>{activeSlide.title}</h1>
            <p style={s.onboardText}>{activeSlide.text}</p>
            <div style={s.onboardDots}>
              {ONBOARDING.map((_, i) => (
                <button key={i} style={i === onboardingStep ? s.onboardDotActive : s.onboardDot} onClick={() => setOnboardingStep(i)} />
              ))}
            </div>
            <div style={s.heroActions}>
              <button
                style={s.primaryButton}
                onClick={() => {
                  if (onboardingStep < ONBOARDING.length - 1) setOnboardingStep(onboardingStep + 1);
                  else setScreen("landing");
                }}
              >
                {onboardingStep < ONBOARDING.length - 1 ? "Devam Et" : "Başla"}
              </button>
              <button style={s.secondaryButton} onClick={() => setScreen("landing")}>Atla</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "landing") {
    return (
      <main style={pageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
        <ThemeFX light={isLight} />
        <nav style={s.websiteNav} className="lv-website-nav">
          <Brand sub="Mood based social app" />
          <div style={s.navActions} className="lv-nav-actions">
            <button style={s.themeMiniButton} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
            <button style={s.navGhost} onClick={() => scrollToSection("features")}>Özellikler</button>
            <button style={s.navGhost} onClick={() => scrollToSection("pricing")}>Fiyatlar</button>
            {!isInstalledApp && <button style={s.navGhost} onClick={installLyvoraApp}>📲 Uygulama Olarak Kur</button>}
            <button style={s.navButton} onClick={() => setScreen("auth")}>Giriş / Kayıt</button>
          </div>
        </nav>

        <section style={s.websiteHero} className="lv-website-hero">
          <div style={s.heroCopy} className="lv-rise lv-hero-copy">
            <div style={s.heroBadge}>💜 Anonim kal • Mood seç • Gerçek bağ kur</div>
            <h1 style={s.heroTitle} className="lv-hero-title">Hissettiğin yerden başla,<br /><span style={s.gradientText}>premium bağlar kur.</span></h1>
            <p style={s.heroText} className="lv-hero-text">Lyvora, iOS hissiyatlı arayüzü, akıcı mood eşleşmeleri ve akıcı sosyal deneyimi tek akışta birleştirir.</p>
            <div style={s.heroActions}>
              <button style={s.primaryButton} onClick={() => setScreen("auth")}>Başla</button>
              <button style={s.secondaryButton} onClick={() => setScreen("auth")}>Önizleme</button>
            </div>
            <div style={s.heroStats}>
              <div><b>1.3K+</b><span> aktif kişi</span></div>
              <div><b>8</b><span> mood odası</span></div>
              <div><b>4.9</b><span> premium his</span></div>
            </div>
          </div>

          <div style={s.heroDevice} className="lv-float-soft lv-hero-device">
            <div style={s.deviceTop}>
              <Brand sub="iOS experience" />
              <span style={s.devicePill}>Live</span>
            </div>
            <div style={s.deviceMood}>🌙 Gece modu</div>
            <div style={s.previewBubble}>Selam, buradayım. Ne konuşalım?</div>
            <TypingBubble />
            <div style={s.previewInput}>Mesaj yaz... <span>➤</span></div>
          </div>
        </section>

        <section ref={featuresRef} style={s.websiteGrid}>
          <Feature icon="🎨" title="Premium UI" text="Dengeli cam efektleri, yumuşak glow ve temiz spacing." />
          <Feature icon="📱" title="iOS hissi" text="Rounded kartlar, soft shadow ve akıcı mobil deneyim." />
          <Feature icon="💬" title="Canlı sohbet hissi" text="Yazıyor animasyonu, mesaj geçişleri ve mood akışı." />
        </section>

        
        <section style={s.websiteShowcase}>
          <div style={s.showcaseHeader}>
            <span style={s.goldBadge}>🚀 Product showcase</span>
            <h2 style={s.panelTitle}>Gerçek uygulama hissi veren deneyim.</h2>
            <p style={s.panelText}>Landing tarafı premium startup sitesi, içerisi ise canlı sosyal uygulama gibi tasarlandı.</p>
          </div>

          <div style={s.showcaseGrid}>
            <div style={s.showcasePhone} className="lv-liquid-card">
              <div style={s.showcaseTop}>Live preview</div>
              <div style={s.showcaseChatOne}>Bugün nasılsın?</div>
              <div style={s.showcaseChatTwo}>Mood enerjin yüksek görünüyor ✨</div>
              <div style={s.showcaseBottom}>typing...</div>
            </div>

            <div style={s.showcaseContent}>
              <div style={s.howGrid}>
                <div style={s.howCard}>
                  <b>1. Mood seç</b>
                  <span>Enerjine uygun sohbet akışı başlar.</span>
                </div>

                <div style={s.howCard}>
                  <b>2. Eşleş</b>
                  <span>Premium algoritma benzer enerjileri bulur.</span>
                </div>

                <div style={s.howCard}>
                  <b>3. Bağ kur</b>
                  <span>Gerçek app hissi veren canlı sohbet deneyimi.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={s.testimonialSection}>
          <div style={s.sectionHeader}>
            <b>Community feedback</b>
            <span>community</span>
          </div>

          <div style={s.testimonialGrid}>
            {TESTIMONIALS.map((item) => (
              <div key={item.name} style={s.testimonialCard} className="lv-premium-depth">
                <div style={s.testimonialAvatar}>{item.name[0]}</div>
                <p style={s.testimonialText}>“{item.text}”</p>
                <b>{item.name}</b>
                <small>{item.tag}</small>
              </div>
            ))}
          </div>
        </section>

        <section style={s.faqSection}>
          <div style={s.sectionHeader}>
            <b>FAQ</b>
            <span>everything about Lyvora</span>
          </div>

          <div style={s.faqList}>
            {FAQS.map((faq, i) => (
              <button
                key={faq.q}
                style={openFAQ === i ? s.faqItemActive : s.faqItem}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              >
                <div style={s.faqTop}>
                  <b>{faq.q}</b>
                  <span>{openFAQ === i ? "−" : "+"}</span>
                </div>

                {openFAQ === i && (
                  <p style={s.faqText}>{faq.a}</p>
                )}
              </button>
            ))}
          </div>
        </section>

        <section style={s.massiveCTA} className="lv-liquid-card">
          <span style={s.goldBadge}>✨ Ready experience</span>
          <h2 style={s.massiveTitle}>Gerçek bir startup gibi görün.</h2>
          <p style={s.massiveText}>Lyvora; modern SaaS landing page hissini premium sosyal uygulama deneyimiyle birleştirir.</p>

          <div style={s.heroActions}>
            <button style={s.primaryButton} onClick={() => setScreen("auth")}>Şimdi Başla</button>
            <button style={s.secondaryButton}>Önizleme</button>
          </div>
        </section>

        <div ref={pricingRef}>
          <PricingPanel />
        </div>

        <section style={s.siteCTA}>
          <div>
            <span style={s.goldBadge}>👑 Ready</span>
            <h2 style={s.panelTitle}>Site + app hissi aynı üründe.</h2>
            <p style={s.panelText}>Landing sayfası profesyonel, içerisi mobil uygulama gibi hissettirir.</p>
          </div>
          <div style={s.heroActions}>
            {!isInstalledApp && <button style={s.secondaryButton} onClick={installLyvoraApp}>📲 Telefona Kur</button>}
            <button style={s.primaryButton} onClick={() => setScreen("auth")}>Önizleme’yu dene</button>
          </div>
        </section>

        <footer className="lv-legal-footer">
          <button type="button" onClick={() => setScreen("privacy")}>Gizlilik Politikası</button>
          <button type="button" onClick={() => setScreen("terms")}>Kullanım Şartları</button>
          <button type="button" onClick={() => setScreen("contact")}>İletişim</button>
        </footer>

        {showReportModal && (
          <div style={s.profileEditOverlay}>
            <section style={s.profileEditModal} className="lv-pop">
              <div style={s.profileEditHeader}>
                <b>Kullanıcıyı rapor et</b>
                <button style={s.supportClose} onClick={() => setShowReportModal(false)}>×</button>
              </div>

              <p style={s.reportText}>Güvenli topluluk için sebebi seç veya kısa açıklama yaz.</p>

              <div style={s.profileEditQuick}>
                {REPORT_REASONS.map((item) => (
                  <button
                    key={item}
                    style={selectedReportReason === item ? s.regionChipActive : s.regionChip}
                    onClick={() => setSelectedReportReason(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <textarea
                style={s.profileEditTextarea}
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="İstersen kısa açıklama ekle..."
                maxLength={300}
              />

              <div style={s.reportActions}>
                <button style={s.chatGhostButton} onClick={() => setShowReportModal(false)}>Vazgeç</button>
                <button style={s.chatDangerButton} onClick={reportActiveChat}>Raporu Gönder</button>
              </div>
            </section>
          </div>
        )}

        <SupportWidget
          open={supportOpen}
          setOpen={setSupportOpen}
          messages={supportMessages}
          text={supportText}
          setText={setSupportText}
          typing={supportTyping}
          onSend={sendSupportMessage}
        />
      </main>
    );
  }

  if (screen === "privacy") {
    return (
      <LegalPage
        title="Gizlilik Politikası"
        badge="Privacy Center"
        text={[
          "Lyvora, hesabını oluşturmak ve uygulama deneyimini çalıştırmak için e-posta, kullanıcı adı, avatar, profil durumu ve sohbet kullanım verilerini Firebase altyapısında işler.",
          "Sohbet deneyimi mood bazlıdır. Mesajlar, hizmetin güvenli çalışması, kötüye kullanımı önleme ve kullanıcı deneyimini geliştirme amacıyla işlenebilir.",
          "Ödeme bilgileri Lyvora tarafından doğrudan saklanmaz. Premium satın alma sürecinde ödeme işlemleri yetkili ödeme sağlayıcısı üzerinden yürütülür.",
          "Kullanıcı, hesabıyla ilişkili veriler hakkında destek talebi oluşturabilir. İletişim için destek adresi: support@lyvora.app"
        ]}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "terms") {
    return (
      <LegalPage
        title="Kullanım Şartları"
        badge="Terms of Service"
        text={[
          "Lyvora’yı kullanarak platformda saygılı, güvenli ve yasalara uygun davranmayı kabul edersin.",
          "Taciz, spam, sahte hesap kullanımı, yasa dışı içerik paylaşımı, başkalarını rahatsız etme ve sistemi kötüye kullanma yasaktır.",
          "Lyvora, güvenliği korumak için gerekli gördüğü durumlarda hesapları sınırlandırma, askıya alma veya erişimi sonlandırma hakkını saklı tutar.",
          "Premium özellikler abonelik veya tek seferlik satın alma modeline göre sunulabilir. Satın alma koşulları ödeme ekranında ayrıca gösterilir."
        ]}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "contact") {
    return (
      <LegalPage
        title="İletişim"
        badge="Support"
        text={[
          "Lyvora hakkında destek, gizlilik, iş birliği veya geri bildirim konuları için bizimle iletişime geçebilirsin.",
          "Destek e-posta adresi: support@lyvora.app",
          "Yanıt süresi yoğunluğa göre değişebilir. Acil güvenlik veya hesap sorunlarında mesajına detay eklemen çözümü hızlandırır."
        ]}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "auth") {
    return (
      <main style={pageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
        <ThemeFX light={isLight} />
        <section style={s.authShell} className="lv-auth-shell">
          <div style={s.authSide} className="lv-auth-side">
            <div style={s.bigLogo}><LyvoraLogo size={72} /></div>
            <h1 style={s.authTitle} className="lv-auth-title">Lyvora’ya hoş geldin</h1>
            <p style={s.authText} className="lv-auth-text">Modern, güvenli ve mood tabanlı anonim sohbet deneyimine giriş yap.</p>
            <div style={s.authMiniGrid}>
              <span>✨ Premium tema</span>
              <span>💬 Canlı his</span>
              <span>🛡️ Anonim akış</span>
            </div>
          </div>

          <div style={s.authCard} className="lv-pop lv-auth-card">
            {authGuardNotice && <div style={s.authGuardBox}>🔐 {authGuardNotice}</div>}
            <div style={s.authSwitch}>
              <button style={authMode === "login" ? s.authSwitchActive : s.authSwitchButton} onClick={() => setAuthMode("login")}>Giriş Yap</button>
              <button style={authMode === "register" ? s.authSwitchActive : s.authSwitchButton} onClick={() => setAuthMode("register")}>Kayıt Ol</button>
            </div>

            {authMode === "register" && (
              <>
                <label style={s.label}>Kullanıcı adı</label>
                <input style={s.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Örn: gececi_mert" />
                <label style={s.label}>Avatar seç</label>
                <div style={s.avatarGrid}>{AVATARS.map((item) => <button key={item} style={item === avatar ? s.avatarActive : s.avatarButton} onClick={() => setAvatar(item)}>{item}</button>)}</div>
              </>
            )}

            <label style={s.label}>E-posta</label>
            <input style={s.input} value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" />
            <label style={s.label}>Şifre</label>
            <input style={s.input} value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
            {notice && <div style={s.notice}>{notice}</div>}
            <button style={s.primaryFull} onClick={handleAuth} disabled={loading}>{loading ? "Bekle..." : authMode === "login" ? "Giriş Yap" : "Hesap Oluştur"}</button>
            <button style={s.ghostButton} onClick={() => setScreen("landing")}>← Siteye dön</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "match") {
    const stepTexts = ["Mood enerjin okunuyor", "Uygun kişiler aranıyor", "En yakın eşleşme hazırlanıyor"];
    return (
      <main style={appPageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
        <ThemeFX light={isLight} />
        <section style={s.matchScreen} className="lv-pop">
          <div style={s.matchOrbWrap}><span style={{ ...s.matchPulseRing, transform: `scale(${1 + matchPulse * 0.08})`, opacity: 0.32 - matchPulse * 0.05 }}></span><div style={s.matchOrb}>{selectedMood?.emoji || "◈"}</div></div>
          <h1 style={s.matchTitle}>energy syncing</h1>
          <p style={s.matchText}>{stepTexts[matchingStep] || stepTexts[0]}...</p>
          <div style={s.matchPercent}>{matchingStep === 0 ? "34" : matchingStep === 1 ? "68" : regionalMatchScore}%</div>
          <p style={s.matchRegionText}>{regionMatchLabel(regionProfile)} • {regionProfile.timezone}</p>
          <div style={s.matchRings}>
            <div style={s.matchUser}>🌙</div>
            <div style={s.matchLine}></div>
            <div style={s.matchUser}>{selectedMood?.emoji || "✨"}</div>
          </div>
          <div style={s.matchAlgorithmCard}>
            {MATCH_METRICS.map((metric, index) => (
              <div key={metric.label} style={s.matchMetricRow}>
                <span>{metric.icon} {metric.label}</span>
                <b>{matchingStep >= index ? metric.value : Math.max(24, metric.value - 42)}%</b>
              </div>
            ))}
          </div>

          <div style={s.matchSignalGrid}>
            <span>Local vibe</span>
            <span>Live aura</span>
            <span>Safe match</span>
          </div>

          <div style={s.loadingBar}>
            <div style={{ ...s.loadingFill, width: matchingStep === 0 ? "34%" : matchingStep === 1 ? "68%" : "100%" }} />
          </div>
          <button style={s.ghostButton} onClick={() => setScreen("home")}>İptal et</button>
        </section>
      </main>
    );
  }

  if (screen === "chat") {
    return (
      <main style={appPageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
        <ThemeFX light={isLight} />
        <section style={s.phoneShell} className="lv-pop">
          <header style={s.chatHeader}>
            <button style={s.roundButton} onClick={() => setScreen("home")}>‹</button>
            <div style={{ ...s.matchAvatar, boxShadow: `0 0 36px ${selectedMood?.color || "#a855f7"}66` }}>{selectedMood?.emoji || "💜"}</div>
            <div style={{ flex: 1 }}>
              <h2 style={s.chatTitle}>Anonim eşleşme</h2>
              <p style={s.chatSub}>🟢 Online • {isTyping ? "karşı taraf yazıyor..." : selectedMood?.title}</p>
            </div>
            <button style={s.endButton} onClick={() => setScreen("home")}>Bitir</button>
          </header>
          <div style={s.chatSafetyRow}>
            <button style={s.chatDangerButton} onClick={() => setShowReportModal(true)}>🚨 Rapor Et</button>
            <button style={s.chatGhostButton} onClick={blockActiveChat}>⛔ Engelle</button>
          </div>
          <div style={s.chatInfo}><b>✨ Sohbet başladı!</b><span>İkiniz de {selectedMood?.title} modundasınız.</span></div>
          <div style={s.typingTopBar}>✨ typing sync active • ultra connection stable</div>
          <div style={s.chatPresenceStrip}><span style={s.liveTinyDot}></span><b>Canlı bağlantı aktif</b><small>{deliveryState}</small></div>
          <div style={s.messages}>
            {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
            {isTyping && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>
          {showAiOpeners && (
            <section style={s.aiOpenerPanel}>
              <div style={s.aiOpenerTop}>
                <b>smart opener</b>
                <button style={s.aiOpenerClose} onClick={() => setShowAiOpeners(false)}>×</button>
              </div>

              <div style={s.aiOpenerGrid}>
                {getAiOpeners(selectedMood).map((item) => (
                  <button key={item} style={s.aiOpenerButton} onClick={() => sendMessage(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div style={s.quickReplies}>{["Naber?", "Biraz konuşalım", "Oyun", "Ruh halim karışık"].map((item) => <button key={item} style={s.quickButton} onClick={() => sendMessage(item)}>{item}</button>)}</div>
          <footer style={isRecordingVoice ? s.inputAreaRecording : s.inputArea}>
            <button
              type="button"
              style={isRecordingVoice ? s.micButtonRecording : s.micButton}
              onMouseDown={startVoiceRecording}
              onMouseUp={finishVoiceRecording}
              onMouseLeave={cancelVoiceRecording}
              onTouchStart={startVoiceRecording}
              onTouchEnd={finishVoiceRecording}
              aria-label="Sesli mesaj"
            >
              {isRecordingVoice ? "●" : "🎙️"}
            </button>

            {isRecordingVoice ? (
              <div style={s.voiceRecordingBar}>
                <div style={s.voiceRecordingInfo}>
                  <b>Kaydediliyor</b>
                  <span>{formatVoiceDuration(voiceDuration)}</span>
                </div>
                <div style={s.waveformRow}>
                  {Array.from({ length: 18 }).map((_, index) => (
                    <i
                      key={index}
                      style={{
                        ...s.waveBar,
                        height: 8 + ((index * 7 + voiceDuration * 5) % 24)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <input
                style={s.messageInput}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isTyping ? "Karşı taraf yazıyor..." : "Mesaj yaz veya mikrofona basılı tut..."}
                maxLength={MESSAGE_MAX_LENGTH}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
            )}

            <button
              type="button"
              style={s.mediaButton}
              onClick={() => imageInputRef.current?.click()}
            >
              ✦
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />

            <button style={s.sendButton} onClick={() => sendMessage()}>➤</button>
          </footer>
          <BottomNav active="chat" onHome={() => { setActiveTab("home"); setScreen("home"); }} onChat={() => setScreen("chat")} onProfile={() => { setActiveTab("profile"); setScreen("home"); }} onPremium={() => { setActiveTab("premium"); setScreen("home"); }} />
        </section>
      </main>
    );
  }

  return (
    <main style={appPageStyle} className={isLight ? "lv-light-mode" : "lv-dark-mode"}>
      <ThemeFX light={isLight} />
      <section style={s.phoneShell} className="lv-pop">
        {showMatchModal && <div style={s.newMatchModal} className="lv-pop"><div style={s.newMatchOrb}>💜</div><b>New match found</b><span>%96 mood uyumu yakalandı</span><button style={s.modalButton} onClick={() => startChat(MOODS[2])}>Sohbeti Aç</button></div>}
        <header style={s.appHeader}>
          <Brand avatar={avatar} sub={displayName} />
          <button
            style={s.notificationBell}
            onClick={() => {
              setNotificationPanelOpen(true);
              markNotificationsRead();
            }}
          >
            🔔
            {appNotifications.some((item) => !item.read) && <span style={s.notificationDot}></span>}
          </button>
          <button style={s.navButton} onClick={logout}>Çıkış</button>
        </header>

        {toast && <div style={s.toast} onClick={() => setToast("")}>🔔 {dynamicToast || toast}</div>}
        <div style={s.firebaseCorePanel}><span style={s.liveTinyDot}></span><b>Firebase Core bağlı</b><small>profiles • rooms • live chat • {presenceSynced ? "presence synced" : "presence ready"}</small></div>
        <div style={s.accountSecurePanel}><span>🛡️</span><b>Hesap güvenliği aktif</b><small>{user?.email ? `Giriş: ${user.email}` : "Anonim değil, giriş gerekli"}</small></div>
        <div style={s.unreadMiniPanel}><span>💬</span><b>{unreadCount > 0 ? `${unreadCount} okunmamış mesaj` : "Mesajlar güncel"}</b><small>Son okuma: {new Date(lastReadAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small></div>
        <button style={s.closeCircleButton} onClick={() => setCloseCircleOpen(true)}>◈ Saved Aura • {savedAuras.length}</button>
        <button style={s.globalRoomButton} onClick={() => setGlobalRoomOpen(true)}>
          🌍 Global Lounge • everyone online
        </button>
        {!isInstalledApp && <button style={s.installBanner} onClick={installLyvoraApp}>📲 Lyvora’yı uygulama gibi kur</button>}
        {activeTab === "home" && (
          <>
            <div style={s.statusPill}><span style={s.onlineDot}></span>{liveOnlineCount.toLocaleString("tr-TR")} kişi şu an aktif</div>
            <section style={s.cinematicHeroCard} className="lv-liquid-card">
              <div style={s.heroTopRow}><span style={s.goldBadge}>✦ Ultra polish</span><span style={s.heroLiveChip}><span style={s.liveTinyDot}></span>Live</span></div>
              <section style={s.homeHero}>
              <h1 style={s.homeTitle}>Şu an nasıl<br />hissediyorsan,<br /><span style={s.gradientText}>oradan başla.</span></h1>
              <p style={s.homeText}>Bir mood seç, premium anonim sohbet ekranına geç.</p>
              <div style={s.polishNotes}>{FINAL_POLISH_NOTES.map((note) => <span key={note}>✓ {note}</span>)}</div>
            </section>
            </section>
            <section style={s.appStoreStrip}><div><b>4.9</b><span> app feel</span></div><div><b>96%</b><span> match vibe</span></div><div><b>Live</b><span> presence</span></div></section>
            <LiveVibePanel
              onlineCount={liveOnlineCount}
              regionLabel={regionMatchLabel(regionProfile)}
              onVoicePreview={() => setVoicePreviewPlaying((prev) => !prev)}
              previewPlaying={voicePreviewPlaying}
            />
            <VibeStoryStrip
              stories={vibeStories}
              profilePhoto={profilePhoto}
              avatar={avatar}
              onAdd={() => storyInputRef.current?.click()}
              onOpen={() => setStoryModalOpen(true)}
            />

            <input
              ref={storyInputRef}
              type="file"
              accept="image/*"
              onChange={handleStoryUpload}
              style={{ display: "none" }}
            />
            <section style={s.discoverStrip}>
              {DISCOVER_CARDS.map((card) => {
                const linkedMood =
                  card.title.includes("Gece") ? MOODS[1] :
                  card.title.includes("Oyun") ? MOODS[3] :
                  card.title.includes("Derin") ? MOODS[2] :
                  MOODS[7];

                return (
                  <button
                    key={card.title}
                    className="lv-premium-depth"
                    style={s.discoverCard}
                    onClick={() => startChat(linkedMood)}
                  >
                    <span>{card.emoji}</span>
                    <b>{card.title}</b>
                    <small>{card.tag} • %{card.match}</small>
                  </button>
                );
              })}
            </section>
            <section style={s.activityFeedPanel}><div style={s.sectionHeader}><b>Live activity</b><span>{activityPulse} yeni sinyal</span></div>{ACTIVITY_FEED.slice(0,3).map((item) => <div key={item.title} style={s.activityItem}><span style={s.activityIcon}>{item.icon}</span><div><b>{item.title}</b><small>{item.text}</small></div><em>{item.time}</em></div>)}</section>
            <RegionMatchPanel region={regionProfile} score={regionalMatchScore} onChange={(nextRegion) => { setRegionProfile(nextRegion); setRegionalMatchScore(nextRegion.mode === "local" ? 97 : nextRegion.mode === "country" ? 92 : 84); }} />
            <section style={s.moodGrid}>{MOODS.map((mood) => <button key={mood.id} className="lv-premium-depth" style={{ ...s.moodCard, borderColor: `${mood.color}44` }} onClick={() => startChat(mood)}><span style={s.moodIcon}>{mood.emoji}</span><b>{mood.title}</b><small>{mood.desc}</small></button>)}</section>
          </>
        )}

        {activeTab === "chat" && (
          <section style={s.emptyTab}>
            <div style={s.emptyIcon}>💬</div>
            <h2>Henüz açık sohbet yok</h2>
            <p>Bir mood seçtiğinde sohbet burada devam eder.</p>
            <button style={s.primaryFull} onClick={() => startChat(MOODS[1])}>Hızlı eşleşme başlat</button>
          </section>
        )}

        {activeTab === "profile" && <ProfilePanel displayName={displayName} avatar={avatar} profilePhoto={profilePhoto} profileBio={profileBio} profileVibe={profileVibe} profileCity={profileCity} editOpen={profileEditOpen} setEditOpen={setProfileEditOpen} setProfileBio={setProfileBio} setProfileVibe={setProfileVibe} setProfileCity={setProfileCity} email={user?.email} profileLevel={profileLevel} profileXP={profileXP} profileVisitors={profileVisitors} onPhotoUpload={handleProfilePhotoUpload} onPhotoRemove={removeProfilePhoto} />}

        {activeTab === "premium" && (
          <>
            <PricingPanel />
            <section style={s.bottomPanel}><b>👑 Premium ile sınırları kaldır</b><span>Özel mood odaları, favoriler ve uzun sohbet modu yakında.</span><button style={s.primaryFull}>Premium Önizleme Aç</button></section>
          </>
        )}

        {notificationPanelOpen && (
          <NotificationCenter
            notifications={appNotifications}
            permission={notificationPermission}
            onClose={() => setNotificationPanelOpen(false)}
            onEnable={requestNotificationAccess}
          />
        )}

        <BottomNav active={activeTab} onHome={() => setActiveTab("home")} onChat={() => setActiveTab("chat")} onProfile={() => setActiveTab("profile")} onPremium={() => setActiveTab("premium")} />
        <SupportWidget
          open={supportOpen}
          setOpen={setSupportOpen}
          messages={supportMessages}
          text={supportText}
          setText={setSupportText}
          typing={supportTyping}
          onSend={sendSupportMessage}
        />
      </section>
    </main>
  );
}

function LegalPage({
  title,
  badge,
  text,
  onBack
}: {
  title: string;
  badge: string;
  text: string[];
  onBack: () => void;
}) {
  return (
    <main style={s.page} className="lv-dark-mode">
      <ThemeFX />
      <section style={s.legalShell} className="lv-pop">
        <Brand sub="Legal center" />
        <span style={s.legalBadge}>{badge}</span>
        <h1 style={s.legalTitle}>{title}</h1>

        <div style={s.legalTextBox}>
          {text.map((item) => (
            <p key={item} style={s.legalText}>{item}</p>
          ))}
        </div>

        <button style={s.primaryButton} onClick={onBack}>
          Ana sayfaya dön
        </button>
      </section>
    </main>
  );
}

function GlobalRoomModal({
  messages,
  value,
  onChange,
  onClose,
  onSend
}: {
  messages: GlobalRoomMessage[];
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div style={s.profileEditOverlay}>
      <section style={s.globalRoomModal} className="lv-pop">
        <div style={s.profileEditHeader}>
          <b>🌍 Global Lounge</b>
          <button style={s.supportClose} onClick={onClose}>×</button>
        </div>

        <div style={s.globalRoomInfo}>
          <span>live internet room</span>
          <b>4.8k online now</b>
        </div>

        <div style={s.globalRoomFeed}>
          {messages.map((item) => (
            <div key={item.id} style={s.globalRoomMessage}>
              <div style={s.globalRoomMeta}>
                <b>{item.country} {item.user}</b>
                <small>{item.time}</small>
              </div>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={s.globalRoomComposer}>
          <input
            style={s.input}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="send your vibe..."
            maxLength={180}
          />
          <button style={s.sendButton} onClick={onSend}>➤</button>
        </div>
      </section>
    </div>
  );
}

function CloseCircleModal({
  savedAuras,
  onClose,
  onOpenAura,
  onRemove
}: {
  savedAuras: SavedAura[];
  onClose: () => void;
  onOpenAura: (aura: SavedAura) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div style={s.profileEditOverlay}>
      <section style={s.closeCircleModal} className="lv-pop">
        <div style={s.profileEditHeader}>
          <b>Saved Aura</b>
          <button style={s.supportClose} onClick={onClose}>×</button>
        </div>

        {savedAuras.length === 0 ? (
          <div style={s.emptyStory}>
            <b>Henüz aura kaydetmedin</b>
            <span>Bir sohbetten ◈ Kaydet diyerek favori bağ oluştur.</span>
          </div>
        ) : (
          <div style={s.savedAuraList}>
            {savedAuras.map((aura) => (
              <div key={aura.id} style={s.savedAuraCard}>
                <span style={s.savedAuraIcon}>{aura.avatar}</span>
                <div>
                  <b>{aura.name}</b>
                  <small>{aura.match}% match • {aura.lastSeen}</small>
                </div>
                <button style={s.savedAuraOpen} onClick={() => onOpenAura(aura)}>Aç</button>
                <button style={s.savedAuraRemove} onClick={() => onRemove(aura.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VibeStoryStrip({
  stories,
  profilePhoto,
  avatar,
  onAdd,
  onOpen
}: {
  stories: VibeStory[];
  profilePhoto: string;
  avatar: string;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <section style={s.vibeStoryStrip}>
      <button style={s.vibeStoryAdd} onClick={onAdd}>
        <span style={s.vibeStoryAvatar}>
          {profilePhoto ? <img src={profilePhoto} alt="Story" style={s.vibeStoryImage} /> : avatar}
        </span>
        <b style={s.microModernText}>Live Story</b>
      </button>

      {stories.slice(0, 5).map((story) => (
        <button key={story.id} style={s.vibeStoryItem} onClick={onOpen}>
          <img src={story.imageUrl} alt={story.caption} style={s.vibeStoryImage} />
          <b>{story.caption}</b>
        </button>
      ))}
    </section>
  );
}

function StoryModal({
  stories,
  onClose,
  onDelete
}: {
  stories: VibeStory[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const activeStory = stories[0];

  return (
    <div style={s.profileEditOverlay}>
      <section style={s.storyModal} className="lv-pop">
        <div style={s.profileEditHeader}>
          <b>Vibe Story</b>
          <button style={s.supportClose} onClick={onClose}>×</button>
        </div>

        {activeStory ? (
          <>
            <img src={activeStory.imageUrl} alt={activeStory.caption} style={s.storyModalImage} />
            <div style={s.storyModalFooter}>
              <div>
                <b>{activeStory.caption}</b>
                <span>{activeStory.time}</span>
              </div>
              <button style={s.chatDangerButton} onClick={() => onDelete(activeStory.id)}>Sil</button>
            </div>
          </>
        ) : (
          <div style={s.emptyStory}>
            <b>Henüz story yok</b>
            <span>Profilinden bir vibe paylaş.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function NotificationCenter({
  notifications,
  permission,
  onClose,
  onEnable
}: {
  notifications: AppNotification[];
  permission: NotificationPermission;
  onClose: () => void;
  onEnable: () => void;
}) {
  return (
    <div style={s.profileEditOverlay}>
      <section style={s.notificationPanel} className="lv-pop">
        <div style={s.profileEditHeader}>
          <b>live signals</b>
          <button style={s.supportClose} onClick={onClose}>×</button>
        </div>

        <button style={s.notificationPermissionCard} onClick={onEnable}>
          <span>🔔</span>
          <div>
            <b>{permission === "granted" ? "live signals aktif" : "live signalsi aç"}</b>
            <small>{permission === "granted" ? "Match ve mesajları kaçırmayacaksın." : "Yeni match ve mesajlarda haber verelim."}</small>
          </div>
        </button>

        <div style={s.notificationList}>
          {notifications.map((item) => (
            <div key={item.id} style={item.read ? s.notificationItem : s.notificationItemUnread}>
              <span>{item.icon}</span>
              <div>
                <b>{item.title}</b>
                <small>{item.text}</small>
              </div>
              <em>{item.time}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SupportWidget({
  open,
  setOpen,
  messages,
  text,
  setText,
  typing,
  onSend
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  messages: SupportMessage[];
  text: string;
  setText: (value: string) => void;
  typing: boolean;
  onSend: (text?: string) => void;
}) {
  return (
    <div style={s.supportWrap}>
      {open && (
        <section style={s.supportPanel} className="lv-pop">
          <header style={s.supportHeader}>
            <div style={s.supportAvatar}>💬</div>
            <div style={{ flex: 1 }}>
              <b>Lyvora Destek</b>
              <span>Genelde birkaç dakika içinde yanıtlar</span>
            </div>
            <button style={s.supportClose} onClick={() => setOpen(false)}>×</button>
          </header>

          <div style={s.supportBody}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={message.from === "user" ? s.supportUserBubble : s.supportBotBubble}
              >
                {message.text}
                <small>{message.time}</small>
              </div>
            ))}

            {typing && (
              <div style={s.supportBotBubble}>
                Yazıyor...
                <small>Şimdi</small>
              </div>
            )}
          </div>

          <div style={s.supportQuickRow}>
            {["Premium bilgi", "Hesap sorunu", "Gizlilik"].map((item) => (
              <button key={item} style={s.supportQuickButton} onClick={() => onSend(item)}>
                {item}
              </button>
            ))}
          </div>

          <footer style={s.supportInputRow}>
            <input
              style={s.supportInput}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onSend()}
              placeholder="Destek mesajı yaz..."
            />
            <button style={s.supportSend} onClick={() => onSend()}>➤</button>
          </footer>
        </section>
      )}

      <button style={s.supportFab} onClick={() => setOpen(!open)}>
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}

function VoiceWave({ active = false }: { active?: boolean }) {
  return (
    <div style={s.voiceWave}>
      {Array.from({ length: 16 }).map((_, index) => (
        <span
          key={index}
          style={{
            ...s.voiceWaveBar,
            height: active ? 8 + ((index * 9) % 25) : 8 + ((index * 5) % 18),
            opacity: active ? 1 : 0.72
          }}
        />
      ))}
    </div>
  );
}

function VoiceMessageCard({ duration, voiceUrl }: { duration: string; voiceUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  function toggleVoice() {
    if (!voiceUrl) {
      setPlaying((prev) => !prev);
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(voiceUrl);
      audioElementRef.current.onended = () => setPlaying(false);
    }

    if (playing) {
      audioElementRef.current.pause();
      setPlaying(false);
    } else {
      audioElementRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  return (
    <button style={s.voiceMessageCard} onClick={toggleVoice}>
      <span style={playing ? s.voicePlayActive : s.voicePlay}>{playing ? "Ⅱ" : "▶"}</span>
      <VoiceWave active={playing} />
      <b>{duration}</b>
    </button>
  );
}

function ImageMessageCard({ imageUrl }: { imageUrl?: string }) {
  return (
    <div style={s.imageMessageCard}>
      {imageUrl ? (
        <img src={imageUrl} alt="Gönderilen medya" style={s.chatImage} />
      ) : (
        <div style={s.imageFallback}>📸</div>
      )}
    </div>
  );
}

function LiveVibePanel({
  onlineCount,
  regionLabel,
  onVoicePreview,
  previewPlaying
}: {
  onlineCount: number;
  regionLabel: string;
  onVoicePreview: () => void;
  previewPlaying: boolean;
}) {
  return (
    <section style={s.liveVibePanel} className="lv-premium-depth">
      <div style={s.liveVibeTop}>
        <div style={s.liveVibeTitleBox}>
          <b>live aura</b>
          <span>{regionLabel}</span>
        </div>

        <div style={s.onlinePulseBadge}>
          <span style={s.liveTinyDot}></span>
          {onlineCount.toLocaleString("tr-TR")} online
        </div>
      </div>

      <div style={s.liveMatchGrid}>
        {[
          { mark: "☾", label: "Gece", value: "96%" },
          { mark: "◈", label: "Bağ", value: "93%" },
          { mark: "⌘", label: "Oyun", value: "89%" }
        ].map((item) => (
          <div key={item.label} style={s.liveMatchCleanChip}>
            <i>{item.mark}</i>
            <div>
              <b>{item.label}</b>
              <span>{item.value} uyum</span>
            </div>
          </div>
        ))}
      </div>

      <button style={s.voicePreviewCleanCard} onClick={onVoicePreview}>
        <span style={previewPlaying ? s.voicePlayActive : s.voicePlay}>{previewPlaying ? "Ⅱ" : "▶"}</span>
        <div style={s.voicePreviewText}>
          <b style={s.microModernText}>Voice Aura</b>
          <small>{previewPlaying ? "Ses dalgası aktif" : "tap to listen"}</small>
        </div>
        <VoiceWave active={previewPlaying} />
      </button>
    </section>
  );
}

function RegionMatchPanel({
  region,
  score,
  onChange
}: {
  region: RegionProfile;
  score: number;
  onChange: (region: RegionProfile) => void;
}) {
  return (
    <section style={s.regionPanel} className="lv-premium-depth">
      <div style={s.regionTop}>
        <div>
          <b>Bölgesel eşleşme</b>
          <span>{regionMatchLabel(region)} • {region.language.toUpperCase()}</span>
        </div>
        <strong>{score}%</strong>
      </div>

      <div style={s.regionChips}>
        {(["local", "country", "global"] as RegionProfile["mode"][]).map((mode) => (
          <button
            key={mode}
            style={region.mode === mode ? s.regionChipActive : s.regionChip}
            onClick={() => onChange({ ...region, mode })}
          >
            {mode === "local" ? "Yakınım" : mode === "country" ? "Ülkem" : "Global"}
          </button>
        ))}
      </div>

      <select
        style={s.regionSelect}
        value={`${region.country}|${region.city}|${region.language}|${region.timezone}`}
        onChange={(event) => {
          const [country, city, language, timezone] = event.target.value.split("|");
          onChange({ country, city, language, timezone, mode: country === "Global" ? "global" : region.mode });
        }}
      >
        {REGION_PRESETS.map((item) => (
          <option
            key={`${item.country}-${item.city}`}
            value={`${item.country}|${item.city}|${item.language}|${item.timezone}`}
          >
            {item.city}, {item.country}
          </option>
        ))}
      </select>
    </section>
  );
}

function SplashScreen() {
  const splash = getSplashLocale();

  return (
    <main style={s.splashPage}>
      <div style={s.splashGrid}></div>
      <div style={s.splashOrbOne}></div>
      <div style={s.splashOrbTwo}></div>

      <section style={s.splashPremiumCard} className="lv-pop">
        <div style={s.splashLogoMark}>
          <LyvoraLogo size={108} />
        </div>

        <div style={s.splashWordmark}>LYVORA</div>
        <div style={s.splashMiniLine}></div>

        <h1 style={s.splashWelcome}>
          <span>Lyvora</span>{" "}
          {splash.headline.replace(/^Lyvora\s*(ile|with)?\s*/i, "")}
        </h1>

        <p style={s.splashSubline}>{splash.subline}</p>

        <div style={s.splashHeart}>💜</div>

        <div style={s.splashSpinnerWrap}>
          <div style={s.splashSpinner}></div>
        </div>

        <b style={s.splashLoadingText}>{splash.loading}</b>
        <small style={s.splashWaitText}>{splash.wait}</small>

        <div style={s.splashDivider}></div>

        <div style={s.splashBadges}>
          <span><b>🛡️</b>{splash.badges[0]}</span>
          <span><b>🔒</b>{splash.badges[1]}</span>
          <span><b>∞</b>{splash.badges[2]}</span>
          <span><b>💜</b>{splash.badges[3]}</span>
        </div>
      </section>

      <footer style={s.splashCopyright}>Lyvora © 2026</footer>
    </main>
  );
}

function BottomNav({ active, onHome, onChat, onProfile, onPremium }: { active: Tab; onHome: () => void; onChat: () => void; onProfile: () => void; onPremium: () => void }) {
  return (
    <nav style={s.bottomNav} className="lv-floating-nav"><span style={s.navGlowOrb}></span>
      <button style={active === "home" ? s.navItemActive : s.navItem} onClick={onHome}>🏠<span>Ana</span></button>
      <button style={active === "chat" ? s.navItemActive : s.navItem} onClick={onChat}>💬<span>Sohbet</span></button>
      <button style={active === "profile" ? s.navItemActive : s.navItem} onClick={onProfile}>👤<span>Profil</span></button>
      <button style={active === "premium" ? s.navItemActive : s.navItem} onClick={onPremium}>👑<span>Plus</span></button>
    </nav>
  );
}

function ProfilePanel({
  displayName,
  avatar,
  profilePhoto,
  profileBio,
  profileVibe,
  profileCity,
  editOpen,
  setEditOpen,
  setProfileBio,
  setProfileVibe,
  setProfileCity,
  email,
  profileLevel,
  profileXP,
  profileVisitors,
  onPhotoUpload,
  onPhotoRemove
}: {
  displayName: string;
  avatar: string;
  profilePhoto: string;
  profileBio: string;
  profileVibe: string;
  profileCity: string;
  editOpen: boolean;
  setEditOpen: (value: boolean) => void;
  setProfileBio: (value: string) => void;
  setProfileVibe: (value: string) => void;
  setProfileCity: (value: string) => void;
  email?: string | null;
  profileLevel: number;
  profileXP: number;
  profileVisitors: number;
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemove: () => void;
}) {
  return (
    <section style={s.profilePanel} className="lv-pop lv-profile-panel">
      <div style={s.profileTop}>
        <div style={s.profileAvatarWrap}>
          {profilePhoto ? (
            <img src={profilePhoto} alt={displayName} style={s.profilePhoto} />
          ) : (
            <div style={s.profileAvatar}>{avatar}</div>
          )}
          <label style={s.profilePhotoButton}>
            ✦
            <input type="file" accept="image/*" onChange={onPhotoUpload} style={{ display: "none" }} />
          </label>
        </div>
        <div>
          <h2 style={s.profileName}>{displayName} <span style={s.verifiedBadge}>✔</span></h2>
          <p style={s.profileMail}>{email || "Anonim kullanıcı"}</p>
        </div>
      </div>
      <div style={s.levelCard}><div><b>Level {profileLevel}</b><span style={{ display: "block", color: "rgba(255,255,255,.62)", marginTop: 4 }}>Verified Plus member</span></div><div style={s.levelXP}>{profileXP}% XP</div></div><div style={s.levelTrack}><div style={{ ...s.levelFill, width: `${profileXP}%` }} /></div><div style={s.profileStats}>
        <div style={s.profileStat}><b>12</b><span>Sohbet</span></div>
        <div style={s.profileStat}><b>7</b><span>Mood</span></div>
        <div style={s.profileStat}><b>Premium</b><span>Plan</span></div>
        <div style={s.profileStat}><b>{profileVisitors}</b><span>Ziyaretçi</span></div>
      </div>
      <div style={s.profileBox}>
        <b>✦ {profileVibe}</b>
        <span>{profileBio}</span>
        <small style={s.profileCity}>📍 {profileCity}</small>
      </div>
      {profilePhoto && <button style={s.profilePhotoRemove} onClick={onPhotoRemove}>Fotoğrafı kaldır</button>}
      <section style={s.settingsGlassPanel}><b>⚙️ premium aura</b><span>live signals açık • Online presence aktif • Mood sync açık</span></section>
      <section style={s.savedAuraProfileBox}>
        <div>
          <b>◈ Saved Aura</b>
          <span>{savedAuras.length} favori bağ kaydedildi.</span>
        </div>
        <button style={s.savedAuraOpen} onClick={() => setCloseCircleOpen(true)}>Aç</button>
      </section>

      <section style={s.moderationPanel}>
        <div>
          <b>🛡️ Güvenlik merkezi</b>
          <span>Report, block ve güvenli sohbet sistemi aktif.</span>
        </div>
        <small>Moderation ready</small>
      </section>
      <button style={s.primaryFull} onClick={() => setEditOpen(true)}>edit aura</button>

      {editOpen && (
        <div style={s.profileEditOverlay}>
          <section style={s.profileEditModal} className="lv-pop">
            <div style={s.profileEditHeader}>
              <b>edit aura</b>
              <button style={s.supportClose} onClick={() => setEditOpen(false)}>×</button>
            </div>

            <label style={s.label}>Bio</label>
            <textarea
              style={s.profileEditTextarea}
              value={profileBio}
              onChange={(event) => setProfileBio(event.target.value.slice(0, 140))}
              placeholder="Kendini kısa anlat..."
              maxLength={140}
            />

            <label style={s.label}>Vibe durumu</label>
            <input
              style={s.input}
              value={profileVibe}
              onChange={(event) => setProfileVibe(event.target.value.slice(0, 32))}
              placeholder="Örn: Gece enerjisi"
              maxLength={32}
            />

            <label style={s.label}>Şehir / bölge</label>
            <input
              style={s.input}
              value={profileCity}
              onChange={(event) => setProfileCity(event.target.value.slice(0, 32))}
              placeholder="Örn: İstanbul"
              maxLength={32}
            />

            <div style={s.profileEditQuick}>
              {["Gece enerjisi", "Sakin vibe", "Derin sohbet", "Oyun modu"].map((item) => (
                <button key={item} style={s.regionChip} onClick={() => setProfileVibe(item)}>
                  {item}
                </button>
              ))}
            </div>

            <button style={s.primaryFull} onClick={() => setEditOpen(false)}>save vibe</button>
          </section>
        </div>
      )}
    </section>
  );
}

function PricingPanel() {
  return (
    <section style={s.pricingPanel} className="lv-pop">
      <div style={s.pricingTop}>
        <span style={s.priceBadge}>👑 Premium fiyatlar</span>
        <h2 style={s.priceTitle}>Planını seç, sohbeti büyüt.</h2>
      </div>
      <div style={s.priceGrid} className="lv-price-grid">
        {PLANS.map((plan) => (
          <div key={plan.name} style={plan.highlight ? s.priceCardHot : s.priceCard}>
            <span style={s.planTag}>{plan.tag}</span>
            <h3 style={s.planName}>{plan.name}</h3>
            <div style={s.planPrice}>
              {plan.price}
              {plan.name !== "Free" && <small style={s.planPeriod}>/ 1 ay</small>}
            </div>
            <div style={s.planBillingNote}>
              {plan.name === "Free" ? "Ücretsiz kullanım" : "Aylık abonelik • istediğin zaman iptal"}
            </div>
            <div style={s.planFeatures}>{plan.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div>
            <button style={plan.highlight ? s.planButtonHot : s.planButton}>{plan.name === "Free" ? "Ücretsiz Başla" : plan.highlight ? "1 Aylık Premium Başlat" : "1 Aylık Ultra Seç"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ThemeFX({ light = false }: { light?: boolean }) {
  return (
    <>
      <style>{css}</style>
      <div style={light ? s.bgGlowLightOne : s.bgGlowOne} />
      <div style={light ? s.bgGlowLightTwo : s.bgGlowTwo} />
      <div style={s.bgGlowThree} />
      <div style={s.bgGrid} />
    </>
  );
}

function Bubble({ msg }: { msg: Message }) {
  return (
    <div
      className={`lv-message ${msg.from === "me" ? "lv-my-message" : msg.from === "bot" ? "lv-bot-message" : "lv-system-message"}`}
      style={{
        ...s.message,
        ...(msg.from === "me" ? s.myMessage : {}),
        ...(msg.from === "bot" ? s.botMessage : {}),
        ...(msg.from === "system" ? s.systemMessage : {})
      }}
    >
      {(msg.type === "voice" || String(msg.text).startsWith("voice::")) ? (
        <VoiceMessageCard duration={msg.duration || String(msg.text).replace("voice::", "") || "0:04"} voiceUrl={msg.voiceUrl} />
      ) : (
        <span>{msg.text}</span>
      )}
      {msg.time && <small style={s.time}>{msg.time}</small>}
    </div>
  );
}

function TypingBubble() {
  return (
    <div
      className="lv-message"
      style={{
        ...s.message,
        ...s.botMessage,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8
      }}
    >
      <span style={s.typingText}>Karşı taraf yazıyor</span>
      <span style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function LyvoraLogo({ size = 52 }: { size?: number }) {
  return (
    <div style={{ ...s.lyvoraLogoWrap, width: size, height: size }}>
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-label="Lyvora Neon V Logo">
        <defs>
          <linearGradient id="lyvoraNeonV" x1="10" y1="8" x2="54" y2="58">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="45%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>

          <radialGradient id="lyvoraNeonBg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(168,85,247,.42)" />
            <stop offset="58%" stopColor="rgba(34,211,238,.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,.04)" />
          </radialGradient>

          <filter id="lyvoraNeonGlow">
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="18"
          fill="url(#lyvoraNeonBg)"
          stroke="rgba(255,255,255,.16)"
          strokeWidth="1"
        />

        <path
          d="M15 15L29.4 49H35.2L49 15H40.6L32.4 38.2L23.9 15H15Z"
          fill="url(#lyvoraNeonV)"
          filter="url(#lyvoraNeonGlow)"
        />

        <path
          d="M20 15L31.8 43.2L43.8 15"
          fill="none"
          stroke="rgba(255,255,255,.78)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".55"
        />

        <circle cx="50" cy="13" r="2.2" fill="#fff" opacity=".85" />
        <circle cx="13" cy="50" r="1.8" fill="#22d3ee" opacity=".75" />
      </svg>
    </div>
  );
}

function Brand({ sub = "Mood based social app" }: { avatar?: string; sub?: string }) {
  return (
    <div style={s.brand}>
      <LyvoraLogo />
      <div>
        <b style={s.brandName}>Lyvora</b>
        <span style={s.brandSub}>{sub}</span>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div style={s.featureCard} className="lv-card"><div style={s.featureIcon}>{icon}</div><h3>{title}</h3><p>{text}</p></div>;
}

const css = `
@keyframes lvMouseGlow { 0%,100% { opacity: .32; transform: scale(1); } 50% { opacity: .62; transform: scale(1.08); } }
@keyframes lvAuroraShift { 0%,100% { transform: translate3d(0,0,0) scale(1); filter: hue-rotate(0deg); } 50% { transform: translate3d(18px,-14px,0) scale(1.04); filter: hue-rotate(18deg); } }
@keyframes lvLiquidShine { 0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; } 35% { opacity: .42; } 100% { transform: translateX(130%) skewX(-18deg); opacity: 0; } }
@keyframes lvNavFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes lvPop { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes lvRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lvFloat { 0%,100% { transform: translateY(0) rotate(-.3deg); } 50% { transform: translateY(-13px) rotate(.3deg); } }
@keyframes lvPulse { 0%,100% { opacity: .58; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes lvMsg { from { opacity: 0; transform: translateY(16px) scale(.94); filter: blur(7px); } 65% { transform: translateY(-2px) scale(1.012); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
@keyframes lvLogoPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 38px rgba(217,70,239,.35); } 50% { transform: scale(1.08); box-shadow: 0 0 78px rgba(217,70,239,.7); } }
@keyframes lvLoading { from { width: 0%; } to { width: 100%; } }
@keyframes lvSweep { from { transform: translateX(-120%); } to { transform: translateX(120%); } }
.lv-pop { animation: lvPop .55s cubic-bezier(.2,.8,.2,1) both; }
.lv-rise { animation: lvRise .8s cubic-bezier(.2,.8,.2,1) both; }
.lv-splash-card { animation: lvPop .75s cubic-bezier(.2,.8,.2,1) both; }
.lv-logo-pulse { animation: lvLogoPulse 1.35s ease-in-out infinite; }
.lv-loading-fill { animation: lvLoading 1.3s ease forwards; }
.lv-float-soft { animation: lvFloat 5.5s ease-in-out infinite; }
.lv-card { transition: transform .25s ease, border-color .25s ease, background .25s ease; }
.lv-card:hover { transform: translateY(-7px); border-color: rgba(244,114,182,.45) !important; background: rgba(255,255,255,.1) !important; }
.lv-liquid-card { position: relative; overflow: hidden; }
.lv-liquid-card::after { content: ""; position: absolute; inset: -40%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent); animation: lvLiquidShine 5.4s ease-in-out infinite; pointer-events: none; }
.lv-premium-depth { transition: transform .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s ease, border-color .24s ease !important; }
.lv-premium-depth:hover { transform: translateY(-6px) scale(1.015) rotate(.25deg) !important; box-shadow: 0 26px 80px rgba(0,0,0,.32), 0 0 38px rgba(217,70,239,.16) !important; }
.lv-floating-nav { animation: lvNavFloat 4.2s ease-in-out infinite; }
[style*="grid-template-columns: repeat(3,1fr)"] > div { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.065); border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 3px; text-align: center; }
[style*="grid-template-columns: repeat(3,1fr)"] > div b { font-size: 18px; }
[style*="grid-template-columns: repeat(3,1fr)"] > div span { color: rgba(255,255,255,.58); font-size: 11px; font-weight: 800; }
[style*="display: flex"][style*="flex-wrap: wrap"] > span { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.065); color: rgba(255,255,255,.72); border-radius: 999px; padding: 8px 10px; font-size: 11px; font-weight: 900; }
.lv-message { animation: lvMsg .3s ease both; }
button { transition: transform .18s ease, filter .18s ease, background .18s ease; }
button:hover { transform: translateY(-2px); filter: brightness(1.08); }
button:active { transform: translateY(0) scale(.98); }

@keyframes lvCinematicSweep { 0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; } 25% { opacity: .65; } 100% { transform: translateX(140%) skewX(-18deg); opacity: 0; } }
@keyframes lvToastSlide { from { opacity: 0; transform: translateY(-14px) scale(.96); filter: blur(8px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
@keyframes lvCardSwipe { from { opacity: 0; transform: translateX(18px) rotate(1deg); } to { opacity: 1; transform: translateX(0) rotate(0); } }
@keyframes lvMusicBounce { 0%,100% { height: 8px; opacity: .6; } 50% { height: 20px; opacity: 1; } }
@keyframes lvGlowBorder { 0%,100% { box-shadow: 0 0 0 rgba(217,70,239,0); } 50% { box-shadow: 0 0 38px rgba(217,70,239,.35); } }
@keyframes lvOnlinePulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); } 50% { transform: scale(1.18); box-shadow: 0 0 28px rgba(34,197,94,.85); } }
input::placeholder { color: rgba(255,255,255,.42); }
.lv-message i { width: 7px; height: 7px; border-radius: 99px; background: rgba(255,255,255,.72); display: block; animation: lvPulse .9s ease-in-out infinite; }
.lv-message i:nth-child(2) { animation-delay: .12s; }
.lv-message i:nth-child(3) { animation-delay: .24s; }

/* Lyvora v3.8.7 - Premium Light Mode Readability Fix */
.lv-light-mode {
  color: #120820 !important;
}

.lv-light-mode h1,
.lv-light-mode h2,
.lv-light-mode h3,
.lv-light-mode b,
.lv-light-mode strong {
  color: #120820 !important;
  text-shadow: none !important;
}

.lv-light-mode p,
.lv-light-mode small,
.lv-light-mode span {
  text-shadow: none !important;
}

.lv-light-mode [style*="rgba(255,255,255,.72)"],
.lv-light-mode [style*="rgba(255,255,255,.66)"],
.lv-light-mode [style*="rgba(255,255,255,.62)"],
.lv-light-mode [style*="rgba(255,255,255,.58)"],
.lv-light-mode [style*="rgba(255,255,255,.56)"],
.lv-light-mode [style*="rgba(255,255,255,.52)"] {
  color: rgba(18,8,32,.72) !important;
}

.lv-light-mode [style*="rgba(255,255,255,.76)"],
.lv-light-mode [style*="rgba(255,255,255,.75)"] {
  color: rgba(18,8,32,.82) !important;
}

.lv-light-mode .lv-card,
.lv-light-mode .lv-premium-depth,
.lv-light-mode .lv-liquid-card {
  background: rgba(255,255,255,.78) !important;
  border-color: rgba(88,28,135,.16) !important;
  box-shadow: 0 22px 70px rgba(88,28,135,.14), inset 0 1px 0 rgba(255,255,255,.72) !important;
  backdrop-filter: blur(18px) !important;
}

.lv-light-mode button {
  color: #120820;
}

.lv-light-mode input {
  color: #120820 !important;
}

.lv-light-mode input::placeholder {
  color: rgba(18,8,32,.42) !important;
}

.lv-light-mode [style*="background: rgba(255,255,255,.07)"],
.lv-light-mode [style*="background: rgba(255,255,255,.08)"],
.lv-light-mode [style*="background: rgba(255,255,255,.09)"] {
  background: rgba(255,255,255,.62) !important;
  border-color: rgba(88,28,135,.14) !important;
}

.lv-light-mode [style*="color: white"] {
  color: #120820 !important;
}

.lv-light-mode [style*="background: linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)"],
.lv-light-mode [style*="background: linear-gradient(135deg,#7c3aed,#d946ef)"],
.lv-light-mode [style*="background: linear-gradient(90deg,#7c3aed,#d946ef)"] {
  color: white !important;
}

.lv-light-mode [style*="grid-template-columns: repeat(3,1fr)"] > div {
  background: rgba(255,255,255,.72) !important;
  border-color: rgba(88,28,135,.14) !important;
}

.lv-light-mode [style*="grid-template-columns: repeat(3,1fr)"] > div b {
  color: #120820 !important;
}

.lv-light-mode [style*="grid-template-columns: repeat(3,1fr)"] > div span {
  color: rgba(18,8,32,.62) !important;
}

.lv-light-mode [style*="display: flex"][style*="flex-wrap: wrap"] > span {
  background: rgba(255,255,255,.68) !important;
  border-color: rgba(88,28,135,.14) !important;
  color: rgba(18,8,32,.72) !important;
}

/* Lyvora v3.8.8 - Hard Light Contrast Fix */
.lv-light-mode,
.lv-light-mode * {
  text-shadow: none !important;
}

.lv-light-mode h1,
.lv-light-mode h2,
.lv-light-mode h3,
.lv-light-mode h4,
.lv-light-mode p,
.lv-light-mode b,
.lv-light-mode strong,
.lv-light-mode span,
.lv-light-mode small,
.lv-light-mode label,
.lv-light-mode div {
  color: #13071f !important;
}

.lv-light-mode button {
  color: #13071f !important;
}

.lv-light-mode input {
  color: #13071f !important;
  background: rgba(255,255,255,.78) !important;
}

.lv-light-mode input::placeholder {
  color: rgba(19,7,31,.46) !important;
}

.lv-light-mode [style*="linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)"],
.lv-light-mode [style*="linear-gradient(90deg, #7c3aed, #d946ef, #22d3ee)"],
.lv-light-mode [style*="linear-gradient(135deg,#7c3aed,#d946ef)"],
.lv-light-mode [style*="linear-gradient(90deg,#7c3aed,#d946ef)"] {
  color: #ffffff !important;
}

.lv-light-mode [style*="linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)"] *,
.lv-light-mode [style*="linear-gradient(90deg, #7c3aed, #d946ef, #22d3ee)"] *,
.lv-light-mode [style*="linear-gradient(135deg,#7c3aed,#d946ef)"] *,
.lv-light-mode [style*="linear-gradient(90deg,#7c3aed,#d946ef)"] * {
  color: #ffffff !important;
}

.lv-light-mode .lv-card,
.lv-light-mode .lv-premium-depth,
.lv-light-mode .lv-liquid-card,
.lv-light-mode section,
.lv-light-mode nav {
  border-color: rgba(88,28,135,.18) !important;
}

.lv-light-mode .lv-card,
.lv-light-mode .lv-premium-depth,
.lv-light-mode .lv-liquid-card {
  background: rgba(255,255,255,.82) !important;
  box-shadow: 0 24px 70px rgba(88,28,135,.14), inset 0 1px 0 rgba(255,255,255,.8) !important;
}

.lv-light-mode [style*="background: rgba(255,255,255"],
.lv-light-mode [style*="background: linear-gradient(180deg,rgba(255,255,255"],
.lv-light-mode [style*="background: linear-gradient(135deg,rgba(124,58,237"] {
  background-color: rgba(255,255,255,.78) !important;
  border-color: rgba(88,28,135,.18) !important;
}

.lv-light-mode [style*="rgba(255,255,255"] {
  color: rgba(19,7,31,.78) !important;
}

.lv-light-mode .lv-message[style*="linear-gradient"],
.lv-light-mode .lv-message[style*="linear-gradient"] * {
  color: #ffffff !important;
}

/* Lyvora v3.8.10 - Chat Snapshot + Light Bubble Fix */
.lv-light-mode .lv-bot-message,
.lv-light-mode .lv-system-message {
  background: rgba(255,255,255,.86) !important;
  border: 1px solid rgba(88,28,135,.16) !important;
  color: #13071f !important;
  box-shadow: 0 14px 42px rgba(88,28,135,.10) !important;
}

.lv-light-mode .lv-bot-message *,
.lv-light-mode .lv-system-message * {
  color: #13071f !important;
}

.lv-light-mode .lv-my-message,
.lv-light-mode .lv-my-message * {
  color: #ffffff !important;
}

/* Lyvora v3.8.13 - Footer Visibility Fix */
.lv-legal-footer {
  position: relative;
  z-index: 5;
  max-width: 1120px;
  margin: 90px auto 60px;
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.055);
  backdrop-filter: blur(18px);
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.lv-legal-footer button {
  border: 1px solid rgba(255,255,255,.13);
  background: rgba(255,255,255,.075);
  color: white;
  border-radius: 999px;
  padding: 12px 15px;
  cursor: pointer;
  font-weight: 900;
}

.lv-light-mode .lv-legal-footer {
  background: rgba(255,255,255,.78);
  border-color: rgba(88,28,135,.16);
  box-shadow: 0 18px 55px rgba(88,28,135,.12);
}

.lv-light-mode .lv-legal-footer button {
  color: #13071f !important;
  background: rgba(255,255,255,.72) !important;
  border-color: rgba(88,28,135,.16) !important;
}

@media (max-width: 768px) {
  .lv-legal-footer {
    margin: 70px auto 120px;
  }
}

/* Lyvora v3.8.15 - Landing Micro Spacing Polish */
.lv-dark-mode [style*="grid-template-columns: repeat(3,minmax(0,1fr))"] > div,
.lv-light-mode [style*="grid-template-columns: repeat(3,minmax(0,1fr))"] > div {
  gap: 6px !important;
}

.lv-dark-mode [style*="grid-template-columns: repeat(3,minmax(0,1fr))"] > div span,
.lv-light-mode [style*="grid-template-columns: repeat(3,minmax(0,1fr))"] > div span {
  display: inline-block !important;
  margin-left: 4px !important;
}

@media (max-width: 900px) {
  .lv-dark-mode [style*="grid-template-columns: 1.08fr .92fr"],
  .lv-light-mode [style*="grid-template-columns: 1.08fr .92fr"] {
    grid-template-columns: 1fr !important;
  }
}

/* Lyvora v3.8.17 - Safe Mobile Responsive Fix */
@media (max-width: 760px) {
  .lv-website-nav {
    position: relative !important;
    top: 0 !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 14px !important;
    padding: 8px 0 18px !important;
  }

  .lv-nav-actions {
    width: 100% !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 9px !important;
  }

  .lv-nav-actions button {
    width: 100% !important;
    min-height: 42px !important;
    padding: 10px 11px !important;
    font-size: 12px !important;
    line-height: 1.15 !important;
    white-space: normal !important;
    text-align: center !important;
  }

  .lv-website-hero {
    margin: 26px auto 30px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 24px !important;
    align-items: stretch !important;
  }

  .lv-hero-copy {
    width: 100% !important;
  }

  .lv-hero-title {
    font-size: clamp(44px, 14.5vw, 62px) !important;
    line-height: .94 !important;
    letter-spacing: -2px !important;
  }

  .lv-hero-text {
    max-width: 100% !important;
    font-size: 14px !important;
    line-height: 1.58 !important;
    margin: 18px 0 !important;
  }

  .lv-hero-device {
    top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 18px !important;
    border-radius: 30px !important;
    transform: none !important;
    animation: none !important;
  }

  .lv-website-grid {
    grid-template-columns: 1fr !important;
    margin-top: 22px !important;
  }

  .lv-price-grid {
    grid-template-columns: 1fr !important;
  }

  .lv-auth-shell {
    width: 100% !important;
    max-width: 100% !important;
    margin: 22px auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 14px !important;
  }

  .lv-auth-side,
  .lv-auth-card {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    padding: 22px !important;
    border-radius: 30px !important;
  }

  .lv-auth-title {
    font-size: 34px !important;
    line-height: 1.04 !important;
    letter-spacing: -1px !important;
  }

  .lv-auth-text {
    font-size: 14px !important;
    line-height: 1.55 !important;
  }

  .lv-auth-card input {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .lv-auth-card button {
    max-width: 100% !important;
  }

  .lv-auth-card [style*="grid-template-columns: 1fr 1fr"] {
    grid-template-columns: 1fr 1fr !important;
  }
}

@media (max-width: 420px) {
  .lv-nav-actions {
    grid-template-columns: 1fr !important;
  }

  .lv-hero-title {
    font-size: clamp(40px, 15vw, 54px) !important;
  }

  .lv-auth-side,
  .lv-auth-card {
    padding: 18px !important;
  }

  .lv-auth-title {
    font-size: 30px !important;
  }
}

/* Lyvora v3.8.18 - Profile Crash + Mobile Fix */
@media (max-width: 760px) {
  .lv-profile-panel {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    padding: 18px !important;
  }

  .lv-profile-panel button,
  .lv-profile-panel input {
    max-width: 100% !important;
  }
}

/* Lyvora v3.8.19 - Live Support Widget */
.lv-light-mode [style*="supportPanel"] {
  background: rgba(255,255,255,.92) !important;
}

.lv-light-mode [style*="supportBotBubble"] {
  color: #13071f !important;
  background: rgba(255,255,255,.86) !important;
}

@media (max-width: 520px) {
  [style*="position: fixed"][style*="right: 18px"][style*="bottom: 18px"] {
    right: 12px !important;
    bottom: 12px !important;
  }
}

/* Lyvora v3.8.20 - Real User System Foundation */
.lv-light-mode [style*="rgba(34,197,94,.08)"] {
  background: rgba(240,253,244,.88) !important;
  border-color: rgba(22,163,74,.22) !important;
}

.lv-light-mode [style*="rgba(251,191,36,.10)"] {
  background: rgba(254,249,195,.9) !important;
  border-color: rgba(202,138,4,.24) !important;
  color: #713f12 !important;
}

/* Lyvora v3.8.21 - Moderation Report System */
.lv-light-mode [style*="rgba(239,68,68,.13)"] {
  background: rgba(254,226,226,.9) !important;
  border-color: rgba(220,38,38,.24) !important;
  color: #7f1d1d !important;
}

.lv-light-mode [style*="reportModal"] {
  background: rgba(255,255,255,.94) !important;
}

.lv-light-mode textarea {
  color: #13071f !important;
}

/* Lyvora v3.8.22 - Localized Premium Splash */
@keyframes lvSpin {
  to { transform: rotate(360deg); }
}

@keyframes lvHeartPulse {
  0%,100% { transform: scale(1); opacity: .86; }
  50% { transform: scale(1.16); opacity: 1; }
}

@media (max-width: 620px) {
  [style*="letter-spacing: 18px"] {
    letter-spacing: 10px !important;
    padding-left: 10px !important;
  }

  [style*="grid-template-columns: repeat(4,minmax(0,1fr))"] {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  }

  [style*="padding: 46px 42px 30px"] {
    padding: 32px 20px 24px !important;
    border-radius: 32px !important;
  }
}

`;

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 50% -10%,#312067 0%,#100b24 36%,#050612 100%)", color: "white", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial", padding: "24px 24px 140px" },
  appPage: { minHeight: "100vh", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 50% -10%,#312067 0%,#100b24 36%,#050612 100%)", color: "white", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial", padding: "16px 16px 140px" },

  authGuardBox: {
    border: "1px solid rgba(251,191,36,.28)",
    background: "rgba(251,191,36,.10)",
    color: "#fde68a",
    borderRadius: 18,
    padding: "12px 14px",
    marginBottom: 16,
    fontWeight: 850,
    lineHeight: 1.45
  },
  accountSecurePanel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(34,197,94,.22)",
    background: "rgba(34,197,94,.08)",
    borderRadius: 20,
    padding: "12px 13px",
    margin: "10px 0 12px"
  },
  chatSafetyRow: {
    display: "flex",
    gap: 8,
    margin: "0 0 12px",
    flexWrap: "wrap"
  },
  chatDangerButton: {
    border: "1px solid rgba(239,68,68,.28)",
    background: "rgba(239,68,68,.13)",
    color: "#fecaca",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900
  },
  chatGhostButton: {
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "white",
    borderRadius: 999,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 850
  },
  reportOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.58)",
    display: "grid",
    placeItems: "center",
    zIndex: 99,
    padding: 18
  },
  reportModal: {
    width: "min(430px,100%)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.13)",
    background: "linear-gradient(180deg,rgba(20,12,40,.96),rgba(8,8,18,.96))",
    padding: 24,
    boxShadow: "0 30px 90px rgba(0,0,0,.46)",
    backdropFilter: "blur(24px)"
  },
  reportTitle: {
    color: "white",
    margin: "0 0 8px",
    fontSize: 24,
    letterSpacing: -.5
  },
  reportText: {
    color: "rgba(255,255,255,.66)",
    margin: "0 0 14px",
    lineHeight: 1.5,
    fontSize: 14
  },
  reportInput: {
    width: "100%",
    minHeight: 120,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.07)",
    color: "white",
    padding: 14,
    resize: "none",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit"
  },
  reportActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap"
  },
  supportWrap: {
    position: "fixed",
    right: 18,
    bottom: 18,
    zIndex: 20
  },
  supportFab: {
    width: 58,
    height: 58,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.16)",
    background: "linear-gradient(135deg,#7c3aed,#d946ef,#22d3ee)",
    color: "white",
    cursor: "pointer",
    fontSize: 24,
    fontWeight: 950,
    boxShadow: "0 22px 70px rgba(168,85,247,.42)"
  },
  supportPanel: {
    width: "min(360px,calc(100vw - 32px))",
    maxHeight: "min(620px,calc(100vh - 110px))",
    marginBottom: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "linear-gradient(180deg,rgba(18,12,38,.94),rgba(8,8,18,.92))",
    borderRadius: 30,
    overflow: "hidden",
    backdropFilter: "blur(24px)",
    boxShadow: "0 30px 100px rgba(0,0,0,.45)"
  },
  supportHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,.09)"
  },
  supportAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#7c3aed,#ec4899)",
    fontSize: 22
  },
  supportClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.07)",
    color: "white",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 900
  },
  supportBody: {
    height: 300,
    overflowY: "auto",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  supportBotBubble: {
    maxWidth: "86%",
    alignSelf: "flex-start",
    borderRadius: "18px 18px 18px 6px",
    padding: "11px 13px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.1)",
    color: "white",
    fontSize: 13,
    lineHeight: 1.45
  },
  supportUserBubble: {
    maxWidth: "86%",
    alignSelf: "flex-end",
    borderRadius: "18px 18px 6px 18px",
    padding: "11px 13px",
    background: "linear-gradient(135deg,#7c3aed,#d946ef)",
    color: "white",
    fontSize: 13,
    lineHeight: 1.45
  },
  supportQuickRow: {
    display: "flex",
    gap: 8,
    padding: "0 14px 12px",
    flexWrap: "wrap"
  },
  supportQuickButton: {
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.07)",
    color: "white",
    borderRadius: 999,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 850
  },
  supportInputRow: {
    display: "flex",
    gap: 8,
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,.09)"
  },
  supportInput: {
    flex: 1,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.08)",
    color: "white",
    borderRadius: 999,
    padding: "12px 14px",
    outline: "none"
  },
  supportSend: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg,#7c3aed,#ec4899)",
    color: "white",
    cursor: "pointer",
    fontWeight: 950
  },
  splashPage: { minHeight: "100vh", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", background: "radial-gradient(circle at 10% 0%,rgba(124,58,237,.46),transparent 30%),radial-gradient(circle at 95% 88%,rgba(236,72,153,.38),transparent 28%),linear-gradient(135deg,#070713 0%,#10081f 48%,#071021 100%)", color: "white", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial", padding: 24 },

  splashGrid: {
    position: "absolute",
    inset: 0,
    opacity: .34,
    backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)",
    backgroundSize: "48px 48px",
    pointerEvents: "none"
  },
  splashOrbOne: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    top: -250,
    left: -170,
    background: "radial-gradient(circle,#7c3aed 0%,rgba(124,58,237,.4) 44%,transparent 72%)",
    filter: "blur(2px)",
    opacity: .78,
    pointerEvents: "none"
  },
  splashOrbTwo: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    right: -190,
    bottom: -220,
    background: "radial-gradient(circle,#ec4899 0%,rgba(236,72,153,.34) 46%,transparent 72%)",
    opacity: .64,
    pointerEvents: "none"
  },
  splashPremiumCard: {
    width: "min(760px,calc(100vw - 34px))",
    border: "1px solid rgba(255,255,255,.14)",
    background: "linear-gradient(180deg,rgba(255,255,255,.095),rgba(255,255,255,.035))",
    borderRadius: 40,
    padding: "46px 42px 30px",
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    backdropFilter: "blur(26px)",
    boxShadow: "0 40px 140px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.12)"
  },
  splashLogoMark: {
    display: "grid",
    placeItems: "center",
    marginBottom: 16,
    filter: "drop-shadow(0 0 36px rgba(168,85,247,.48))"
  },
  splashWordmark: {
    letterSpacing: 18,
    paddingLeft: 18,
    fontSize: 19,
    fontWeight: 950,
    color: "rgba(255,255,255,.9)",
    marginBottom: 14
  },
  splashMiniLine: {
    width: 150,
    height: 4,
    margin: "0 auto 28px",
    borderRadius: 999,
    background: "linear-gradient(90deg,transparent,#7c3aed,#ec4899,#22d3ee,transparent)",
    boxShadow: "0 0 26px rgba(217,70,239,.45)"
  },
  splashWelcome: {
    margin: "0 auto 20px",
    maxWidth: 650,
    color: "white",
    fontSize: "clamp(28px,4vw,40px)",
    lineHeight: 1.14,
    letterSpacing: -1,
    fontWeight: 950
  },
  splashSubline: {
    margin: "0 auto",
    maxWidth: 560,
    color: "rgba(255,255,255,.68)",
    lineHeight: 1.65,
    fontSize: 17
  },
  splashHeart: {
    margin: "26px auto 16px",
    fontSize: 34,
    filter: "drop-shadow(0 0 18px rgba(217,70,239,.75))",
    animation: "lvHeartPulse 1.4s ease-in-out infinite"
  },
  splashSpinnerWrap: {
    display: "grid",
    placeItems: "center",
    marginBottom: 14
  },
  splashSpinner: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    border: "6px solid rgba(255,255,255,.09)",
    borderTopColor: "#a855f7",
    borderRightColor: "#d946ef",
    animation: "lvSpin 1s linear infinite",
    boxShadow: "0 0 34px rgba(168,85,247,.35)"
  },
  splashLoadingText: {
    display: "block",
    color: "white",
    fontSize: 22,
    marginBottom: 5
  },
  splashWaitText: {
    display: "block",
    color: "rgba(255,255,255,.58)",
    fontSize: 15
  },
  splashDivider: {
    height: 1,
    width: "100%",
    background: "linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)",
    margin: "30px 0 20px"
  },
  splashBadges: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 10,
    color: "rgba(255,255,255,.76)",
    fontWeight: 850
  },
  splashCopyright: {
    position: "absolute",
    bottom: 24,
    zIndex: 2,
    color: "rgba(255,255,255,.42)",
    fontWeight: 750
  },

  splashCard: { display: "none" },
  splashLogo: { display: "none" },
  splashTitle: { display: "none" },
  splashText: { margin: "10px 0 22px", color: "rgba(255,255,255,.62)", fontWeight: 800 },
  loadingTrack: { width: "100%", height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.1)" },
  loadingFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7c3aed,#ec4899,#22d3ee)", boxShadow: "0 0 28px rgba(217,70,239,.55)", transition: "width .65s ease" },
  bgGlowOne: { position: "fixed", top: -150, left: -120, width: 430, height: 430, borderRadius: "50%", background: "#7c3aed", filter: "blur(125px)", opacity: 0.48, pointerEvents: "none", animation: "lvAuroraShift 8s ease-in-out infinite" },
  bgGlowTwo: { position: "fixed", bottom: -170, right: -130, width: 500, height: 500, borderRadius: "50%", background: "#ec4899", filter: "blur(150px)", opacity: 0.36, pointerEvents: "none", animation: "lvAuroraShift 9s ease-in-out infinite" },
  bgGlowThree: { position: "fixed", top: "34%", right: "18%", width: 260, height: 260, borderRadius: "50%", background: "#22d3ee", filter: "blur(130px)", opacity: 0.16, pointerEvents: "none" },
  bgGrid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.032) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.032) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(circle at center,black,transparent 74%)", pointerEvents: "none" },
  websiteNav: { position: "sticky", top: 14, zIndex: 2, maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 0" },
  navActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  navGhost: { border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.045)", color: "rgba(255,255,255,.76)", borderRadius: 999, padding: "11px 14px", cursor: "pointer", fontWeight: 850, backdropFilter: "blur(16px)" },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 28, background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 0 42px rgba(168,85,247,.45)" },

  lyvoraLogoWrap: {
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,rgba(124,58,237,.22),rgba(236,72,153,.12))",
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 0 42px rgba(168,85,247,.42)",
    overflow: "hidden"
  },

  brandName: { display: "block", fontSize: 27, letterSpacing: -0.8, fontWeight: 950 },
  brandSub: { display: "block", color: "rgba(255,255,255,.56)", fontSize: 12, marginTop: 1 },
  navButton: { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 999, padding: "12px 16px", cursor: "pointer", fontWeight: 900, backdropFilter: "blur(16px)" },
  websiteHero: { position: "relative", zIndex: 2, maxWidth: 1180, margin: "76px auto 48px", display: "grid", gridTemplateColumns: "1.08fr .92fr", gap: 34, alignItems: "center" },
  heroCopy: { minWidth: 0 },
  heroBadge: { display: "inline-flex", padding: "10px 15px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#e9d5ff", marginBottom: 20, fontWeight: 850 },
  heroTitle: { margin: 0, fontSize: "clamp(46px,6.8vw,88px)", lineHeight: 0.98, letterSpacing: -3.2, fontWeight: 950 },
  gradientText: { background: "linear-gradient(90deg,#c4b5fd,#f472b6,#22d3ee)", WebkitBackgroundClip: "text", color: "transparent" },
  heroText: { maxWidth: 720, margin: "24px 0", color: "rgba(255,255,255,.72)", fontSize: 18, lineHeight: 1.75 },
  heroActions: { display: "flex", gap: 12, flexWrap: "wrap" },
  primaryButton: { border: "none", borderRadius: 20, padding: "16px 22px", background: "linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)", color: "white", fontWeight: 950, cursor: "pointer", boxShadow: "0 18px 60px rgba(168,85,247,.35)" },
  secondaryButton: { border: "1px solid rgba(255,255,255,.14)", borderRadius: 20, padding: "16px 22px", background: "rgba(255,255,255,.07)", color: "white", fontWeight: 900, cursor: "pointer" },
  heroStats: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, maxWidth: 520, marginTop: 28 },
  heroDevice: { position: "relative", top: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,.14)", background: "linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.045))", borderRadius: 42, padding: 24, backdropFilter: "blur(26px)", boxShadow: "0 34px 120px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)" },
  deviceTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  devicePill: { padding: "8px 12px", borderRadius: 999, background: "rgba(34,197,94,.15)", color: "#86efac", border: "1px solid rgba(34,197,94,.25)", fontWeight: 900, fontSize: 12 },
  deviceMood: { display: "inline-flex", padding: "10px 14px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 18, fontWeight: 850 },
  previewBubble: { width: "fit-content", maxWidth: "82%", borderRadius: 22, padding: "13px 15px", background: "linear-gradient(135deg,#7c3aed,#d946ef)", boxShadow: "0 14px 35px rgba(168,85,247,.24)", marginBottom: 12 },
  previewInput: { marginTop: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.52)", borderRadius: 999, padding: "14px 16px", display: "flex", justifyContent: "space-between" },
  websiteGrid: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "34px auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 },
  featureCard: { border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.045))", borderRadius: 30, padding: 26, backdropFilter: "blur(28px)", boxShadow: "0 20px 70px rgba(0,0,0,.25)" },
  featureIcon: { width: 60, height: 60, borderRadius: 21, display: "grid", placeItems: "center", fontSize: 30, background: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  siteCTA: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "22px auto 68px", border: "1px solid rgba(251,191,36,.28)", background: "linear-gradient(135deg,rgba(124,58,237,.22),rgba(236,72,153,.15))", borderRadius: 32, padding: 28, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", boxShadow: "0 24px 80px rgba(0,0,0,.26)" },
  goldBadge: { display: "inline-flex", color: "#facc15", marginBottom: 8, fontWeight: 950 },
  panelTitle: { margin: "4px 0", fontSize: 32, letterSpacing: -1 },
  panelText: { color: "rgba(255,255,255,.66)", margin: 0, lineHeight: 1.5 },

  legalShell: {
    position: "relative",
    zIndex: 2,
    maxWidth: 900,
    margin: "72px auto",
    border: "1px solid rgba(255,255,255,.13)",
    background: "linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.045))",
    borderRadius: 34,
    padding: 34,
    backdropFilter: "blur(24px)",
    boxShadow: "0 30px 100px rgba(0,0,0,.38)"
  },
  legalBadge: {
    display: "inline-flex",
    marginTop: 28,
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    color: "#e9d5ff",
    fontWeight: 900
  },
  legalTitle: {
    margin: "18px 0 16px",
    fontSize: 42,
    letterSpacing: -1.4,
    color: "white"
  },
  legalTextBox: {
    display: "grid",
    gap: 12,
    marginBottom: 26
  },
  legalText: {
    color: "rgba(255,255,255,.72)",
    lineHeight: 1.8,
    fontSize: 16,
    margin: 0
  },

  authShell: { position: "relative", zIndex: 2, maxWidth: 1040, margin: "58px auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "stretch" },
  authSide: { border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(180deg,rgba(255,255,255,.095),rgba(255,255,255,.04))", borderRadius: 36, padding: 30, backdropFilter: "blur(22px)", display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: "0 30px 100px rgba(0,0,0,.38)" },
  authCard: { border: "1px solid rgba(255,255,255,.13)", background: "rgba(15,15,30,.74)", borderRadius: 36, padding: 30, backdropFilter: "blur(24px)", boxShadow: "0 30px 100px rgba(0,0,0,.42)" },
  bigLogo: { width: 88, height: 88, borderRadius: 30, display: "grid", placeItems: "center", marginBottom: 22, fontSize: 48, background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 0 55px rgba(168,85,247,.45)" },
  authTitle: { margin: "0 0 10px", fontSize: 42, letterSpacing: -1.4 },
  authText: { margin: "0 0 22px", color: "rgba(255,255,255,.66)", lineHeight: 1.65 },
  authMiniGrid: { display: "grid", gap: 10 },
  authSwitch: { display: "grid", gridTemplateColumns: "1fr 1fr", padding: 6, borderRadius: 20, background: "rgba(255,255,255,.07)", marginBottom: 20 },
  authSwitchButton: { border: "none", borderRadius: 15, background: "transparent", color: "white", padding: 14, cursor: "pointer", fontWeight: 900 },
  authSwitchActive: { border: "none", borderRadius: 15, background: "linear-gradient(90deg,#7c3aed,#d946ef)", color: "white", padding: 14, cursor: "pointer", fontWeight: 950 },
  label: { display: "block", margin: "14px 0 8px", fontWeight: 900 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.07)", color: "white", borderRadius: 18, padding: 15, outline: "none", fontSize: 15 },
  avatarGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 },
  avatarButton: { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.07)", color: "white", borderRadius: 18, padding: 12, cursor: "pointer", fontSize: 24 },
  avatarActive: { border: "1px solid #d946ef", background: "rgba(168,85,247,.25)", color: "white", borderRadius: 18, padding: 12, cursor: "pointer", fontSize: 24, boxShadow: "0 0 25px rgba(217,70,239,.25)" },
  notice: { marginTop: 14, padding: 12, borderRadius: 16, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.14)" },
  primaryFull: { width: "100%", border: "none", borderRadius: 20, padding: 16, marginTop: 18, background: "linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)", color: "white", cursor: "pointer", fontWeight: 950, boxShadow: "0 18px 55px rgba(168,85,247,.28)" },
  ghostButton: { width: "100%", border: "none", background: "transparent", color: "rgba(255,255,255,.65)", padding: 12, marginTop: 6, cursor: "pointer" },
  phoneShell: { position: "relative", zIndex: 2, maxWidth: 570, minHeight: "calc(100vh - 32px)", margin: "0 auto", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(180deg,rgba(255,255,255,.105),rgba(255,255,255,.04))", borderRadius: 38, padding: 22, backdropFilter: "blur(26px)", boxShadow: "0 30px 110px rgba(0,0,0,.50), inset 0 1px 0 rgba(255,255,255,.08)" },
  appHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  toast: { marginBottom: 14, animation: "lvToastSlide .45s cubic-bezier(.2,.8,.2,1) both", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(135deg,rgba(124,58,237,.22),rgba(236,72,153,.16))", color: "white", borderRadius: 20, padding: "12px 14px", fontWeight: 900, cursor: "pointer", boxShadow: "0 14px 40px rgba(168,85,247,.18)" },
  statusPill: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.22)", color: "#4ade80", fontWeight: 900, marginBottom: 22 },
  onlineDot: { width: 10, height: 10, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 18px rgba(34,197,94,.75)" },
  homeHero: { marginBottom: 22 },
  homeTitle: { fontSize: "clamp(42px,8vw,60px)", lineHeight: 0.98, letterSpacing: -2.2, margin: "0 0 14px", fontWeight: 950 },
  homeText: { color: "rgba(255,255,255,.68)", margin: 0, fontSize: 16, lineHeight: 1.55 },
  storyRow: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, marginBottom: 16 },
  story: { minWidth: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 25, background: "linear-gradient(135deg,#7c3aed,#ec4899)", border: "2px solid rgba(255,255,255,.18)", boxShadow: "0 12px 30px rgba(168,85,247,.23)" ,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,.14)"
  },
  storyAdd: { minWidth: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 30, background: "rgba(255,255,255,.06)", border: "2px dashed rgba(168,85,247,.5)", color: "#c084fc" ,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,.14)"
  },
  moodGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 13 },
  moodCard: {
  position: "relative",
  overflow: "hidden",
  minHeight: 170,
  borderRadius: 30,
  padding: "22px 20px",
  border: "1px solid rgba(255,255,255,.14)",
  background:
    "linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.035))",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  cursor: "pointer",
  transition: "transform .25s ease, box-shadow .25s ease, border-color .25s ease",
  boxShadow:
    "0 40px 110px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.09)"
},
  moodIcon: {
  width: 62,
  height: 62,
  borderRadius: 22,
  display: "grid",
  placeItems: "center",
  fontSize: 34,
  fontWeight: 950,
  color: "#ffffff",
  background:
    "radial-gradient(circle at 30% 18%, rgba(255,255,255,.22), rgba(168,85,247,.18) 35%, rgba(34,211,238,.12) 100%)",
  border: "1px solid rgba(255,255,255,.14)",
  textShadow: "0 0 18px rgba(168,85,247,.85)",
  boxShadow:
    "0 12px 34px rgba(0,0,0,.28), 0 0 24px rgba(168,85,247,.22), inset 0 1px 0 rgba(255,255,255,.12)"
},
  emptyTab: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", borderRadius: 28, padding: 22, textAlign: "center" },
  emptyIcon: { width: 74, height: 74, borderRadius: 28, display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 36, background: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  bottomPanel: { marginTop: 18, border: "1px solid rgba(251,191,36,.32)", background: "linear-gradient(135deg,rgba(124,58,237,.2),rgba(236,72,153,.14))", borderRadius: 30, padding: 18, display: "flex", flexDirection: "column", gap: 8 },
  chatHeader: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,.1)" },
  roundButton: { width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.08)", color: "white", cursor: "pointer", fontSize: 26 },
  matchAvatar: { width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 27, background: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  chatTitle: { margin: 0, fontSize: 22, letterSpacing: -0.4 },
  chatSub: { margin: "4px 0 0", color: "#86efac", fontSize: 13 },
  endButton: { border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.15)", color: "#fecaca", borderRadius: 999, padding: "10px 12px", cursor: "pointer", fontWeight: 900 },
  chatInfo: { margin: "18px 0", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", borderRadius: 28, padding: 16, display: "flex", flexDirection: "column", gap: 6 },
  messages: { height: "calc(100vh - 330px)", minHeight: 330, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 },
  message: { maxWidth: "82%", borderRadius: 22, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.45 },
  myMessage: { alignSelf: "flex-end", background: "linear-gradient(135deg,#7c3aed,#d946ef)", boxShadow: "0 14px 35px rgba(168,85,247,.24)" },
  botMessage: { alignSelf: "flex-start", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.1)" },
  systemMessage: { alignSelf: "center", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.2)", color: "#bbf7d0", textAlign: "center", maxWidth: "92%" },
  time: { opacity: 0.58, fontSize: 11 },
  typingText: { color: "rgba(255,255,255,.66)", fontSize: 13, marginBottom: 0, whiteSpace: "nowrap" },
  quickReplies: { display: "flex", gap: 8, overflowX: "auto", padding: "12px 0" },
  quickButton: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 999, padding: "9px 12px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 800 },
  inputArea: { display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14 },
  messageInput: { flex: 1, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.07)", color: "white", borderRadius: 999, padding: "13px 15px", outline: "none", fontSize: 15 },
  bottomNav: { position: "sticky", bottom: 8, marginTop: 14, border: "1px solid rgba(255,255,255,.16)", background: "linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07))", borderRadius: 30, padding: 8, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, backdropFilter: "blur(28px)", boxShadow: "0 22px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.12)", overflow: "hidden" },
  navItem: { border: "none", background: "transparent", color: "rgba(255,255,255,.58)", borderRadius: 19, padding: "10px 6px", cursor: "pointer", fontWeight: 900, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  navItemActive: { border: "1px solid rgba(217,70,239,.35)", background: "linear-gradient(135deg,rgba(124,58,237,.34),rgba(236,72,153,.22))", color: "white", borderRadius: 19, padding: "10px 6px", cursor: "pointer", fontWeight: 950, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, boxShadow: "0 12px 35px rgba(168,85,247,.18)" },
  matchScreen: { position: "relative", zIndex: 2, maxWidth: 560, minHeight: "calc(100vh - 32px)", margin: "0 auto", border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(180deg,rgba(124,58,237,.22),rgba(236,72,153,.10))", borderRadius: 38, padding: 28, backdropFilter: "blur(24px)", boxShadow: "0 30px 100px rgba(0,0,0,.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden" },
  matchOrb: { width: 116, height: 116, borderRadius: 36, display: "grid", placeItems: "center", fontSize: 62, background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 0 70px rgba(217,70,239,.45)", marginBottom: 24 },
  matchTitle: { margin: 0, fontSize: 38, letterSpacing: -1.2 },
  matchText: { margin: "12px 0 26px", color: "rgba(255,255,255,.72)", fontWeight: 800 },
  matchRings: { display: "flex", alignItems: "center", gap: 12, marginBottom: 26 },
  matchUser: { width: 62, height: 62, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 30, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.15)", boxShadow: "0 0 35px rgba(168,85,247,.22)" },
  matchLine: { width: 90, height: 4, borderRadius: 999, background: "linear-gradient(90deg,#7c3aed,#22d3ee,#ec4899)" },
  loadingBar: { width: "82%", height: 12, borderRadius: 999, background: "rgba(255,255,255,.12)", overflow: "hidden", marginBottom: 22, border: "1px solid rgba(255,255,255,.12)" },
  profilePanel: { marginTop: 4, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(135deg,rgba(124,58,237,.18),rgba(236,72,153,.12))", borderRadius: 28, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.22)" },
  profileTop: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16 },
  profileAvatar: { width: 76, height: 76, borderRadius: 30, display: "grid", placeItems: "center", fontSize: 39, background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 0 40px rgba(217,70,239,.28)" },
  profileName: { margin: 0, fontSize: 27, letterSpacing: -0.8 },
  profileMail: { margin: "4px 0 0", color: "rgba(255,255,255,.62)", fontSize: 13 },
  profileStats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 },
  profileStat: { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.07)", borderRadius: 20, padding: 12, display: "flex", flexDirection: "column", gap: 4, textAlign: "center" },
  profileBox: { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.07)", borderRadius: 22, padding: 14, display: "flex", flexDirection: "column", gap: 6, color: "rgba(255,255,255,.72)" },

  websiteShowcase: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "24px auto 34px", display: "grid", gap: 24 },
  showcaseHeader: { maxWidth: 720 },
  showcaseGrid: { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 20, alignItems: "center" },
  showcasePhone: { border: "1px solid rgba(255,255,255,.14)", background: "linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045))", borderRadius: 38, padding: 24, minHeight: 420, backdropFilter: "blur(24px)", boxShadow: "0 28px 90px rgba(0,0,0,.28)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 },
  showcaseTop: { color: "rgba(255,255,255,.58)", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2 },
  showcaseChatOne: { alignSelf: "flex-start", maxWidth: "82%", borderRadius: 22, padding: "13px 15px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" },
  showcaseChatTwo: { alignSelf: "flex-end", maxWidth: "82%", borderRadius: 22, padding: "13px 15px", background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 16px 40px rgba(168,85,247,.24)" },
  showcaseBottom: { color: "rgba(255,255,255,.52)", fontSize: 13, marginTop: 8 },
  showcaseContent: { display: "grid", gap: 16 },
  howGrid: { display: "grid", gap: 14 },
  howCard: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", borderRadius: 30, padding: 18, display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 18px 50px rgba(0,0,0,.16)" },
  testimonialSection: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "0 auto 32px" },
  testimonialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 14 },
  testimonialCard: { border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045))", borderRadius: 28, padding: 20, display: "flex", flexDirection: "column", gap: 10, backdropFilter: "blur(28px)" },
  testimonialAvatar: { width: 54, height: 54, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#7c3aed,#ec4899)", fontWeight: 950, fontSize: 20 },
  testimonialText: { color: "rgba(255,255,255,.72)", lineHeight: 1.7, margin: 0 },
  faqSection: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "0 auto 32px" },
  faqList: { display: "grid", gap: 12, marginTop: 14 },
  faqItem: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "white", borderRadius: 28, padding: 18, textAlign: "left", cursor: "pointer" },
  faqItemActive: { border: "1px solid rgba(217,70,239,.42)", background: "linear-gradient(135deg,rgba(124,58,237,.24),rgba(236,72,153,.12))", color: "white", borderRadius: 28, padding: 18, textAlign: "left", cursor: "pointer", boxShadow: "0 20px 60px rgba(168,85,247,.18)" },
  faqTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  faqText: { margin: "12px 0 0", color: "rgba(255,255,255,.72)", lineHeight: 1.7 },
  massiveCTA: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "0 auto 64px", border: "1px solid rgba(255,255,255,.14)", background: "linear-gradient(135deg,rgba(124,58,237,.26),rgba(236,72,153,.18))", borderRadius: 38, padding: 34, textAlign: "center", boxShadow: "0 30px 120px rgba(0,0,0,.32)" },
  massiveTitle: { margin: "12px 0 8px", fontSize: "clamp(42px,6vw,72px)", lineHeight: .98, letterSpacing: -2.6, fontWeight: 950 },
  massiveText: { maxWidth: 720, margin: "0 auto 24px", color: "rgba(255,255,255,.72)", lineHeight: 1.8 },
  pricingPanel: { position: "relative", zIndex: 2, maxWidth: 1120, margin: "18px auto", border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(135deg,rgba(124,58,237,.16),rgba(236,72,153,.11))", borderRadius: 30, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.22)" },
  pricingTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  priceBadge: { display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(251,191,36,.14)", border: "1px solid rgba(251,191,36,.28)", color: "#fde68a", fontWeight: 950, fontSize: 12 },
  priceTitle: { margin: 0, fontSize: 24, letterSpacing: -0.8 },
  priceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 },
  priceCard: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", borderRadius: 28, padding: 14, display: "flex", flexDirection: "column", gap: 8 },
  priceCardHot: { border: "1px solid rgba(217,70,239,.55)", background: "linear-gradient(135deg,rgba(124,58,237,.32),rgba(236,72,153,.24))", borderRadius: 28, padding: 14, display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 0 35px rgba(217,70,239,.22)" },
  planTag: { color: "#f0abfc", fontSize: 11, fontWeight: 950 },
  planName: { margin: 0, fontSize: 18 },
  planPrice: { fontSize: 24, fontWeight: 950, letterSpacing: -0.6 },
  planPeriod: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,.62)",
    marginLeft: 6
  },
  planBillingNote: {
    margin: "6px 0 12px",
    color: "rgba(255,255,255,.62)",
    fontSize: 12,
    fontWeight: 850
  },
  planFeatures: { display: "flex", flexDirection: "column", gap: 5, color: "rgba(255,255,255,.68)", fontSize: 12, lineHeight: 1.25 },
  planButton: { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 16, padding: "10px 12px", cursor: "pointer", fontWeight: 900, marginTop: 4 },
  planButtonHot: { border: "none", background: "linear-gradient(135deg,#7c3aed,#d946ef)", color: "white", borderRadius: 16, padding: "10px 12px", cursor: "pointer", fontWeight: 950, marginTop: 4, boxShadow: "0 12px 30px rgba(168,85,247,.28)" },

  pageLight: { minHeight: "100vh", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 9% 0%,rgba(168,85,247,.34),transparent 28%),radial-gradient(circle at 87% 72%,rgba(34,211,238,.28),transparent 34%),linear-gradient(180deg,#fbf7ff 0%,#f3ebff 44%,#eaf8ff 100%)", color: "#13071f", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial", padding: 24 },
  appPageLight: { minHeight: "100vh", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 9% 0%,rgba(168,85,247,.34),transparent 28%),radial-gradient(circle at 87% 72%,rgba(34,211,238,.28),transparent 34%),linear-gradient(180deg,#fbf7ff 0%,#f3ebff 44%,#eaf8ff 100%)", color: "#13071f", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial", padding: 16 },
  bgGlowLightOne: { position: "fixed", top: -190, left: -150, width: 470, height: 470, borderRadius: "50%", background: "#c084fc", filter: "blur(105px)", opacity: 0.42, pointerEvents: "none", animation: "lvAuroraShift 10s ease-in-out infinite" },
  bgGlowLightTwo: { position: "fixed", bottom: -180, right: -140, width: 540, height: 540, borderRadius: "50%", background: "#22d3ee", filter: "blur(125px)", opacity: 0.34, pointerEvents: "none", animation: "lvAuroraShift 11s ease-in-out infinite" },
  themeToggle: { position: "fixed", top: 22, right: 22, zIndex: 10, width: 54, height: 54, borderRadius: "50%", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.12)", color: "white", cursor: "pointer", fontSize: 22, backdropFilter: "blur(28px)", boxShadow: "0 18px 55px rgba(0,0,0,.22)" },
  themeMiniButton: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.075)", color: "white", borderRadius: 999, padding: "11px 14px", cursor: "pointer", fontWeight: 900, backdropFilter: "blur(16px)" },
  onboardShell: {
  position: "relative",
  overflow: "hidden",
 position: "relative", zIndex: 2, maxWidth: 1100, minHeight: "calc(100vh - 48px)", margin: "0 auto", display: "grid", gridTemplateColumns: "0.88fr 1.12fr", gap: 30, alignItems: "center" },
  onboardPhone: {
  position: "relative",
  overflow: "hidden",
 position: "relative", minHeight: 560, border: "1px solid rgba(255,255,255,.16)", background: "linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.055))", borderRadius: 46, padding: 26, backdropFilter: "blur(28px)", boxShadow: "0 34px 130px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.12)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 },
  onboardTopLine: { position: "absolute", top: 24, left: 24, right: 24, display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.68)", fontWeight: 900, fontSize: 13 },
  liveTinyDot: { width: 10, height: 10, borderRadius: 99, background: "#22c55e", display: "inline-block", animation: "lvOnlinePulse 1.6s ease-in-out infinite" },
  onboardOrb: { width: 142, height: 142, borderRadius: 44, display: "grid", placeItems: "center", margin: "0 auto 6px", fontSize: 72, background: "linear-gradient(135deg,#7c3aed,#ec4899,#22d3ee)", boxShadow: "0 0 90px rgba(217,70,239,.48)" },
  onboardMiniCard: {
  position: "relative",
 border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.08)", borderRadius: 28, padding: 18, display: "flex", flexDirection: "column", gap: 8, color: "rgba(255,255,255,.72)", lineHeight: 1.55 },
  onboardMessageOne: { alignSelf: "flex-start", maxWidth: "82%", borderRadius: 22, padding: "13px 15px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.78)" },
  onboardMessageTwo: { alignSelf: "flex-end", maxWidth: "82%", borderRadius: 22, padding: "13px 15px", background: "linear-gradient(135deg,#7c3aed,#d946ef)", color: "white", boxShadow: "0 14px 35px rgba(168,85,247,.24)" },
  onboardCopy: { minWidth: 0 },
  onboardTitle: {
  letterSpacing: "-1.2px",
 margin: 0, fontSize: "clamp(48px,7vw,82px)", lineHeight: .96, letterSpacing: -3, fontWeight: 950 },
  onboardText: {
  lineHeight: 1.7,
 maxWidth: 620, margin: "22px 0 26px", color: "rgba(255,255,255,.72)", fontSize: 18, lineHeight: 1.75 },
  onboardDots: { display: "flex", gap: 10, marginBottom: 26 },
  onboardDot: { width: 13, height: 13, borderRadius: 99, border: "none", background: "rgba(255,255,255,.26)", cursor: "pointer" },
  onboardDotActive: { width: 42, height: 13, borderRadius: 99, border: "none", background: "linear-gradient(90deg,#7c3aed,#ec4899,#22d3ee)", cursor: "pointer", boxShadow: "0 0 24px rgba(217,70,239,.38)" },

  cinematicHeroCard: { position: "relative", border: "1px solid rgba(255,255,255,.14)", background: "linear-gradient(135deg,rgba(255,255,255,.115),rgba(255,255,255,.045))", borderRadius: 34, padding: 20, marginBottom: 18, boxShadow: "0 28px 90px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.12)", backdropFilter: "blur(24px)" },
  heroTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 },
  heroLiveChip: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(34,197,94,.24)", background: "rgba(34,197,94,.12)", color: "#bbf7d0", borderRadius: 999, padding: "8px 12px", fontWeight: 950, fontSize: 12 },
  polishNotes: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 },
  appStoreStrip: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 },
  navGlowOrb: { position: "absolute", left: "50%", top: -16, width: 84, height: 18, transform: "translateX(-50%)", borderRadius: "50%", background: "rgba(217,70,239,.42)", filter: "blur(16px)", pointerEvents: "none" },
  newMatchModal: { position: "absolute", top: 94, left: 18, right: 18, zIndex: 20, border: "1px solid rgba(255,255,255,.16)", background: "linear-gradient(135deg,rgba(124,58,237,.92),rgba(236,72,153,.82))", borderRadius: 28, padding: 18, display: "grid", gridTemplateColumns: "54px 1fr auto", alignItems: "center", gap: 12, boxShadow: "0 24px 80px rgba(0,0,0,.38)", backdropFilter: "blur(24px)" },
  newMatchOrb: { width: 54, height: 54, borderRadius: 20, display: "grid", placeItems: "center", fontSize: 28, background: "rgba(255,255,255,.18)" },
  modalButton: { border: "none", borderRadius: 999, padding: "10px 12px", background: "white", color: "#7c3aed", fontWeight: 950, cursor: "pointer" },
  discoverStrip: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, marginBottom: 16 },
  discoverCard: { minWidth: 170, border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.045))", color: "white", borderRadius: 28, padding: 14, display: "flex", flexDirection: "column", gap: 6, textAlign: "left", cursor: "pointer", animation: "lvCardSwipe .5s ease both", boxShadow: "0 18px 55px rgba(0,0,0,.18)" },
  activityFeedPanel: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.07)", borderRadius: 30, padding: 14, marginBottom: 16, display: "grid", gap: 10, backdropFilter: "blur(28px)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(255,255,255,.72)", marginBottom: 2 },
  activityItem: { display: "grid", gridTemplateColumns: "42px 1fr auto", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.045)", borderRadius: 18, padding: 10 },
  activityIcon: { width: 42, height: 42, borderRadius: 16, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  settingsGlassPanel: { marginTop: 14, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", borderRadius: 22, padding: 14, display: "flex", flexDirection: "column", gap: 6, color: "rgba(255,255,255,.68)" },

  installBanner: { width: "100%", border: "1px solid rgba(34,211,238,.24)", background: "linear-gradient(90deg,rgba(124,58,237,.2),rgba(34,211,238,.14))", color: "white", borderRadius: 22, padding: "13px 14px", cursor: "pointer", fontWeight: 950, margin: "10px 0 12px", boxShadow: "0 16px 45px rgba(34,211,238,.12)" },
  firebaseCorePanel: { marginBottom: 14, border: "1px solid rgba(34,197,94,.24)", background: "linear-gradient(135deg,rgba(34,197,94,.13),rgba(34,211,238,.08))", borderRadius: 22, padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, color: "#bbf7d0", fontSize: 12, fontWeight: 900 },
  musicWidget: { marginBottom: 16, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(135deg,rgba(124,58,237,.24),rgba(236,72,153,.14))", borderRadius: 28, padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 20px 60px rgba(168,85,247,.18)", animation: "lvGlowBorder 4s ease-in-out infinite" },
  musicDisc: { width: 54, height: 54, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 24, background: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  musicBars: { marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 4 },
  verifiedBadge: { display: "inline-flex", width: 24, height: 24, borderRadius: "50%", alignItems: "center", justifyContent: "center", background: "#3b82f6", color: "white", fontSize: 12, marginLeft: 8, verticalAlign: "middle" },
  levelCard: { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.07)", borderRadius: 22, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  levelXP: { borderRadius: 999, padding: "8px 12px", background: "linear-gradient(135deg,#7c3aed,#ec4899)", fontWeight: 950, boxShadow: "0 12px 30px rgba(168,85,247,.25)" },
  levelTrack: { width: "100%", height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.08)", marginBottom: 16 },
  levelFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7c3aed,#ec4899,#22d3ee)" },
  typingTopBar: { marginBottom: 10, color: "#c4b5fd", fontSize: 11, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase" },
  matchAlgorithmCard: { width: "82%", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.075)", borderRadius: 28, padding: 14, display: "grid", gap: 10, marginBottom: 20, backdropFilter: "blur(28px)" },
  matchMetricRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, color: "rgba(255,255,255,.78)", fontWeight: 850 },
  chatPresenceStrip: { margin: "-4px 0 14px", border: "1px solid rgba(34,197,94,.22)", background: "rgba(34,197,94,.10)", color: "#bbf7d0", borderRadius: 999, padding: "10px 13px", display: "flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 900 },
  sendButton: { width: 44, height: 44, border: "none", background: "linear-gradient(135deg,#7c3aed,#d946ef)", color: "white", borderRadius: 16, cursor: "pointer", fontWeight: 900, fontSize: 17 }
};
