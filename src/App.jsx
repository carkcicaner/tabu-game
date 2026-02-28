import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { Play, X, AlertCircle, RefreshCw, Trophy, Crown, ArrowRight, Smartphone, Volume2, VolumeX } from 'lucide-react';

// --- CONFIG & FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAjHPYvgX54Hsyp5CpHsBacFxqCJF8JT5M",
  authDomain: "tabu-game-ceb7f.firebaseapp.com",
  projectId: "tabu-game-ceb7f",
  storageBucket: "tabu-game-ceb7f.firebasestorage.app",
  messagingSenderId: "184739511103",
  appId: "1:184739511103:web:e5339c1e9c7293cbeab18a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'tabu-pro-v1'; // Veritabanı ana klasör adımız

// --- AUDIO SYSTEM (Web Audio API) ---
let audioCtx = null;
let isMutedGlobal = false; // Global mute state

const playSound = (type) => {
  if (isMutedGlobal) return; // Mute kontrolü
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    
    if (type === 'tick') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      gain.gain.setValueAtTime(0.8, now); 
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2); gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(140, now + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      gain2.gain.setValueAtTime(0.6, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.start(now + 0.2); osc2.stop(now + 0.35);

    } else if (type === 'correct') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);

    } else if (type === 'taboo') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
      gain.gain.setValueAtTime(1.0, now); 
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);

    } else if (type === 'pass') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);

    } else if (type === 'alarm') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.15);
      osc.frequency.setValueAtTime(600, now + 0.3);
      osc.frequency.setValueAtTime(900, now + 0.45);
      osc.frequency.setValueAtTime(600, now + 0.6);
      gain.gain.setValueAtTime(0.8, now); 
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.start(now); osc.stop(now + 1.0);
    }
  } catch (e) {
    console.error("Audio playback error:", e);
  }
};

