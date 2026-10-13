import type { CharacterId } from './characters';

export type Phrase = { en: string; th: string };

export type Scenario = {
  id: string;
  level: number;
  titleTh: string;
  titleEn: string;
  situationTh: string; // shown to Jam before the call
  goalEn: string; // for the AI
  partnerRole: string; // who the partner plays in this scene
  opening: string; // partner's first line
  tasks: string[]; // checklist the evaluation uses
  keyPhrases: Phrase[];
  characters: CharacterId[]; // mixed rotation — any of these may appear
};

export type Level = {
  n: number;
  nameEn: string;
  nameTh: string;
  goalTh: string;
  available: boolean; // false = coming in release 2
};

export const LEVELS: Level[] = [
  { n: 1, nameEn: 'Confidence', nameTh: 'กล้าพูด', goalTh: 'คุยเรื่องทั่วไปได้ ไม่เกร็ง', available: true },
  { n: 2, nameEn: 'Front Desk', nameTh: 'หน้าห้อง CEO', goalTh: 'รับโทรศัพท์ ต้อนรับแขก จองเดินทาง', available: true },
  { n: 3, nameEn: "CEO's Right Hand", nameTh: 'มือขวา CEO', goalTh: 'นัดหมาย จัดตาราง รายงาน CEO', available: false },
  { n: 4, nameEn: 'Business Partner', nameTh: 'คู่คิดธุรกิจ', goalTh: 'ประสานลูกค้า ฟังประชุม สรุปงาน', available: false },
];

