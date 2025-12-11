export interface BDRoute {
  id: string;
  from: string;
  fromBn: string;
  to: string;
  toBn: string;
  category: "intercity" | "district" | "tourist";
  busTypes: ("ac" | "non_ac" | "sleeper" | "coach")[];
  duration: string;
  distance: string;
  active: boolean;
}

const ONE_WAY_ROUTES: Omit<BDRoute, "id">[] = [
  // ===== DHAKA TO ALL DIVISIONS =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Chittagong", toBn: "চট্টগ্রাম", category: "intercity", busTypes: ["ac", "non_ac", "sleeper", "coach"], duration: "5-6 ঘণ্টা", distance: "264 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Sylhet", toBn: "সিলেট", category: "intercity", busTypes: ["ac", "non_ac", "coach"], duration: "5-7 ঘণ্টা", distance: "240 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Rajshahi", toBn: "রাজশাহী", category: "intercity", busTypes: ["ac", "non_ac", "sleeper"], duration: "5-6 ঘণ্টা", distance: "252 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Khulna", toBn: "খুলনা", category: "intercity", busTypes: ["ac", "non_ac", "coach"], duration: "6-8 ঘণ্টা", distance: "310 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Barisal", toBn: "বরিশাল", category: "intercity", busTypes: ["ac", "non_ac"], duration: "6-7 ঘণ্টা", distance: "271 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Rangpur", toBn: "রংপুর", category: "intercity", busTypes: ["ac", "non_ac", "sleeper"], duration: "7-9 ঘণ্টা", distance: "298 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Mymensingh", toBn: "ময়মনসিংহ", category: "intercity", busTypes: ["ac", "non_ac"], duration: "2-3 ঘণ্টা", distance: "120 কি.মি.", active: true },

  // ===== DHAKA TO CHITTAGONG REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Cox's Bazar", toBn: "কক্সবাজার", category: "tourist", busTypes: ["ac", "non_ac", "sleeper", "coach"], duration: "9-12 ঘণ্টা", distance: "414 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Comilla", toBn: "কুমিল্লা", category: "district", busTypes: ["ac", "non_ac"], duration: "2-3 ঘণ্টা", distance: "96 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Feni", toBn: "ফেনী", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "150 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Noakhali", toBn: "নোয়াখালী", category: "district", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "180 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Lakshmipur", toBn: "লক্ষ্মীপুর", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "170 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Chandpur", toBn: "চাঁদপুর", category: "district", busTypes: ["non_ac"], duration: "3-4 ঘণ্টা", distance: "115 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Brahmanbaria", toBn: "ব্রাহ্মণবাড়িয়া", category: "district", busTypes: ["ac", "non_ac"], duration: "2-3 ঘণ্টা", distance: "101 কি.মি.", active: true },

  // ===== DHAKA TO SYLHET REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Habiganj", toBn: "হবিগঞ্জ", category: "district", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "180 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Moulvibazar", toBn: "মৌলভীবাজার", category: "district", busTypes: ["ac", "non_ac"], duration: "5-6 ঘণ্টা", distance: "203 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Sunamganj", toBn: "সুনামগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "6-7 ঘণ্টা", distance: "260 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Sreemangal", toBn: "শ্রীমঙ্গল", category: "tourist", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "185 কি.মি.", active: true },

  // ===== DHAKA TO RAJSHAHI REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Bogra", toBn: "বগুড়া", category: "district", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "193 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Natore", toBn: "নাটোর", category: "district", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "200 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Pabna", toBn: "পাবনা", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "165 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Sirajganj", toBn: "সিরাজগঞ্জ", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "135 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Naogaon", toBn: "নওগাঁ", category: "district", busTypes: ["non_ac"], duration: "5-6 ঘণ্টা", distance: "240 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Chapainawabganj", toBn: "চাঁপাইনবাবগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "6-7 ঘণ্টা", distance: "290 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Joypurhat", toBn: "জয়পুরহাট", category: "district", busTypes: ["non_ac"], duration: "5-6 ঘণ্টা", distance: "220 কি.মি.", active: true },

  // ===== DHAKA TO KHULNA REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Jessore", toBn: "যশোর", category: "district", busTypes: ["ac", "non_ac"], duration: "5-6 ঘণ্টা", distance: "250 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Kushtia", toBn: "কুষ্টিয়া", category: "district", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "187 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Satkhira", toBn: "সাতক্ষীরা", category: "district", busTypes: ["non_ac"], duration: "7-8 ঘণ্টা", distance: "350 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Narail", toBn: "নড়াইল", category: "district", busTypes: ["non_ac"], duration: "5-6 ঘণ্টা", distance: "260 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Magura", toBn: "মাগুরা", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "200 కి.మి.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Meherpur", toBn: "মেহেরপুর", category: "district", busTypes: ["non_ac"], duration: "5-6 ঘণ্টা", distance: "230 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Chuadanga", toBn: "চুয়াডাঙ্গা", category: "district", busTypes: ["non_ac"], duration: "5-6 ঘণ্টা", distance: "215 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Jhenaidah", toBn: "ঝিনাইদহ", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "195 কি.মি.", active: true },

  // ===== DHAKA TO BARISAL REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Patuakhali", toBn: "পটুয়াখালী", category: "district", busTypes: ["ac", "non_ac"], duration: "7-8 ঘণ্টা", distance: "320 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Bhola", toBn: "ভোলা", category: "district", busTypes: ["non_ac"], duration: "7-9 ঘণ্টা", distance: "210 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Barguna", toBn: "বরগুনা", category: "district", busTypes: ["non_ac"], duration: "8-9 ঘণ্টা", distance: "350 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Jhalokati", toBn: "ঝালকাঠি", category: "district", busTypes: ["non_ac"], duration: "6-7 ঘণ্টা", distance: "280 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Pirojpur", toBn: "পিরোজপুর", category: "district", busTypes: ["non_ac"], duration: "7-8 ঘণ্টা", distance: "310 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Kuakata", toBn: "কুয়াকাটা", category: "tourist", busTypes: ["ac", "non_ac"], duration: "9-11 ঘণ্টা", distance: "360 কি.মি.", active: true },

  // ===== DHAKA TO RANGPUR REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Dinajpur", toBn: "দিনাজপুর", category: "district", busTypes: ["ac", "non_ac", "sleeper"], duration: "8-10 ঘণ্টা", distance: "330 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Thakurgaon", toBn: "ঠাকুরগাঁও", category: "district", busTypes: ["non_ac"], duration: "9-10 ঘণ্টা", distance: "375 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Panchagarh", toBn: "পঞ্চগড়", category: "district", busTypes: ["non_ac"], duration: "10-11 ঘণ্টা", distance: "410 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Nilphamari", toBn: "নীলফামারী", category: "district", busTypes: ["non_ac"], duration: "7-8 ঘণ্টা", distance: "310 কि.मि.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Kurigram", toBn: "কুড়িগ্রাম", category: "district", busTypes: ["non_ac"], duration: "7-8 ঘণ্টা", distance: "325 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Lalmonirhat", toBn: "লালমনিরহাট", category: "district", busTypes: ["non_ac"], duration: "7-8 ঘণ্টা", distance: "310 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Gaibandha", toBn: "গাইবান্ধা", category: "district", busTypes: ["non_ac"], duration: "6-7 ঘণ্টা", distance: "260 কি.মি.", active: true },

  // ===== DHAKA TO MYMENSINGH REGION =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Jamalpur", toBn: "জামালপুর", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "160 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Sherpur", toBn: "শেরপুর", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "190 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Netrokona", toBn: "নেত্রকোণা", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "175 কি.মি.", active: true },

  // ===== DHAKA NEARBY DISTRICTS =====
  { from: "Dhaka", fromBn: "ঢাকা", to: "Gazipur", toBn: "গাজীপুর", category: "district", busTypes: ["ac", "non_ac"], duration: "1 ঘণ্টা", distance: "35 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Narayanganj", toBn: "নারায়ণগঞ্জ", category: "district", busTypes: ["ac", "non_ac"], duration: "1 ঘণ্টা", distance: "20 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Tangail", toBn: "টাঙ্গাইল", category: "district", busTypes: ["ac", "non_ac"], duration: "2 ঘণ্টা", distance: "80 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Manikganj", toBn: "মানিকগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "60 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Munshiganj", toBn: "মুন্সীগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "25 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Narsingdi", toBn: "নরসিংদী", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "50 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Kishoreganj", toBn: "কিশোরগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "3 ঘণ্টা", distance: "110 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Madaripur", toBn: "মাদারীপুর", category: "district", busTypes: ["non_ac"], duration: "3-4 ঘণ্টা", distance: "120 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Gopalganj", toBn: "গোপালগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "160 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Faridpur", toBn: "ফরিদপুর", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "110 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Shariatpur", toBn: "শরীয়তপুর", category: "district", busTypes: ["non_ac"], duration: "3 ঘণ্টা", distance: "90 কি.মি.", active: true },
  { from: "Dhaka", fromBn: "ঢাকা", to: "Rajbari", toBn: "রাজবাড়ী", category: "district", busTypes: ["non_ac"], duration: "3 ঘণ্টা", distance: "100 কি.মি.", active: true },

  // ===== CHITTAGONG REGION ROUTES =====
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Cox's Bazar", toBn: "কক্সবাজার", category: "tourist", busTypes: ["ac", "non_ac", "coach"], duration: "3-4 ঘণ্টা", distance: "150 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Rangamati", toBn: "রাঙামাটি", category: "tourist", busTypes: ["ac", "non_ac"], duration: "2-3 ঘণ্টা", distance: "77 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Bandarban", toBn: "বান্দরবান", category: "tourist", busTypes: ["ac", "non_ac"], duration: "2-3 ঘণ্টা", distance: "92 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Khagrachari", toBn: "খাগড়াছড়ি", category: "tourist", busTypes: ["non_ac"], duration: "3-4 ঘণ্টা", distance: "110 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Comilla", toBn: "কুমিল্লা", category: "district", busTypes: ["ac", "non_ac"], duration: "3-4 ঘণ্টা", distance: "168 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Feni", toBn: "ফেনী", category: "district", busTypes: ["non_ac"], duration: "2 ঘণ্টা", distance: "100 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Sylhet", toBn: "সিলেট", category: "intercity", busTypes: ["ac", "non_ac"], duration: "8-9 ঘণ্টা", distance: "350 কি.মি.", active: true },

  // ===== SYLHET REGION ROUTES =====
  { from: "Sylhet", fromBn: "সিলেট", to: "Sreemangal", toBn: "শ্রীমঙ্গল", category: "tourist", busTypes: ["ac", "non_ac"], duration: "1.5-2 ঘণ্টা", distance: "55 কি.মি.", active: true },
  { from: "Sylhet", fromBn: "সিলেট", to: "Moulvibazar", toBn: "মৌলভীবাজার", category: "district", busTypes: ["non_ac"], duration: "2 ঘণ্টা", distance: "60 কি.মি.", active: true },
  { from: "Sylhet", fromBn: "সিলেট", to: "Sunamganj", toBn: "সুনামগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "45 কি.মি.", active: true },
  { from: "Sylhet", fromBn: "সিলেট", to: "Habiganj", toBn: "হবিগঞ্জ", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "50 কি.মি.", active: true },
  { from: "Sylhet", fromBn: "সিলেট", to: "Jaflong", toBn: "জাফলং", category: "tourist", busTypes: ["non_ac"], duration: "2 ঘণ্টা", distance: "62 কি.মি.", active: true },

  // ===== RAJSHAHI REGION ROUTES =====
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Bogra", toBn: "বগুড়া", category: "district", busTypes: ["non_ac"], duration: "2-3 ঘণ্টা", distance: "100 কি.মি.", active: true },
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Rangpur", toBn: "রংপুর", category: "intercity", busTypes: ["ac", "non_ac"], duration: "4-5 ঘণ্টা", distance: "175 কি.মি.", active: true },
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Natore", toBn: "নাটোর", category: "district", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "50 কি.মি.", active: true },
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Naogaon", toBn: "নওগাঁ", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "60 কি.মি.", active: true },
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Chapainawabganj", toBn: "চাঁপাইনবাবগঞ্জ", category: "tourist", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "45 কি.মি.", active: true },

  // ===== KHULNA REGION ROUTES =====
  { from: "Khulna", fromBn: "খুলনা", to: "Jessore", toBn: "যশোর", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "60 কি.মি.", active: true },
  { from: "Khulna", fromBn: "খুলনা", to: "Satkhira", toBn: "সাতক্ষীরা", category: "district", busTypes: ["non_ac"], duration: "2 ঘণ্টা", distance: "80 কি.মি.", active: true },
  { from: "Khulna", fromBn: "খুলনা", to: "Sundarbans", toBn: "সুন্দরবন", category: "tourist", busTypes: ["non_ac"], duration: "3 ঘণ্টা", distance: "100 কি.মি.", active: true },
  { from: "Khulna", fromBn: "খুলনা", to: "Bagerhat", toBn: "বাগেরহাট", category: "tourist", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "40 কি.মি.", active: true },

  // ===== RANGPUR REGION ROUTES =====
  { from: "Rangpur", fromBn: "রংপুর", to: "Dinajpur", toBn: "দিনাজপুর", category: "district", busTypes: ["non_ac"], duration: "2-3 ঘণ্টা", distance: "110 কি.মি.", active: true },
  { from: "Rangpur", fromBn: "রংপুর", to: "Bogra", toBn: "বগুড়া", category: "district", busTypes: ["non_ac"], duration: "2-3 ঘণ্টা", distance: "105 কি.মি.", active: true },
  { from: "Rangpur", fromBn: "রংপুর", to: "Gaibandha", toBn: "গাইবান্ধা", category: "district", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "45 কি.মি.", active: true },
  { from: "Rangpur", fromBn: "রংপুর", to: "Kurigram", toBn: "কুড়িগ্রাম", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "60 কি.মি.", active: true },
  { from: "Rangpur", fromBn: "রংপুর", to: "Lalmonirhat", toBn: "লালমনিরহাট", category: "district", busTypes: ["non_ac"], duration: "1 ঘণ্টা", distance: "50 কি.মি.", active: true },
  { from: "Rangpur", fromBn: "রংপুর", to: "Nilphamari", toBn: "নীলফামারী", category: "district", busTypes: ["non_ac"], duration: "1.5 ঘণ্টা", distance: "55 কি.মি.", active: true },

  // ===== DIVISION TO DIVISION ROUTES =====
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Rajshahi", toBn: "রাজশাহী", category: "intercity", busTypes: ["ac", "sleeper"], duration: "10-12 ঘণ্টা", distance: "460 কি.মি.", active: true },
  { from: "Chittagong", fromBn: "চট্টগ্রাম", to: "Khulna", toBn: "খুলনা", category: "intercity", busTypes: ["ac", "sleeper"], duration: "10-12 ঘণ্টা", distance: "470 কি.মি.", active: true },
  { from: "Sylhet", fromBn: "সিলেট", to: "Rajshahi", toBn: "রাজশাহী", category: "intercity", busTypes: ["ac", "sleeper"], duration: "10-12 ঘণ্টা", distance: "450 কি.মি.", active: true },
  { from: "Rajshahi", fromBn: "রাজশাহী", to: "Khulna", toBn: "খুলনা", category: "intercity", busTypes: ["ac"], duration: "5-6 ঘণ্টা", distance: "220 কি.মি.", active: true },
  { from: "Khulna", fromBn: "খুলনা", to: "Barisal", toBn: "বরিশাল", category: "intercity", busTypes: ["non_ac"], duration: "4-5 ঘণ্টা", distance: "180 কি.মি.", active: true },
];

function generateRouteId(from: string, to: string): string {
  return `${from.toLowerCase().replace(/[^a-z]/g, "")}_${to.toLowerCase().replace(/[^a-z]/g, "")}`;
}

function generateReverseRoute(route: Omit<BDRoute, "id">): Omit<BDRoute, "id"> {
  return {
    from: route.to,
    fromBn: route.toBn,
    to: route.from,
    toBn: route.fromBn,
    category: route.category,
    busTypes: [...route.busTypes],
    duration: route.duration,
    distance: route.distance,
    active: route.active,
  };
}

function generateAllRoutes(): BDRoute[] {
  const allRoutes: BDRoute[] = [];
  const addedRouteKeys = new Set<string>();

  for (const route of ONE_WAY_ROUTES) {
    const forwardId = generateRouteId(route.from, route.to);
    const reverseId = generateRouteId(route.to, route.from);

    if (!addedRouteKeys.has(forwardId)) {
      allRoutes.push({ ...route, id: forwardId });
      addedRouteKeys.add(forwardId);
    }

    if (!addedRouteKeys.has(reverseId)) {
      const reverseRoute = generateReverseRoute(route);
      allRoutes.push({ ...reverseRoute, id: reverseId });
      addedRouteKeys.add(reverseId);
    }
  }

  return allRoutes;
}

export const BD_ROUTES: BDRoute[] = generateAllRoutes();

export function getUniqueOrigins(): { en: string; bn: string }[] {
  const origins = new Map<string, string>();
  for (const route of BD_ROUTES) {
    if (!origins.has(route.from)) {
      origins.set(route.from, route.fromBn);
    }
    if (!origins.has(route.to)) {
      origins.set(route.to, route.toBn);
    }
  }
  return Array.from(origins.entries())
    .map(([en, bn]) => ({ en, bn }))
    .sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
}

export function getDestinationsForOrigin(origin: string): { en: string; bn: string }[] {
  if (!origin || origin.trim() === "") {
    return getUniqueOrigins();
  }
  
  const destinations = new Map<string, string>();
  const lowerOrigin = origin.toLowerCase();
  
  for (const route of BD_ROUTES) {
    const matchesOrigin =
      route.from.toLowerCase() === lowerOrigin ||
      route.fromBn === origin ||
      route.from.toLowerCase().includes(lowerOrigin) ||
      route.fromBn.includes(origin);
    
    if (matchesOrigin) {
      if (!destinations.has(route.to)) {
        destinations.set(route.to, route.toBn);
      }
    }
  }
  
  if (destinations.size === 0) {
    return getUniqueOrigins().filter(
      (city) =>
        city.en.toLowerCase() !== lowerOrigin && city.bn !== origin
    );
  }
  
  return Array.from(destinations.entries())
    .map(([en, bn]) => ({ en, bn }))
    .sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
}

export function getRouteDetails(origin: string, destination: string): BDRoute | undefined {
  return BD_ROUTES.find(
    (route) =>
      (route.from.toLowerCase() === origin.toLowerCase() || route.fromBn === origin) &&
      (route.to.toLowerCase() === destination.toLowerCase() || route.toBn === destination)
  );
}

export function getRoutesByCategory(category: "intercity" | "district" | "tourist"): BDRoute[] {
  return BD_ROUTES.filter((route) => route.category === category);
}

export function searchRoutes(query: string): BDRoute[] {
  const lowerQuery = query.toLowerCase();
  return BD_ROUTES.filter(
    (route) =>
      route.from.toLowerCase().includes(lowerQuery) ||
      route.to.toLowerCase().includes(lowerQuery) ||
      route.fromBn.includes(query) ||
      route.toBn.includes(query)
  );
}

export const ROUTE_STATS = {
  totalRoutes: BD_ROUTES.length,
  intercityRoutes: BD_ROUTES.filter((r) => r.category === "intercity").length,
  districtRoutes: BD_ROUTES.filter((r) => r.category === "district").length,
  touristRoutes: BD_ROUTES.filter((r) => r.category === "tourist").length,
};