// --- GAME DATA (Devasa Kelime Havuzu 200+) ---
const WORD_DATABASE = [
  // TÜRKÇE (TR)
  { word: "ASTRONOT", forbidden: ["UZAY", "YILDIZ", "GEZEGEN", "MEKİK", "AY"], category: "Meslek", lang: "tr" },
  { word: "KLAVYE", forbidden: ["BİLGİSAYAR", "TUŞ", "YAZI", "MOUSE", "HARF"], category: "Teknoloji", lang: "tr" },
  { word: "ŞEMSİYE", forbidden: ["YAĞMUR", "ISLANMAK", "GÜNEŞ", "AÇMAK", "TUTMAK"], category: "Eşya", lang: "tr" },
  { word: "MÜZE", forbidden: ["TARİH", "ESER", "GEZMEK", "TABLO", "HEYKEL"], category: "Mekan", lang: "tr" },
  { word: "VAMPİR", forbidden: ["KAN", "DİŞ", "SARIMSAK", "YARASA", "DRACULA"], category: "Karakter", lang: "tr" },
  { word: "PİLOT", forbidden: ["UÇAK", "UÇMAK", "HAVAALANI", "KAPTAN", "GÖKYÜZÜ"], category: "Meslek", lang: "tr" },
  { word: "BASKETBOL", forbidden: ["TOP", "POTA", "SMAÇ", "SAHA", "OYUN"], category: "Spor", lang: "tr" },
  { word: "FOTOĞRAF", forbidden: ["KAMERA", "ÇEKMEK", "RESİM", "POZ", "ALBÜM"], category: "Eşya", lang: "tr" },
  { word: "DİNOZOR", forbidden: ["NESİL", "T-REX", "FOSİL", "TARİH ÖNCESİ", "JURASSIC"], category: "Hayvan", lang: "tr" },
  { word: "ORKESTRA", forbidden: ["MÜZİK", "ŞEF", "KONSER", "ENSTRÜMAN", "KLASİK"], category: "Sanat", lang: "tr" },
  { word: "KARANFİL", forbidden: ["ÇİÇEK", "KIRMIZI", "KOKU", "BAHARAT", "ÇAY"], category: "Bitki", lang: "tr" },
  { word: "DENİZALTI", forbidden: ["SU", "GEMİ", "OKYANUS", "BATMAK", "DALMAK"], category: "Araç", lang: "tr" },
  { word: "ŞELALE", forbidden: ["SU", "AKMAK", "NEHİR", "YÜKSEK", "DOĞA"], category: "Doğa", lang: "tr" },
  { word: "MİKROSKOP", forbidden: ["BÜYÜTEÇ", "LABORATUVAR", "BİLİM", "HÜCRE", "GÖRMEK"], category: "Bilim", lang: "tr" },
  { word: "CÜZDAN", forbidden: ["PARA", "KART", "CEP", "ÇANTA", "DERİ"], category: "Eşya", lang: "tr" },
  { word: "HAPŞIRMAK", forbidden: ["BURUN", "NEZLE", "HASTA", "ÇOK YAŞA", "MENDİL"], category: "Eylem", lang: "tr" },
  { word: "PİRAMİT", forbidden: ["MISIR", "FİRAVUN", "ÇÖL", "ÜÇGEN", "MEZAR"], category: "Tarih", lang: "tr" },
  { word: "TELESKOP", forbidden: ["YILDIZ", "UZAY", "GÖKYÜZÜ", "BAKMAK", "GEZEGEN"], category: "Bilim", lang: "tr" },
  { word: "VOLKAN", forbidden: ["LAV", "DAĞ", "PATLAMAK", "ATEŞ", "MAGMA"], category: "Doğa", lang: "tr" },
  { word: "YELKOVAN", forbidden: ["SAAT", "AKREP", "DAKİKA", "ZAMAN", "İBRET"], category: "Zaman", lang: "tr" },
  { word: "KAHVE", forbidden: ["KAFEİN", "SİCAK", "İÇECEK", "SABAH", "TÜRK"], category: "Yiyecek", lang: "tr" },
  { word: "BİSİKLET", forbidden: ["PEDAL", "İKİ TEKERLEK", "SÜRMEK", "ZİNCİR", "SPOR"], category: "Araç", lang: "tr" },
  { word: "GÖZLÜK", forbidden: ["GÖRMEK", "GÖZ", "CAM", "ÇERÇEVE", "MİYOP"], category: "Aksesuar", lang: "tr" },
  { word: "KÜTÜPHANE", forbidden: ["KİTAP", "OKUMAK", "SESSİZ", "RAF", "ÖDÜNÇ"], category: "Mekan", lang: "tr" },
  { word: "TRAFİK", forbidden: ["ARABA", "YOL", "KIRMIZI IŞIK", "SIKIŞIK", "KORNA"], category: "Günlük", lang: "tr" },
  { word: "KAMP", forbidden: ["ÇADIR", "DOĞA", "ATEŞ", "ORMAN", "UYKU TULUMU"], category: "Aktivite", lang: "tr" },
  { word: "SİNEMA", forbidden: ["FİLM", "PATLAMAMIŞ MISIR", "PERDE", "İZLEMEK", "BİLET"], category: "Eğlence", lang: "tr" },
  { word: "DOKTOR", forbidden: ["HASTANE", "HASTA", "İLAÇ", "REÇETE", "STETOSKOP"], category: "Meslek", lang: "tr" },
  { word: "GİTAR", forbidden: ["TEL", "MÜZİK", "ÇALMAK", "AKUSTİK", "KONSER"], category: "Enstrüman", lang: "tr" },
  { word: "YAZILIM", forbidden: ["KOD", "BİLGİSAYAR", "PROGRAM", "GELİŞTİRİCİ", "HATA (BUG)"], category: "Teknoloji", lang: "tr" },
  { word: "DEPREM", forbidden: ["SARSINTI", "FAY", "ZELZELE", "BİNA", "AFET"], category: "Doğa", lang: "tr" },
  { word: "AŞÇI", forbidden: ["YEMEK", "MUTFAK", "TAVA", "LEZZET", "RESTORAN"], category: "Meslek", lang: "tr" },
  { word: "AVUKAT", forbidden: ["MAHKEME", "HAKİM", "DAVA", "SAVUNMA", "HUKUK"], category: "Meslek", lang: "tr" },
  { word: "CADI", forbidden: ["SÜPÜRGE", "BÜYÜ", "İKSİR", "SİYAH ŞAPKA", "MASAL"], category: "Karakter", lang: "tr" },
  { word: "ÇİKOLATA", forbidden: ["TATLI", "KAKAO", "BİTTER", "SÜTLÜ", "YEMEK"], category: "Yiyecek", lang: "tr" },
  { word: "KARINCA", forbidden: ["BÖCEK", "ÇALIŞKAN", "KÜÇÜK", "YAZ", "YIĞIN"], category: "Hayvan", lang: "tr" },
  { word: "MATEMATİK", forbidden: ["SAYI", "HESAP", "FORMÜL", "DERS", "PROBLEM"], category: "Eğitim", lang: "tr" },
  { word: "OYUNCU", forbidden: ["TİYATRO", "SAHNE", "DİZİ", "ROL", "FİLM"], category: "Meslek", lang: "tr" },
  { word: "RÜYA", forbidden: ["UYKU", "GECE", "GÖRMEK", "KABUS", "YATAK"], category: "Eylem", lang: "tr" },
  { word: "YÜZÜK", forbidden: ["PARMAK", "EVLİLİK", "ALTIN", "TAKI", "NİŞAN"], category: "Aksesuar", lang: "tr" },
  { word: "DİŞÇİ", forbidden: ["DİŞ", "AĞRI", "ÇEKMEK", "DOLGU", "FIRÇA"], category: "Meslek", lang: "tr" },
  { word: "FUTBOL", forbidden: ["TOP", "GOL", "STADYUM", "MAÇ", "TAKIM"], category: "Spor", lang: "tr" },
  { word: "HARİTA", forbidden: ["YÖN", "BULMAK", "ÜLKE", "KITA", "PUSULA"], category: "Eşya", lang: "tr" },
  { word: "KAPTAN", forbidden: ["GEMİ", "DÜMEN", "DENİZ", "YOLCU", "MÜRETTEBAT"], category: "Meslek", lang: "tr" },
  { word: "MEYVE", forbidden: ["ELMA", "AĞAÇ", "TATLI", "YEMEK", "VİTAMİN"], category: "Yiyecek", lang: "tr" },
  { word: "OKUL", forbidden: ["ÖĞRENCİ", "ÖĞRETMEN", "DERS", "SINIF", "ZİL"], category: "Eğitim", lang: "tr" },
  { word: "PENGUEN", forbidden: ["KUTUP", "KAR", "KUŞ", "BUZ", "SİYAH BEYAZ"], category: "Hayvan", lang: "tr" },
  { word: "ROMAN", forbidden: ["KİTAP", "YAZAR", "OKUMAK", "HİKAYE", "SAYFA"], category: "Edebiyat", lang: "tr" },
  { word: "TELEVİZYON", forbidden: ["KANAL", "KUMANDA", "İZLEMEK", "EKRAN", "DİZİ"], category: "Teknoloji", lang: "tr" },
  { word: "BULUT", forbidden: ["GÖKYÜZÜ", "BEYAZ", "YAĞMUR", "HAVA", "PAMUK"], category: "Doğa", lang: "tr" },
  { word: "BÜYÜTEÇ", forbidden: ["YAKIN", "GÖRMEK", "KÜÇÜK", "CAM", "MERCEK"], category: "Eşya", lang: "tr" },
  { word: "KAR", forbidden: ["KIŞ", "BEYAZ", "SOĞUK", "KARDAN ADAM", "TOP"], category: "Doğa", lang: "tr" },
  { word: "HAYALET", forbidden: ["KORKU", "RUH", "GÖRÜNMEZ", "BEYAZ ÇARŞAF", "GECE"], category: "Karakter", lang: "tr" },
  { word: "MAKARNA", forbidden: ["İTALYAN", "SOS", "SPAGETTİ", "HAMUR", "YEMEK"], category: "Yiyecek", lang: "tr" },
  { word: "ASANSÖR", forbidden: ["KAT", "BİNA", "YUKARI", "AŞAĞI", "DÜĞME"], category: "Eşya", lang: "tr" },
  { word: "BERBER", forbidden: ["SAÇ", "TIRAŞ", "MAKAS", "SAKAL", "AYNA"], category: "Meslek", lang: "tr" },
  { word: "KİLİT", forbidden: ["ANAHTAR", "KAPI", "AÇMAK", "KAPATMAK", "GÜVENLİK"], category: "Eşya", lang: "tr" },
  { word: "HEYKEL", forbidden: ["TAŞ", "SANAT", "MÜZE", "YAPMAK", "MEYDAN"], category: "Sanat", lang: "tr" },
  { word: "ZAR", forbidden: ["OYUN", "SAYI", "ATMAK", "TAVLA", "ŞANS"], category: "Oyun", lang: "tr" },
  { word: "DENİZANASI", forbidden: ["SU", "OKYANUS", "YAKMAK", "ŞEFFAF", "CANLI"], category: "Hayvan", lang: "tr" },

  // İNGİLİZCE (EN)
  { word: "APPLE", forbidden: ["FRUIT", "RED", "TREE", "IPHONE", "MAC"], category: "English (Food/Tech)", lang: "en" },
  { word: "DOCTOR", forbidden: ["HOSPITAL", "SICK", "MEDICINE", "NURSE", "HEALTH"], category: "English (Job)", lang: "en" },
  { word: "GUITAR", forbidden: ["MUSIC", "PLAY", "STRINGS", "BAND", "INSTRUMENT"], category: "English (Music)", lang: "en" },
  { word: "WATER", forbidden: ["DRINK", "THIRSTY", "OCEAN", "SEA", "LIQUID"], category: "English (Nature)", lang: "en" },
  { word: "DOG", forbidden: ["CAT", "BARK", "PET", "PUPPY", "ANIMAL"], category: "English (Animal)", lang: "en" },
  { word: "MOVIE", forbidden: ["CINEMA", "WATCH", "POPCORN", "ACTOR", "FILM"], category: "English (Entertainment)", lang: "en" },
  { word: "SLEEP", forbidden: ["BED", "NIGHT", "TIRED", "DREAM", "WAKE"], category: "English (Action)", lang: "en" },
  { word: "MONEY", forbidden: ["BANK", "BUY", "CASH", "PAY", "DOLLAR"], category: "English (Object)", lang: "en" },
  { word: "SUMMER", forbidden: ["WINTER", "HOT", "SUN", "BEACH", "HOLIDAY"], category: "English (Season)", lang: "en" },
  { word: "COMPUTER", forbidden: ["SCREEN", "KEYBOARD", "MOUSE", "LAPTOP", "INTERNET"], category: "English (Tech)", lang: "en" },
  { word: "BOOK", forbidden: ["READ", "PAGES", "LIBRARY", "AUTHOR", "WORDS"], category: "English (Object)", lang: "en" },
  { word: "CAR", forbidden: ["DRIVE", "ROAD", "WHEELS", "VEHICLE", "ENGINE"], category: "English (Transport)", lang: "en" },
  { word: "SUN", forbidden: ["HOT", "YELLOW", "SKY", "DAY", "STAR"], category: "English (Nature)", lang: "en" },
  { word: "TIME", forbidden: ["CLOCK", "HOUR", "MINUTE", "WATCH", "LATE"], category: "English (Concept)", lang: "en" },
  { word: "FRIEND", forbidden: ["BUDDY", "PAL", "PERSON", "KNOW", "PLAY"], category: "English (People)", lang: "en" },
  { word: "GAME", forbidden: ["PLAY", "WIN", "LOSE", "BOARD", "VIDEO"], category: "English (Activity)", lang: "en" },
  { word: "HOUSE", forbidden: ["HOME", "LIVE", "BUILDING", "DOOR", "ROOF"], category: "English (Place)", lang: "en" },
  { word: "SCHOOL", forbidden: ["TEACHER", "STUDENT", "CLASS", "LEARN", "EDUCATION"], category: "English (Place)", lang: "en" },
  { word: "SHOE", forbidden: ["FOOT", "WEAR", "SOCK", "WALK", "SNEAKER"], category: "English (Clothing)", lang: "en" },
  { word: "LOVE", forbidden: ["HEART", "FEELING", "HATE", "KISS", "ROMANCE"], category: "English (Concept)", lang: "en" },
  { word: "CITY", forbidden: ["TOWN", "BUILDINGS", "PEOPLE", "BIG", "STREETS"], category: "English (Place)", lang: "en" },
  { word: "BIRD", forbidden: ["FLY", "WINGS", "SKY", "FEATHERS", "ANIMAL"], category: "English (Animal)", lang: "en" },
  { word: "STAR", forbidden: ["SKY", "NIGHT", "MOON", "SHINE", "SPACE"], category: "English (Nature)", lang: "en" },
  { word: "FIRE", forbidden: ["HOT", "BURN", "FLAME", "WOOD", "CAMP"], category: "English (Nature)", lang: "en" },
  { word: "ICE", forbidden: ["COLD", "WATER", "FREEZE", "SNOW", "CUBE"], category: "English (Nature)", lang: "en" },
  { word: "COFFEE", forbidden: ["CAFFEINE", "HOT", "MORNING", "MUG", "TEA"], category: "English (Food)", lang: "en" },
  { word: "BEACH", forbidden: ["SAND", "OCEAN", "SUN", "SWIM", "VACATION"], category: "English (Place)", lang: "en" },
  { word: "PLANE", forbidden: ["FLY", "AIRPORT", "SKY", "PILOT", "TRAVEL"], category: "English (Transport)", lang: "en" },
  { word: "HOSPITAL", forbidden: ["DOCTOR", "NURSE", "SICK", "AMBULANCE", "HEALTH"], category: "English (Place)", lang: "en" },
  { word: "PIZZA", forbidden: ["CHEESE", "SLICE", "ITALIAN", "FOOD", "PEPPERONI"], category: "English (Food)", lang: "en" },
  { word: "PHONE", forbidden: ["CALL", "TEXT", "CELL", "APPLE", "SMART"], category: "English (Tech)", lang: "en" },
  { word: "RAIN", forbidden: ["WATER", "SKY", "UMBRELLA", "WET", "STORM"], category: "English (Nature)", lang: "en" },
  { word: "TEACHER", forbidden: ["SCHOOL", "STUDENT", "LEARN", "CLASS", "DESK"], category: "English (Job)", lang: "en" },
  { word: "MOUNTAIN", forbidden: ["CLIMB", "HIGH", "SNOW", "HIKE", "ROCK"], category: "English (Nature)", lang: "en" },
  { word: "PARTY", forbidden: ["FUN", "DANCE", "MUSIC", "FRIENDS", "BIRTHDAY"], category: "English (Event)", lang: "en" },
  { word: "CAMERA", forbidden: ["PHOTO", "PICTURE", "TAKE", "FLASH", "LENS"], category: "English (Tech)", lang: "en" },
  { word: "BABY", forbidden: ["CHILD", "CRY", "BORN", "DIAPER", "CUTE"], category: "English (People)", lang: "en" },
  { word: "CHAIR", forbidden: ["SIT", "TABLE", "WOOD", "SEAT", "FURNITURE"], category: "English (Object)", lang: "en" },
  { word: "TRAIN", forbidden: ["TRACK", "STATION", "TICKET", "TRAVEL", "RAIL"], category: "English (Transport)", lang: "en" },
  { word: "GHOST", forbidden: ["SCARY", "HALLOWEEN", "SPIRIT", "WHITE", "BOO"], category: "English (Character)", lang: "en" }
];