export const SCENARIOS: Scenario[] = [
  // ---------- Level 1: Confidence ----------
  {
    id: 'l1-intro', level: 1,
    titleTh: 'แนะนำตัวกับแขก', titleEn: 'Nice to meet you',
    situationTh: 'แขกต่างชาติมาถึงหน้าห้อง CEO แจมแนะนำตัวและทักทาย',
    goalEn: 'Introduce herself, say her role, and ask the guest one friendly question.',
    partnerRole: 'a visitor who just arrived at the CEO office',
    opening: "Hi there! I'm here to see your CEO. I'm a bit early, I think.",
    tasks: ['Greet the guest', 'Say her name and job', 'Ask one friendly question'],
    keyPhrases: [
      { en: 'Good morning. Welcome to GoDigit.', th: 'สวัสดีตอนเช้าค่ะ ยินดีต้อนรับสู่ GoDigit' },
      { en: "My name is Jam. I'm the CEO's assistant.", th: 'ดิฉันชื่อแจม เป็นผู้ช่วย CEO ค่ะ' },
      { en: 'Nice to meet you.', th: 'ยินดีที่ได้รู้จักค่ะ' },
      { en: 'How was your trip here?', th: 'เดินทางมาเป็นอย่างไรบ้างคะ' },
    ],
    characters: ['sarah', 'tanaka'],
  },
  {
    id: 'l1-weekend', level: 1,
    titleTh: 'คุยเรื่องวันหยุด', titleEn: 'How was your weekend?',
    situationTh: 'เช้าวันจันทร์ คุยเล่นเรื่องวันหยุดสุดสัปดาห์',
    goalEn: 'Talk about what she did at the weekend in 2-3 simple sentences and ask back.',
    partnerRole: 'a friendly colleague-like visitor making small talk',
    opening: 'Morning, Jam! How was your weekend?',
    tasks: ['Say what she did', 'Give one detail (where / with who)', 'Ask the partner back'],
    keyPhrases: [
      { en: 'It was great, thank you.', th: 'ดีมากค่ะ ขอบคุณค่ะ' },
      { en: 'I stayed home and relaxed.', th: 'อยู่บ้านพักผ่อนค่ะ' },
      { en: 'I went to the market with my family.', th: 'ไปตลาดกับครอบครัวค่ะ' },
      { en: 'How about you?', th: 'แล้วคุณล่ะคะ' },
    ],
    characters: ['sarah', 'ben'],
  },
  {
    id: 'l1-waiting', level: 1,
    titleTh: 'Small talk ระหว่างแขกรอ', titleEn: 'While you wait',
    situationTh: 'แขกรอ CEO อยู่ 5 นาที แจมชวนคุยเรื่องอากาศและรถติด',
    goalEn: 'Keep a light conversation going about weather or traffic for a few turns.',
    partnerRole: 'a visitor waiting for the CEO',
    opening: "Wow, it's really hot outside today!",
    tasks: ['Agree / react naturally', 'Talk about weather or traffic', 'Tell the guest the CEO will be ready soon'],
    keyPhrases: [
      { en: "Yes, it's very hot today.", th: 'ใช่ค่ะ วันนี้ร้อนมาก' },
      { en: 'Was the traffic bad?', th: 'รถติดไหมคะ' },
      { en: 'The rainy season is almost over.', th: 'หน้าฝนใกล้จะหมดแล้วค่ะ' },
      { en: 'Our CEO will be with you in five minutes.', th: 'CEO จะมาพบคุณในอีก 5 นาทีค่ะ' },
    ],
    characters: ['sarah', 'tanaka'],
  },
  {
    id: 'l1-drinks', level: 1,
    titleTh: 'เสิร์ฟเครื่องดื่มแขก', titleEn: 'Coffee or tea?',
    situationTh: 'ถามแขกว่าจะรับเครื่องดื่มอะไร',
    goalEn: 'Offer drinks politely, ask about sugar/milk, and confirm.',
    partnerRole: 'a guest sitting in the meeting room',
    opening: 'Thank you for having me.',
    tasks: ['Offer drinks', 'Ask a follow-up (hot/cold, sugar, milk)', 'Confirm the order'],
    keyPhrases: [
      { en: 'Would you like something to drink?', th: 'รับเครื่องดื่มอะไรดีคะ' },
      { en: 'We have coffee, tea, or water.', th: 'มีกาแฟ ชา หรือน้ำเปล่าค่ะ' },
      { en: 'Hot or iced?', th: 'ร้อนหรือเย็นคะ' },
      { en: "Sure, I'll bring it right away.", th: 'ได้ค่ะ เดี๋ยวนำมาให้เลยค่ะ' },
    ],
    characters: ['tanaka', 'sarah', 'ben'],
  },
  {
    id: 'l1-hometown', level: 1,
    titleTh: 'คุยเรื่องบ้านเกิด', titleEn: 'Where are you from?',
    situationTh: 'แขกถามว่าแจมเป็นคนที่ไหน และเล่าเรื่องประเทศของเขา',
    goalEn: 'Say where she is from with one detail, and ask about the partner\'s country.',
    partnerRole: 'a visitor curious about Thailand',
    opening: 'So, Jam, are you from Bangkok?',
    tasks: ['Say where she is from', 'Describe it in one sentence', 'Ask about the partner\'s country'],
    keyPhrases: [
      { en: "I'm from Chiang Mai, in the north of Thailand.", th: 'ดิฉันมาจากเชียงใหม่ ทางเหนือของไทยค่ะ' },
      { en: "It's a quiet city with beautiful mountains.", th: 'เป็นเมืองเงียบๆ มีภูเขาสวยค่ะ' },
      { en: 'Have you been to Thailand before?', th: 'เคยมาเมืองไทยไหมคะ' },
      { en: 'What is your hometown like?', th: 'บ้านเกิดคุณเป็นอย่างไรบ้างคะ' },
    ],
    characters: ['tanaka', 'sarah'],
  },
  {
    id: 'l1-food', level: 1,
    titleTh: 'แนะนำร้านอาหาร', titleEn: 'Any good food nearby?',
    situationTh: 'แขกขอคำแนะนำร้านอาหารแถวออฟฟิศ',
    goalEn: 'Recommend a Thai dish or restaurant and explain simply why.',
    partnerRole: 'a hungry visitor asking for lunch ideas',
    opening: "I'm starving! Is there any good food near here?",
    tasks: ['Recommend a place or dish', 'Explain one reason', 'Mention spicy / not spicy or distance'],
    keyPhrases: [
      { en: 'There is a good noodle shop near here.', th: 'มีร้านก๋วยเตี๋ยวอร่อยใกล้ๆ นี้ค่ะ' },
      { en: "It's about five minutes on foot.", th: 'เดินไปประมาณ 5 นาทีค่ะ' },
      { en: 'Do you like spicy food?', th: 'ทานเผ็ดได้ไหมคะ' },
      { en: 'I recommend the green curry.', th: 'แนะนำแกงเขียวหวานค่ะ' },
    ],
    characters: ['sarah', 'ben', 'tanaka'],
  },

  // ---------- Level 2: Front Desk ----------
  {
    id: 'l2-answer', level: 2,
    titleTh: 'รับโทรศัพท์', titleEn: 'Answering the phone',
    situationTh: 'มีสายเข้าห้อง CEO แจมรับสาย ถามชื่อและธุระของผู้โทร',
    goalEn: 'Answer professionally, get the caller\'s name and reason for calling, and put them on hold politely.',
    partnerRole: 'a caller who wants to speak to the CEO',
    opening: '(phone rings) ... Hello?',
    tasks: ['Answer with company + her name', "Ask the caller's name", 'Ask the reason for the call', 'Ask them to hold'],
    keyPhrases: [
      { en: "Good afternoon, GoDigit, CEO's office. Jam speaking.", th: 'สวัสดีค่ะ GoDigit ห้อง CEO แจมพูดค่ะ' },
      { en: "May I ask who's calling, please?", th: 'ขอทราบชื่อผู้โทรได้ไหมคะ' },
      { en: 'May I ask what it is about?', th: 'ขอทราบเรื่องที่ติดต่อได้ไหมคะ' },
      { en: 'One moment, please. Please hold.', th: 'สักครู่นะคะ กรุณาถือสายรอค่ะ' },
    ],
    characters: ['tanaka', 'sarah'],
  },
  {
    id: 'l2-message', level: 2,
    titleTh: 'รับฝากข้อความ', titleEn: 'Taking a message',
    situationTh: 'CEO ติดประชุม ผู้โทรขอฝากข้อความ แจมต้องจดชื่อ บริษัท เบอร์ และเรื่อง แล้วทวนกลับ',
    goalEn: 'Explain the CEO is unavailable, take a full message (name, company, number, reason) and read it back.',
    partnerRole: 'a caller who wants to leave a message for the CEO',
    opening: 'Hello, could I speak to your CEO, please?',
    tasks: ['Say the CEO is in a meeting', 'Get name + company', 'Get phone number', 'Read the message back'],
    keyPhrases: [
      { en: "I'm sorry, he's in a meeting right now.", th: 'ขออภัยค่ะ ตอนนี้ท่านติดประชุมอยู่ค่ะ' },
      { en: 'Would you like to leave a message?', th: 'ต้องการฝากข้อความไว้ไหมคะ' },
      { en: 'Could you spell your name, please?', th: 'ช่วยสะกดชื่อให้หน่อยได้ไหมคะ' },
      { en: 'Let me read that back to you.', th: 'ขอทวนข้อความนะคะ' },
      { en: "I'll make sure he gets your message.", th: 'จะแจ้งท่านให้แน่นอนค่ะ' },
    ],
    characters: ['tanaka', 'sarah', 'ben'],
  },
  {
    id: 'l2-welcome', level: 2,
    titleTh: 'ต้อนรับแขกที่นัดไว้', titleEn: 'Welcoming a visitor',
    situationTh: 'แขกมาตามนัด 10 โมง แจมต้อนรับ ยืนยันนัด และพาไปห้องประชุม',
    goalEn: 'Welcome the visitor, confirm the appointment, offer a drink, and guide them to the meeting room.',
    partnerRole: 'a visitor arriving for a 10 a.m. meeting with the CEO',
    opening: "Hello, I have a meeting with your CEO at ten o'clock.",
    tasks: ['Welcome and confirm the appointment', 'Ask them to follow / wait', 'Offer a drink', 'Say the CEO is coming'],
    keyPhrases: [
      { en: 'Welcome! May I have your name, please?', th: 'ยินดีต้อนรับค่ะ ขอทราบชื่อได้ไหมคะ' },
      { en: "Yes, we're expecting you.", th: 'ค่ะ เรารอคุณอยู่ค่ะ' },
      { en: 'Please follow me to the meeting room.', th: 'เชิญตามดิฉันไปห้องประชุมค่ะ' },
      { en: 'Please have a seat.', th: 'เชิญนั่งค่ะ' },
    ],
    characters: ['tanaka', 'sarah'],
  },
  {
    id: 'l2-late', level: 2,
    titleTh: 'CEO มาช้า ต้องขอโทษแขก', titleEn: 'The CEO is running late',
    situationTh: 'CEO ติดธุระ จะมาช้า 15 นาที แจมต้องขอโทษแขกและเสนอทางเลือก',
    goalEn: 'Apologize politely, give the new time, and offer options (wait, drink, Wi-Fi, reschedule).',
    partnerRole: 'a visitor whose meeting is delayed (a bit worried about time)',
    opening: "Excuse me, it's already ten. Is the CEO coming?",
    tasks: ['Apologize', 'Say how long the delay is', 'Offer something while waiting', 'Offer to reschedule if needed'],
    keyPhrases: [
      { en: "I'm so sorry for the wait.", th: 'ขอโทษที่ให้รอนะคะ' },
      { en: 'He is running about fifteen minutes late.', th: 'ท่านจะมาช้าประมาณ 15 นาทีค่ะ' },
      { en: 'Can I get you anything while you wait?', th: 'ระหว่างรอ รับอะไรเพิ่มไหมคะ' },
      { en: 'Here is the Wi-Fi password.', th: 'นี่คือรหัส Wi-Fi ค่ะ' },
      { en: 'Would you prefer to reschedule?', th: 'สะดวกเลื่อนนัดเป็นวันอื่นไหมคะ' },
    ],
    characters: ['sarah', 'tanaka'],
  },
  {
    id: 'l2-hotel', level: 2,
    titleTh: 'จองโรงแรมให้ CEO', titleEn: 'Booking a hotel',
    situationTh: 'โทรจองโรงแรมที่สิงคโปร์ให้ CEO 2 คืน ห้องเดี่ยว ต้องถามราคาและอาหารเช้า',
    goalEn: 'Book a single room for two nights, ask the price and whether breakfast is included, and confirm.',
    partnerRole: 'a hotel receptionist in Singapore',
    opening: 'Good morning, Marina Bay Grand Hotel. How can I help you?',
    tasks: ['Say she wants to book a room', 'Give dates / nights / room type', 'Ask price + breakfast', 'Confirm the booking'],
    keyPhrases: [
      { en: "I'd like to book a room, please.", th: 'ต้องการจองห้องพักค่ะ' },
      { en: 'A single room for two nights, from the 5th to the 7th.', th: 'ห้องเดี่ยว 2 คืน วันที่ 5 ถึง 7 ค่ะ' },
      { en: 'How much is it per night?', th: 'คืนละเท่าไหร่คะ' },
      { en: 'Is breakfast included?', th: 'รวมอาหารเช้าไหมคะ' },
      { en: 'Could you send the confirmation by email?', th: 'ช่วยส่งยืนยันทางอีเมลได้ไหมคะ' },
    ],
    characters: ['ben'],
  },
  {
    id: 'l2-flight', level: 2,
    titleTh: 'เลื่อนเที่ยวบิน', titleEn: 'Changing a flight',
    situationTh: 'CEO ต้องเลื่อนเที่ยวบินกลับเป็นวันถัดไป แจมโทรติดต่อสายการบิน',
    goalEn: 'Change the CEO\'s flight to the next day, ask about the fee, and choose a time.',
    partnerRole: 'an airline customer-service agent',
    opening: 'Thank you for calling Sky Asia Airlines. May I have your booking reference?',
    tasks: ['Give the booking reference', 'Ask to change to the next day', 'Ask about the fee', 'Choose and confirm a flight time'],
    keyPhrases: [
      { en: 'The booking reference is A-B-7-2-K.', th: 'รหัสการจองคือ A-B-7-2-K ค่ะ' },
      { en: "I'd like to change the flight to tomorrow.", th: 'ต้องการเลื่อนเที่ยวบินเป็นพรุ่งนี้ค่ะ' },
      { en: 'Is there a change fee?', th: 'มีค่าธรรมเนียมเปลี่ยนไหมคะ' },
      { en: 'The morning flight is better, please.', th: 'ขอเป็นเที่ยวบินตอนเช้าค่ะ' },
    ],
    characters: ['ben'],
  },
  {
    id: 'l2-dinner', level: 2,
    titleTh: 'จองร้านอาหารเลี้ยงลูกค้า', titleEn: 'Business dinner booking',
    situationTh: 'จองโต๊ะ 6 ที่ วันศุกร์ 1 ทุ่ม สำหรับ CEO เลี้ยงลูกค้า ขอห้องส่วนตัว และแจ้งว่ามีคนทานมังสวิรัติ',
    goalEn: 'Reserve a table for six on Friday at 7 p.m., ask for a private room, and mention a vegetarian guest.',
    partnerRole: 'a restaurant host taking reservations',
    opening: 'Good afternoon, Saffron Restaurant. How may I help you?',
    tasks: ['Give day, time, number of people', 'Ask for a private room', 'Mention dietary needs', 'Give a name for the booking'],
    keyPhrases: [
      { en: "I'd like to reserve a table for six.", th: 'ต้องการจองโต๊ะ 6 ที่ค่ะ' },
      { en: "This Friday at seven o'clock.", th: 'วันศุกร์นี้ 1 ทุ่มค่ะ' },
      { en: 'Do you have a private room?', th: 'มีห้องส่วนตัวไหมคะ' },
      { en: 'One guest is vegetarian.', th: 'มีแขกหนึ่งท่านทานมังสวิรัติค่ะ' },
      { en: 'The reservation is under GoDigit.', th: 'จองในนามบริษัท GoDigit ค่ะ' },
    ],
    characters: ['ben'],
  },
  {
    id: 'l2-directions', level: 2,
    titleTh: 'บอกทางในออฟฟิศ', titleEn: 'Giving directions',
    situationTh: 'แขกถามทางไปห้องน้ำและห้องประชุมชั้น 12',
    goalEn: 'Give simple directions inside the building using left/right/floor/next to.',
    partnerRole: 'a visitor who is lost in the office',
    opening: 'Sorry, where is the restroom? And the meeting room on twelve?',
    tasks: ['Give directions to the restroom', 'Explain how to get to floor 12', 'Offer to walk them there'],
    keyPhrases: [
      { en: 'Go straight and turn left.', th: 'ตรงไปแล้วเลี้ยวซ้ายค่ะ' },
      { en: "It's next to the elevator.", th: 'อยู่ข้างลิฟต์ค่ะ' },
      { en: 'Take the elevator to the twelfth floor.', th: 'ขึ้นลิฟต์ไปชั้น 12 ค่ะ' },
      { en: 'Let me show you the way.', th: 'เดี๋ยวพาไปค่ะ' },
    ],
    characters: ['sarah', 'tanaka', 'ben'],
  },
];