// Shuffle array helper
const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

// Generate random room code
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// --- CSS & ANIMATIONS ---
const styles = `
  @keyframes shake {
    0%, 100% { transform: translateX(0) translateY(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-12px) translateY(-5px) rotate(-3deg); }
    20%, 40%, 60%, 80% { transform: translateX(12px) translateY(5px) rotate(3deg); }
  }
  .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
  
  @keyframes pulse-fast {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.08); }
  }
  .animate-pulse-fast { animation: pulse-fast 0.6s ease-in-out infinite; }
  
  @keyframes popIn {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-pop-in { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-float { animation: float 3s ease-in-out infinite; }

  .glass-card {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  }
  
  body {
    background-color: #0B1120;
    color: white;
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  .text-glow-red { text-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
  .text-glow-lime { text-shadow: 0 0 20px rgba(132, 204, 22, 0.6); }
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('SPLASH'); 
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Mute Toggle handler
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    isMutedGlobal = newMutedState;
  };

  // 1. Auth Init
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (err) {
            console.log("Custom token mismatch, falling back to anonymous sign-in...");
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth error:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Room Subscription
  useEffect(() => {
    if (!user || !roomId) return; 

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data());
        setView('ROOM');
      } else {
        setError("Oda bulunamadı veya kapandı.");
        setRoomId('');
        setView('HOME');
      }
    }, (err) => {
      console.error(err);
      setError("Bağlantı hatası.");
    });

    return () => unsubscribe();
  }, [user, roomId]);

  useEffect(() => {
    if (view === 'SPLASH') {
      const t = setTimeout(() => setView('HOME'), 2000);
      return () => clearTimeout(t);
    }
  }, [view]);

  // --- ACTIONS ---
  const handleCreateRoom = async (name, settings) => {
    if (!user) return;
    playSound('tick');

    const newRoomId = generateRoomCode();
    
    // Dil Seçeneğine Göre Filtreleme & Düşme (Fallback) Koruması
    const packageLanguage = settings?.language || 'tr';
    const availableIndices = WORD_DATABASE
      .map((w, index) => ({ lang: w.lang || 'tr', index }))
      .filter(w => packageLanguage === 'mixed' ? true : w.lang === packageLanguage)
      .map(w => w.index);
      
    // Havuz boş kalmasın diye fallback güvenlik önlemi
    const wordIndices = shuffle(availableIndices.length > 0 ? availableIndices : [0, 1, 2, 3, 4]); 

    const initialRoom = {
      id: newRoomId,
      hostId: user.uid,
      state: 'LOBBY',
      settings: settings || { duration: 60, passes: 3, targetScore: 30, language: 'tr' },
      players: {
        [user.uid]: { name: name, team: 'A', isHost: true }
      },
      scores: { A: 0, B: 0 },
      game: {
        turnTeam: 'A',
        narratorId: null,
        endTime: null,
        wordQueue: wordIndices,
        currentWordQueueIndex: 0,
        roundStats: { correct: 0, taboo: 0, pass: 0 }
      }
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId), initialRoom);
      setPlayerName(name);
      setRoomId(newRoomId);
    } catch (e) {
      console.error("Oda oluşturma hatası:", e);
      setError("Oda oluşturulamadı. (Ağ hatası veya yetki sorunu)");
    }
  };

  const handleJoinRoom = async (code, name) => {
    if (!user) return;
    playSound('tick');
    const codeUpper = code.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', codeUpper);
    
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("Oda bulunamadı.");
        return;
      }
      
      const data = snap.data();
      if (data.state !== 'LOBBY') {
        setError("Oyun şu anda devam ediyor.");
        return;
      }

      let teamA_count = 0; let teamB_count = 0;
      Object.values(data.players).forEach(p => p.team === 'A' ? teamA_count++ : teamB_count++);
      const assignedTeam = teamA_count <= teamB_count ? 'A' : 'B';

      await updateDoc(roomRef, {
        [`players.${user.uid}`]: { name: name, team: assignedTeam, isHost: false }
      });

      setPlayerName(name);
      setRoomId(codeUpper);
      setError('');
    } catch (e) {
      setError("Katılma hatası.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0B1120] w-full">
      <style>{styles}</style>
      
      {/* Global Mute Toggle Button */}
      {view !== 'SPLASH' && (
        <button 
          onClick={toggleMute} 
          className="absolute top-4 right-4 z-50 p-3 bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-all"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-lime-400" />}
        </button>
      )}

      {/* Premium Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-[-15%] left-[-15%] w-[40rem] h-[40rem] bg-blue-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-15%] right-[-15%] w-[40rem] h-[40rem] bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-[40%] left-[30%] w-[30rem] h-[30rem] bg-purple-600 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="w-full max-w-md h-[100dvh] sm:h-screen sm:max-h-[900px] flex flex-col relative z-10 p-4">
        {view === 'SPLASH' && <SplashScreen />}
        {view === 'HOME' && <HomeScreen onCreate={() => setView('CREATE')} onJoin={() => setView('JOIN')} error={error} />}
        {view === 'CREATE' && <CreateRoomScreen onSubmit={handleCreateRoom} onBack={() => setView('HOME')} />}
        {view === 'JOIN' && <JoinRoomScreen onSubmit={handleJoinRoom} onBack={() => setView('HOME')} error={error} />}
        {view === 'ROOM' && roomData && (
          <RoomManager 
            user={user} 
            roomData={roomData} 
            roomId={roomId} 
            db={db} 
            appId={appId}
            onLeave={() => { setRoomId(''); setView('HOME'); setRoomData(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ==========================================
// SCREENS
// ==========================================

function SplashScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-pop-in relative h-full">
      <div className="w-36 h-36 bg-gradient-to-tr from-lime-400 to-green-500 rounded-[2rem] flex items-center justify-center shadow-[0_0_60px_rgba(132,204,22,0.4)] mb-8 transform rotate-6 animate-float">
        <MessageSquareIcon className="w-16 h-16 text-slate-900" />
      </div>
      <h1 className="text-6xl font-black tracking-tighter text-white mb-3">TABU<span className="text-lime-400">.</span></h1>
      <p className="text-slate-400 font-bold tracking-[0.2em] text-sm uppercase">Sınırları Zorla</p>
      
      <div className="absolute bottom-8 text-center w-full animate-pulse-fast">
        <p className="text-slate-600 text-xs font-black tracking-widest uppercase">ForgeAndPlay<br/><span className="text-[10px] font-medium opacity-70">Markasının Oyunudur</span></p>
      </div>
    </div>
  );
}

function HomeScreen({ onCreate, onJoin, error }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-pop-in w-full h-full relative">
      <div className="flex-1 flex flex-col justify-center w-full space-y-6">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">Oyun Başlıyor</h1>
          <p className="text-slate-400 text-lg">Arkadaşlarınla gerçek zamanlı mücadele</p>
        </div>
        
        {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-2xl text-sm font-bold w-full text-center border border-red-500/50 backdrop-blur-md">{error}</div>}

        <button onClick={onCreate} className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-black text-xl py-6 rounded-3xl shadow-[0_10px_0_rgb(101,163,13)] active:shadow-[0_0px_0_rgb(101,163,13)] active:translate-y-2.5 transition-all">
          Oda Oluştur
        </button>
        
        <button onClick={onJoin} className="w-full bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 text-white font-bold text-xl py-6 rounded-3xl border border-white/10 shadow-[0_10px_0_rgb(30,41,59)] active:shadow-[0_0px_0_rgb(30,41,59)] active:translate-y-2.5 transition-all">
          Odaya Katıl
        </button>
      </div>

      <div className="mt-auto pt-6 pb-2 text-center w-full">
        <p className="text-slate-600 text-[10px] font-black tracking-widest uppercase">ForgeAndPlay Markasının Oyunudur</p>
      </div>
    </div>
  );
}

function CreateRoomScreen({ onSubmit, onBack }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [targetScore, setTargetScore] = useState(30);
  const [passes, setPasses] = useState(3);
  const [language, setLanguage] = useState('tr'); // 'tr', 'mixed', 'en'

  return (
    <div className="flex-1 flex flex-col pt-12 pb-4 animate-pop-in h-full">
      <button onClick={onBack} className="absolute top-6 left-2 p-2 text-slate-400 hover:text-white transition-colors">
        <ArrowRight className="w-7 h-7 rotate-180" />
      </button>
      
      <h2 className="text-4xl font-black mb-6 shrink-0">Oda Ayarları</h2>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 mb-4">
        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Oyuncu Adın</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Örn: Efsane"
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-xl text-white outline-none focus:border-lime-500 focus:bg-slate-900 transition-all"
            maxLength={12}
          />
        </div>

        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Kelime Paketi</label>
          <div className="flex flex-col gap-3">
            {[
              { id: 'tr', label: 'Sadece Türkçe Kelimeler' },
              { id: 'mixed', label: 'Türkçe + İngilizce (Karışık)' },
              { id: 'en', label: 'Sadece İngilizce Kelimeler' }
            ].map(opt => (
              <button 
                key={opt.id} 
                onClick={() => { playSound('tick'); setLanguage(opt.id); }} 
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all border ${language === opt.id ? 'bg-purple-500 text-white shadow-[0_6px_0_rgb(168,85,247)] border-purple-400 -translate-y-1' : 'bg-slate-900/50 text-slate-300 border-white/10 hover:bg-slate-800'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Tur Süresi (Sn)</label>
          <div className="flex gap-3">
            {[60, 90, 120].map(val => (
              <button 
                key={val} 
                onClick={() => { playSound('tick'); setDuration(val); }} 
                className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${duration === val ? 'bg-lime-500 text-slate-900 shadow-[0_6px_0_rgb(101,163,13)] -translate-y-1' : 'bg-slate-800 text-white border border-white/5 hover:bg-slate-700'}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Hedef Skor</label>
          <div className="flex gap-3">
            {[30, 50, 70].map(val => (
              <button 
                key={val} 
                onClick={() => { playSound('tick'); setTargetScore(val); }} 
                className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${targetScore === val ? 'bg-lime-500 text-slate-900 shadow-[0_6px_0_rgb(101,163,13)] -translate-y-1' : 'bg-slate-800 text-white border border-white/5 hover:bg-slate-700'}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Pas Hakkı</label>
          <div className="flex gap-3">
            {[3, 5, 10].map(val => (
              <button 
                key={val} 
                onClick={() => { playSound('tick'); setPasses(val); }} 
                className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${passes === val ? 'bg-lime-500 text-slate-900 shadow-[0_6px_0_rgb(101,163,13)] -translate-y-1' : 'bg-slate-800 text-white border border-white/5 hover:bg-slate-700'}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-2">
        <button 
          onClick={() => name.trim() && onSubmit(name.trim(), { duration, targetScore, passes, language })}
          disabled={!name.trim()}
          className="w-full bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black text-2xl py-6 rounded-3xl shadow-[0_10px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2.5 transition-all"
        >
          Odayı Kur
        </button>
      </div>
    </div>
  );
}

function JoinRoomScreen({ onSubmit, onBack, error }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="flex-1 flex flex-col pt-12 animate-pop-in">
      <button onClick={onBack} className="absolute top-6 left-2 p-2 text-slate-400 hover:text-white">
        <ArrowRight className="w-7 h-7 rotate-180" />
      </button>
      
      <h2 className="text-4xl font-black mb-10">Odaya Katıl</h2>
      
      {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-2xl text-sm font-bold w-full text-center mb-8 backdrop-blur-md">{error}</div>}

      <div className="space-y-6">
        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Oda Kodu</label>
          <input 
            type="text" 
            value={code} 
            onChange={(e) => setCode(e.target.value.toUpperCase())} 
            placeholder="A4X2"
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-6 text-4xl tracking-[0.4em] text-center font-black text-lime-400 outline-none focus:border-lime-500 transition-colors uppercase"
            maxLength={4}
          />
        </div>

        <div className="glass-card p-5 rounded-3xl">
          <label className="text-sm font-bold text-slate-400 mb-3 block uppercase tracking-wider">Oyuncu Adın</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Örn: Ayşe"
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-xl text-white outline-none focus:border-lime-500 transition-colors"
            maxLength={12}
          />
        </div>
        
        <button 
          onClick={() => code.trim() && name.trim() && onSubmit(code.trim(), name.trim())}
          disabled={!code.trim() || !name.trim()}
          className="w-full bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black text-2xl py-6 rounded-3xl shadow-[0_10px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2.5 transition-all mt-8"
        >
          Odaya Gir
        </button>
      </div>
    </div>
  );
}

function RoomManager({ user, roomData, roomId, db, appId, onLeave }) {
  const isHost = roomData.hostId === user.uid;
  const me = roomData.players[user.uid];

  const updateRoom = async (updates) => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(roomRef, updates);
  };

  if (!me) return <div className="text-center mt-20 text-xl font-bold animate-pulse">Bağlanıyor...</div>;

  if (roomData.state === 'LOBBY') {
    return <LobbyScreen roomData={roomData} roomId={roomId} isHost={isHost} updateRoom={updateRoom} myId={user.uid} onLeave={onLeave} />;
  }
  if (roomData.state === 'PLAYING') {
    return <GameScreen roomData={roomData} isHost={isHost} updateRoom={updateRoom} myId={user.uid} />;
  }
  if (roomData.state === 'ROUND_END') {
    return <RoundEndScreen roomData={roomData} isHost={isHost} updateRoom={updateRoom} />;
  }
  if (roomData.state === 'GAME_OVER') {
    return <GameOverScreen roomData={roomData} isHost={isHost} updateRoom={updateRoom} onLeave={onLeave} />;
  }

  return null;
}

function LobbyScreen({ roomData, roomId, isHost, updateRoom, myId, onLeave }) {
  const players = Object.entries(roomData.players).map(([id, data]) => ({ id, ...data }));
  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');

  const switchTeam = () => {
    playSound('tick');
    const currentTeam = roomData.players[myId].team;
    updateRoom({ [`players.${myId}.team`]: currentTeam === 'A' ? 'B' : 'A' });
  };

  const startGame = () => {
    if (teamA.length === 0 || teamB.length === 0) {
      alert("Her takımda en az 1 oyuncu olmalı!");
      return;
    }
    
    playSound('correct');
    const firstNarratorId = teamA[0].id;

    updateRoom({
      state: 'PLAYING',
      'game.turnTeam': 'A',
      'game.narratorId': firstNarratorId,
      'game.endTime': Date.now() + (roomData.settings.duration * 1000),
      'game.roundStats': { correct: 0, taboo: 0, pass: 0 }
    });
  };

  return (
    <div className="flex-1 flex flex-col pt-10 pb-4 animate-pop-in h-full relative">
      <div className="flex justify-between items-center mb-6 bg-slate-800/50 p-4 rounded-3xl backdrop-blur-md border border-white/5 mt-4">
        <div>
          <h2 className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Oda Kodu</h2>
          <div className="text-4xl font-black tracking-[0.2em] text-lime-400 drop-shadow-md">{roomId}</div>
        </div>
        <button onClick={onLeave} className="bg-red-500/10 text-red-400 p-4 rounded-2xl hover:bg-red-500/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
        {/* TEAM A */}
        <div className="glass-card rounded-[2rem] p-6 border-t-4 border-t-blue-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10"></div>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-black text-blue-400 tracking-wide">MAVİ TAKIM</h3>
            <span className="bg-blue-500/20 text-blue-300 text-xs font-black px-3 py-1.5 rounded-lg">{teamA.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {teamA.map(p => (
              <div key={p.id} className={`bg-slate-900/80 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold border ${p.id === myId ? 'border-blue-400 text-white' : 'border-white/5 text-slate-300'}`}>
                {p.isHost && <Crown className="w-4 h-4 text-yellow-400 drop-shadow-md" />}
                {p.name} {p.id === myId && <span className="text-blue-400 text-xs">(Sen)</span>}
              </div>
            ))}
            {teamA.length === 0 && <span className="text-slate-500 text-sm font-medium">Kimse yok</span>}
          </div>
        </div>

        {/* TEAM B */}
        <div className="glass-card rounded-[2rem] p-6 border-t-4 border-t-orange-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-bl-full -z-10"></div>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-black text-orange-400 tracking-wide">TURUNCU TAKIM</h3>
            <span className="bg-orange-500/20 text-orange-300 text-xs font-black px-3 py-1.5 rounded-lg">{teamB.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {teamB.map(p => (
              <div key={p.id} className={`bg-slate-900/80 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold border ${p.id === myId ? 'border-orange-400 text-white' : 'border-white/5 text-slate-300'}`}>
                {p.isHost && <Crown className="w-4 h-4 text-yellow-400 drop-shadow-md" />}
                {p.name} {p.id === myId && <span className="text-orange-400 text-xs">(Sen)</span>}
              </div>
            ))}
            {teamB.length === 0 && <span className="text-slate-500 text-sm font-medium">Kimse yok</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 shrink-0">
        <button onClick={switchTeam} className="w-full glass-card text-white font-bold py-4 rounded-3xl flex items-center justify-center gap-3 hover:bg-white/5 transition-all">
          <RefreshCw className="w-5 h-5 text-slate-400" /> Takım Değiştir
        </button>
        
        {isHost ? (
          <button onClick={startGame} className="w-full bg-lime-500 text-slate-900 font-black text-2xl py-5 rounded-3xl shadow-[0_10px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2.5 transition-all flex justify-center items-center gap-2">
            <Play className="fill-slate-900 w-6 h-6" /> Başlat
          </button>
        ) : (
          <div className="w-full bg-slate-800/80 text-slate-400 font-bold py-5 rounded-3xl text-center border border-slate-700 animate-pulse text-lg">
            Kurucu başlatıyor...
          </div>
        )}
      </div>

      {/* Brand Watermark in Lobby */}
      <div className="absolute -bottom-2 right-2 opacity-30 pointer-events-none">
        <span className="text-[9px] font-black uppercase text-slate-500">ForgeAndPlay</span>
      </div>
    </div>
  );
}

function GameScreen({ roomData, isHost, updateRoom, myId }) {
  const { game, settings, players } = roomData;
  const isNarrator = game.narratorId === myId;
  const myTeam = players[myId].team;
  const isOpponent = myTeam !== game.turnTeam;
  const isTeammate = !isNarrator && !isOpponent;

  const [timeLeft, setTimeLeft] = useState(0);
  const [showShake, setShowShake] = useState(false);
  
  const prevStats = useRef(game.roundStats);

  // Sync Audio & Animations with Database changes
  useEffect(() => {
    const stats = game.roundStats;
    const prev = prevStats.current;
    
    if (stats.taboo > prev.taboo) {
      playSound('taboo');
      setShowShake(true);
      setTimeout(() => setShowShake(false), 500);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else if (stats.correct > prev.correct) {
      playSound('correct');
      if (navigator.vibrate) navigator.vibrate(100);
    } else if (stats.pass > prev.pass) {
      playSound('pass');
    }
    
    prevStats.current = stats;
  }, [game.roundStats]);

  // Timer logic
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((game.endTime - Date.now()) / 1000));
      
      setTimeLeft((prev) => {
        if (remaining !== prev && remaining > 0 && remaining <= 10) {
          playSound('tick');
        }
        if (remaining === 0 && prev > 0) {
           playSound('alarm');
        }
        return remaining;
      });
      
      if (remaining === 0 && isNarrator) {
        updateRoom({ state: 'ROUND_END' });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [game.endTime, isNarrator, updateRoom]);

  const wordIndex = game.wordQueue[game.currentWordQueueIndex % game.wordQueue.length];
  const currentCard = WORD_DATABASE[wordIndex];
  const passesLeft = settings.passes - game.roundStats.pass;

  const handleAction = (type) => {
    if (!isNarrator && type !== 'taboo') return;
    if (isOpponent && type !== 'taboo') return;

    const newStats = { ...game.roundStats };
    if (type === 'correct') newStats.correct++;
    if (type === 'taboo') newStats.taboo++;
    if (type === 'pass') newStats.pass++;

    updateRoom({
      'game.roundStats': newStats,
      'game.currentWordQueueIndex': game.currentWordQueueIndex + 1
    });
  };

  const timerColor = timeLeft <= 10 ? 'text-red-500 animate-pulse-fast text-glow-red' : 'text-lime-400 text-glow-lime';

  // NARRATOR VIEW
  if (isNarrator) {
    return (
      <div className={`flex-1 flex flex-col pt-10 pb-4 h-full ${showShake ? 'animate-shake' : ''}`}>
        <div className="flex justify-between items-center mb-4 px-2 mt-4">
          <div className="bg-slate-800/80 backdrop-blur-md px-5 py-2.5 rounded-2xl flex items-center gap-3 border border-white/10 shadow-lg">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></span>
            <span className="text-sm font-black text-white tracking-wider">Sıra Sende</span>
          </div>
          <div className={`text-5xl font-black ${timerColor} drop-shadow-xl font-mono mr-14`}>
            {timeLeft}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[2rem] p-6 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-pop-in border-4 border-slate-200">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-lime-400 via-green-500 to-lime-400 bg-[length:200%_auto] animate-pulse"></div>
          
          <div className="text-center mb-4">
            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-inner">
              {currentCard.category}
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-[3rem] font-black text-slate-900 text-center mb-6 break-words leading-none tracking-tight">
            {currentCard.word}
          </h2>

          <div className="flex-1 flex flex-col justify-center space-y-2.5">
            {currentCard.forbidden.map((word, i) => (
              <div key={i} className="bg-red-50 text-red-600 font-black text-lg sm:text-2xl py-2.5 rounded-xl text-center border-2 border-red-100 shadow-sm">
                {word}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <Smartphone className="w-5 h-5" /> Telefonu Sakla
          </div>
        </div>

        <div className="flex gap-4 mt-4 h-20 sm:h-24 shrink-0">
          <button 
            onClick={() => handleAction('pass')}
            disabled={passesLeft <= 0}
            className="flex-1 bg-slate-700 disabled:opacity-50 disabled:bg-slate-800 text-white font-black text-xl sm:text-2xl rounded-[1.5rem] sm:rounded-[2rem] active:scale-95 transition-all shadow-[0_6px_0_rgb(51,65,85)] sm:shadow-[0_8px_0_rgb(51,65,85)] active:shadow-none active:translate-y-2 border border-slate-600"
          >
            PAS <span className="text-xs sm:text-sm font-bold text-slate-400 block -mt-1 opacity-80">({passesLeft})</span>
          </button>
          
          <button 
            onClick={() => handleAction('correct')}
            className="flex-[2] bg-lime-500 text-slate-900 font-black text-3xl sm:text-4xl rounded-[1.5rem] sm:rounded-[2rem] active:scale-95 transition-all shadow-[0_6px_0_rgb(101,163,13)] sm:shadow-[0_8px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2 border border-lime-400"
          >
            DOĞRU
          </button>
        </div>
      </div>
    );
  }

  // OPPONENT VIEW (Rakip Takım)
  if (isOpponent) {
    return (
      <div className={`flex-1 flex flex-col pt-10 pb-4 h-full ${showShake ? 'animate-shake' : ''}`}>
        <div className="flex justify-between items-center mb-4 px-2 mt-4">
          <div className="bg-red-900/50 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-xs font-bold text-red-200 uppercase">Kontrol Sende</span>
          </div>
          <div className={`text-4xl font-black ${timerColor} font-mono mr-14`}>
            {timeLeft}
          </div>
        </div>

        <div className="text-center mb-2">
           <h3 className="text-lg font-bold text-slate-300"><span className="text-white bg-slate-800 px-2 py-1 rounded-md">{players[game.narratorId]?.name}</span> anlatıyor</h3>
        </div>

        <div className="flex-1 bg-red-50/10 backdrop-blur-sm rounded-[2rem] p-5 flex flex-col border border-red-500/20 shadow-inner">
          <div className="text-center mb-3">
             <div className="text-red-300 font-bold text-xs uppercase tracking-widest mb-1">Ana Kelime</div>
             <h2 className="text-3xl font-black text-white">{currentCard.word}</h2>
          </div>
          
          <div className="bg-red-900/40 rounded-2xl p-3 flex-1 flex flex-col justify-center space-y-2 border border-red-500/20">
             <div className="text-center text-red-400 font-bold text-xs uppercase tracking-widest mb-1">Yasaklı Kelimeler</div>
            {currentCard.forbidden.map((word, i) => (
              <div key={i} className="bg-red-500/20 text-red-100 font-bold text-base py-1.5 rounded-lg text-center">
                {word}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 h-28 shrink-0 flex items-center justify-center">
         <button 
            onClick={() => handleAction('taboo')}
            className="w-full h-full bg-red-600 rounded-[2rem] flex flex-col items-center justify-center shadow-[0_10px_0_rgb(153,27,27),0_0_40px_rgba(220,38,38,0.4)] active:shadow-[0_0px_0_rgb(153,27,27)] active:translate-y-[10px] transition-all relative overflow-hidden group border-2 border-red-500"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-active:opacity-100 transition-opacity"></div>
            <span className="text-4xl font-black text-white tracking-[0.2em] drop-shadow-lg">TABU</span>
         </button>
        </div>
      </div>
    );
  }

  // TEAMMATE VIEW
  if (isTeammate) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center h-full text-center p-6 pt-12 ${showShake ? 'animate-shake' : ''}`}>
        <div className="relative">
          <div className={`absolute inset-0 rounded-full blur-2xl opacity-30 ${myTeam === 'A' ? 'bg-blue-500' : 'bg-orange-500'} ${timeLeft <= 10 ? 'animate-pulse' : ''}`}></div>
          <div className={`w-56 h-56 rounded-full flex items-center justify-center border-[12px] ${myTeam === 'A' ? 'border-blue-500/80 bg-blue-900/20' : 'border-orange-500/80 bg-orange-900/20'} backdrop-blur-md mb-10 shadow-[0_0_60px_rgba(0,0,0,0.5)] relative z-10`}>
             <div className={`text-[5rem] font-black ${timerColor} font-mono`}>
                {timeLeft}
              </div>
          </div>
        </div>
        <h2 className="text-4xl font-black text-white mb-4 drop-shadow-md">Tahmin Et!</h2>
        <div className="bg-slate-800/80 px-6 py-4 rounded-3xl border border-white/10 backdrop-blur-md">
           <p className="text-xl text-slate-300">
             <span className="text-lime-400 font-black">{players[game.narratorId]?.name}</span> size anlatıyor
           </p>
        </div>
        
        <div className="mt-16 flex space-x-3">
          <div className="w-4 h-4 bg-white/30 rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-white/30 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-4 h-4 bg-white/30 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    );
  }
}

function RoundEndScreen({ roomData, isHost, updateRoom }) {
  const { game, scores, settings } = roomData;
  const { correct, taboo, pass } = game.roundStats;
  const roundPoints = correct - taboo;

  const handleNextRound = () => {
    playSound('correct');
    const nextTeam = game.turnTeam === 'A' ? 'B' : 'A';
    const newScores = { ...scores };
    newScores[game.turnTeam] += roundPoints;

    if (newScores[game.turnTeam] >= settings.targetScore) {
       updateRoom({ scores: newScores, state: 'GAME_OVER' });
       return;
    }

    const teamPlayers = Object.entries(roomData.players).filter(([_, p]) => p.team === nextTeam).map(([id]) => id);
    const nextNarrator = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];

    updateRoom({
      scores: newScores,
      state: 'PLAYING',
      'game.turnTeam': nextTeam,
      'game.narratorId': nextNarrator,
      'game.endTime': Date.now() + (settings.duration * 1000),
      'game.roundStats': { correct: 0, taboo: 0, pass: 0 }
    });
  };

  const isTeamA = game.turnTeam === 'A';
  const teamColorClass = isTeamA ? 'text-blue-400' : 'text-orange-400';

  return (
    <div className="flex-1 flex flex-col pt-12 pb-6 animate-pop-in h-full">
      <div className="text-center mb-8">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Tur Tamamlandı</h2>
        <div className={`text-4xl font-black ${teamColorClass}`}>
          {isTeamA ? 'MAVİ TAKIM' : 'TURUNCU TAKIM'}
        </div>
      </div>

      <div className={`glass-card rounded-[2.5rem] p-8 mb-6 text-center border-t-4 ${isTeamA ? 'border-t-blue-500' : 'border-t-orange-500'} relative overflow-hidden`}>
        <div className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-2">Bu Tur Kazanılan</div>
        <div className={`text-[5rem] font-black leading-none drop-shadow-2xl ${roundPoints >= 0 ? 'text-lime-400' : 'text-red-500'}`}>
          {roundPoints > 0 ? '+' : ''}{roundPoints}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-slate-800/60 rounded-3xl p-4 text-center border border-white/5 backdrop-blur-md">
          <div className="text-3xl font-black text-lime-400 mb-1">+{correct}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Doğru</div>
        </div>
        <div className="bg-slate-800/60 rounded-3xl p-4 text-center border border-white/5 backdrop-blur-md">
          <div className="text-3xl font-black text-red-500 mb-1">-{taboo}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tabu</div>
        </div>
        <div className="bg-slate-800/60 rounded-3xl p-4 text-center border border-white/5 backdrop-blur-md">
          <div className="text-3xl font-black text-slate-300 mb-1">{pass}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pas</div>
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-3xl p-5 flex justify-between items-center mb-auto border border-white/10 shadow-inner">
        <div className="flex flex-col items-center flex-1">
           <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Mavi Toplam</span>
           <span className="text-3xl font-black text-white">{scores.A + (game.turnTeam === 'A' ? roundPoints : 0)}</span>
        </div>
        <div className="px-4 py-2 bg-slate-800 rounded-xl text-slate-400 font-black text-xs uppercase tracking-widest shadow-inner">
          Hedef: {settings.targetScore}
        </div>
        <div className="flex flex-col items-center flex-1">
           <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-1">Turuncu Toplam</span>
           <span className="text-3xl font-black text-white">{scores.B + (game.turnTeam === 'B' ? roundPoints : 0)}</span>
        </div>
      </div>

      <div className="mt-6 shrink-0">
        {isHost ? (
          <button onClick={handleNextRound} className="w-full bg-lime-500 text-slate-900 font-black text-2xl py-6 rounded-[2rem] shadow-[0_10px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2.5 transition-all">
            Sıradaki Tur
          </button>
        ) : (
          <div className="w-full glass-card text-slate-400 font-bold py-6 rounded-[2rem] text-center animate-pulse text-lg">
            Hostun başlatması bekleniyor...
          </div>
        )}
      </div>
    </div>
  );
}