export const JIMMY_TOPICS: { en: string; th: string }[] = [
  { en: 'How did you sleep, and what did you have for breakfast?', th: 'นอนหลับดีไหม เช้านี้กินอะไร' },
  { en: 'What is one thing you want to finish at work today?', th: 'วันนี้อยากทำงานอะไรให้เสร็จสักอย่าง' },
  { en: 'What did you do yesterday evening?', th: 'เมื่อวานตอนเย็นทำอะไร' },
  { en: 'Tell me about your favourite Thai food.', th: 'เล่าเรื่องอาหารไทยที่ชอบ' },
  { en: 'What do you like most about your job?', th: 'ชอบอะไรที่สุดในงานเลขา' },
  { en: 'Where would you like to travel next?', th: 'อยากไปเที่ยวที่ไหนต่อ' },
  { en: 'How do you get to work every day?', th: 'เดินทางไปทำงานยังไง' },
  { en: 'What did you do last weekend?', th: 'สุดสัปดาห์ที่แล้วทำอะไร' },
  { en: 'What is the busiest part of your day?', th: 'ช่วงไหนของวันที่ยุ่งที่สุด' },
  { en: 'Tell me about someone in your family.', th: 'เล่าเรื่องคนในครอบครัวสักคน' },
];

export const SNAPSHOT_PROMPTS = [
  { th: 'แนะนำตัวเอง ชื่ออะไร ทำงานที่ไหน', en: 'Please introduce yourself.' },
  { th: 'เล่าว่างานเลขา CEO ต้องทำอะไรบ้างในหนึ่งวัน', en: 'What do you do in a normal workday?' },
  { th: 'วันหยุดชอบทำอะไร เพราะอะไร', en: 'What do you like to do on your days off?' },
];