function GameOverScreen({ roomData, isHost, updateRoom, onLeave }) {
  const { scores } = roomData;
  const winner = scores.A > scores.B ? 'A' : (scores.B > scores.A ? 'B' : 'TIE');

  useEffect(() => { playSound('alarm'); }, []);

  const handleRematch = () => {
    playSound('tick');
    updateRoom({ state: 'LOBBY', scores: { A: 0, B: 0 } });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center animate-pop-in relative h-full pt-10">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90 pointer-events-none"></div>
      
      <Trophy className={`w-40 h-40 mb-8 drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] ${winner === 'A' ? 'text-blue-400' : winner === 'B' ? 'text-orange-400' : 'text-yellow-400'} animate-float`} />
      
      <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em] mb-4">ŞAMPİYON BELLİ OLDU</h2>
      <h1 className="text-5xl font-black text-white mb-12 drop-shadow-lg leading-tight">
        {winner === 'A' && <span className="text-blue-400">MAVİ TAKIM<br/><span className="text-white text-3xl">KAZANDI!</span></span>}
        {winner === 'B' && <span className="text-orange-400">TURUNCU TAKIM<br/><span className="text-white text-3xl">KAZANDI!</span></span>}
        {winner === 'TIE' && "BERABERE!"}
      </h1>

      <div className="flex gap-6 mb-auto w-full justify-center relative z-10">
        <div className={`glass-card p-6 rounded-[2rem] border-t-4 w-36 ${winner === 'A' ? 'border-t-blue-500 bg-blue-500/20 scale-110 shadow-[0_0_40px_rgba(59,130,246,0.3)]' : 'border-t-slate-600 bg-slate-800/50'}`}>
           <div className="text-blue-400 font-black text-xs uppercase tracking-widest mb-3">MAVİ</div>
           <div className="text-5xl font-black text-white">{scores.A}</div>
        </div>
        <div className={`glass-card p-6 rounded-[2rem] border-t-4 w-36 ${winner === 'B' ? 'border-t-orange-500 bg-orange-500/20 scale-110 shadow-[0_0_40px_rgba(249,115,22,0.3)]' : 'border-t-slate-600 bg-slate-800/50'}`}>
           <div className="text-orange-400 font-black text-xs uppercase tracking-widest mb-3">TURUNCU</div>
           <div className="text-5xl font-black text-white">{scores.B}</div>
        </div>
      </div>

      <div className="w-full space-y-4 relative z-10 mt-12">
        {isHost && (
          <button onClick={handleRematch} className="w-full bg-lime-500 text-slate-900 font-black text-2xl py-6 rounded-3xl shadow-[0_10px_0_rgb(101,163,13)] active:shadow-none active:translate-y-2.5 transition-all flex items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6" /> Rövanş Oyna
          </button>
        )}
        <button onClick={onLeave} className="w-full glass-card text-white font-bold text-lg py-5 rounded-3xl hover:bg-white/10 transition-colors">
          Ana Menüye Dön
        </button>
      </div>
    </div>
  );
}

function MessageSquareIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="12" y1="7" x2="12" y2="13" />
    </svg>
  );
}