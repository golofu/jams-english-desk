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
      { en: 'Good morning. Welcome to GoDigit.', th: 'สวัสดีค่ะ ยินดีต้อนรับสู่ GoDigit ค่ะ' },
      { en: "My name is Jam. I'm the CEO's assistant.", th: 'ดิฉันชื่อแจม เป็นผู้ช่วย CEO ค่ะ' },
      { en: 'Nice to meet you.', th: 'ยินดีที่ได้รู้จักค่ะ' },
      { en: 'How was your trip here?', th: 'เดินทางมาเป็นอย่างไรบ้างคะ' },
    ],
    characters: ['sarah', 'tanaka'],
  },
  {
    id: 'l1-cards', level: 1,
    titleTh: 'แลกนามบัตร ถามเรื่องงานของแขก', titleEn: 'Exchanging business cards',
    situationTh: 'แขกจากบริษัทคู่ค้ามาถึง แจมแลกนามบัตรและถามว่าแขกมาจากบริษัทไหน ตำแหน่งอะไร',
    goalEn: 'Exchange business cards politely and ask about the guest\'s company and position.',
    partnerRole: 'a visitor from a partner company, holding out a business card',
    opening: "Hello, I'm from a partner company. Here is my business card.",
    tasks: ['Receive the card politely', 'Give her own card', 'Ask about the guest\'s company or position'],
    keyPhrases: [
      { en: 'Thank you. Here is my business card.', th: 'ขอบคุณค่ะ นี่นามบัตรของดิฉันค่ะ' },
      { en: 'Which company are you with?', th: 'คุณมาจากบริษัทไหนคะ' },
      { en: 'What is your position?', th: 'คุณดำรงตำแหน่งอะไรคะ' },
      { en: 'Please contact me if you need anything.', th: 'หากต้องการอะไร ติดต่อดิฉันได้เลยค่ะ' },
    ],
    characters: ['sarah', 'tanaka'],
  },
  {
    id: 'l1-waiting', level: 1,
    titleTh: 'ดูแลแขกระหว่างรอประชุม', titleEn: 'Before the meeting starts',
    situationTh: 'แขกมาก่อนเวลาประชุม แจมพาไปนั่งรอ ชวนคุยเรื่องการเดินทางมาบริษัท และแจ้งว่า CEO จะมาเมื่อไร',
    goalEn: 'Look after an early guest: offer a seat, ask about the trip to the office, and say when the CEO will join.',
    partnerRole: 'a business visitor who arrived early for a meeting with the CEO',
    opening: "Hi, I'm a little early for my meeting with your CEO.",
    tasks: ['Offer a seat', 'Ask about the trip to the office', 'Tell the guest when the CEO will join'],
    keyPhrases: [
      { en: 'No problem. Please have a seat.', th: 'ไม่เป็นไรค่ะ เชิญนั่งก่อนค่ะ' },
      { en: 'Did you find our office easily?', th: 'หาออฟฟิศเจอง่ายไหมคะ' },
      { en: 'Our CEO will be with you in five minutes.', th: 'CEO จะมาพบคุณในอีก 5 นาทีค่ะ' },
      { en: 'Here is the Wi-Fi password, if you need it.', th: 'นี่รหัส Wi-Fi ค่ะ เผื่อต้องใช้' },
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
    characters: ['tanaka', 'sarah'],
  },
  {
    id: 'l1-company', level: 1,
    titleTh: 'แนะนำบริษัทให้แขกฟัง', titleEn: 'About our company',
    situationTh: 'แขกถามว่า GoDigit ทำธุรกิจอะไร และแผนกของแจมทำอะไร (ใช้คำกลางๆ ไม่ต้องบอกข้อมูลจริงที่เป็นความลับ)',
    goalEn: 'Describe the company and her own role in simple, general terms, and ask about the guest\'s business.',
    partnerRole: 'a visitor curious about GoDigit before the meeting',
    opening: 'So, tell me a little about GoDigit. What does the company do?',
    tasks: ['Say what the company does in one or two sentences', 'Explain her role', 'Ask about the guest\'s business'],
    keyPhrases: [
      { en: 'GoDigit is a digital company.', th: 'GoDigit เป็นบริษัทด้านดิจิทัลค่ะ' },
      { en: 'We work with clients in many industries.', th: 'เราทำงานกับลูกค้าในหลายอุตสาหกรรมค่ะ' },
      { en: "I support our CEO with schedules and meetings.", th: 'ดิฉันดูแลตารางงานและการประชุมให้ CEO ค่ะ' },
      { en: 'What kind of business are you in?', th: 'คุณทำธุรกิจด้านไหนคะ' },
    ],
    characters: ['tanaka', 'sarah'],
  },
  {
    id: 'l1-confirm', level: 1,
    titleTh: 'แจ้งรายละเอียดการประชุม', titleEn: 'Meeting details',
    situationTh: 'แขกถามรายละเอียดการประชุมวันนี้ แจมบอกเวลา ห้อง ระยะเวลา และถามว่าต้องเตรียมอะไรเพิ่มไหม',
    goalEn: 'Give the meeting time, room and length clearly, and offer help with anything the guest needs (projector, documents).',
    partnerRole: 'a client checking the details of today\'s meeting',
    opening: 'Can you remind me of the details for today\'s meeting?',
    tasks: ['Say the time and room', 'Say how long it will take', 'Offer help with something for the meeting'],
    keyPhrases: [
      { en: 'Your meeting is at 2 p.m. in Meeting Room A.', th: 'การประชุมของคุณเวลาบ่ายสองโมงที่ห้องประชุม A ค่ะ' },
      { en: 'It will take about one hour.', th: 'ใช้เวลาประมาณหนึ่งชั่วโมงค่ะ' },
      { en: 'Do you need a projector for your presentation?', th: 'ต้องใช้โปรเจกเตอร์สำหรับนำเสนอไหมคะ' },
      { en: 'I will print the documents for you.', th: 'ดิฉันจะพิมพ์เอกสารให้นะคะ' },
    ],
    characters: ['tanaka', 'sarah'],
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
      { en: "Good afternoon, GoDigit, CEO's office. Jam speaking.", th: 'สวัสดีค่ะ GoDigit ห้อง CEO แจมรับสายค่ะ' },
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
    characters: ['tanaka', 'sarah'],
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
      { en: "I'd prefer the morning flight, please.", th: 'ขอเป็นเที่ยวบินตอนเช้าค่ะ' },
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
    characters: ['sarah', 'tanaka'],
  },
];

export const JIMMY_TOPICS: { en: string; th: string; monday?: boolean }[] = [
  { en: "What is on your schedule at work today?", th: 'วันนี้มีงานอะไรบ้าง' },
  { en: "What is one task you must finish today?", th: 'งานที่ต้องทำให้เสร็จวันนี้' },
  { en: "How do you prepare the room before an important meeting?", th: 'เตรียมห้องก่อนประชุมสำคัญยังไง' },
  { en: "How do you welcome a guest who visits the CEO?", th: 'ต้อนรับแขกที่มาพบ CEO ยังไง' },
  { en: "How do you answer an important phone call for the CEO?", th: 'รับสายสำคัญแทน CEO ยังไง' },
  { en: 'How do you get ready when a client comes to meet the CEO?', th: 'เตรียมตัวยังไงเมื่อลูกค้ามาพบ CEO' },
  { en: "What is the most difficult part of your job, and how do you handle it?", th: 'งานส่วนไหนยากที่สุด และรับมือยังไง' },
  { en: "What is on the CEO's calendar this week?", th: 'สัปดาห์นี้ CEO มีนัดอะไรบ้าง', monday: true },
  { en: "How do you write a short email to reschedule a meeting?", th: 'เขียนอีเมลสั้นๆ ขอเลื่อนนัดยังไง' },
  { en: "What did you learn at work yesterday?", th: 'เมื่อวานได้เรียนรู้อะไรจากงาน' },
];

export const SNAPSHOT_PROMPTS = [
  { th: 'แนะนำตัวเอง ชื่ออะไร ทำงานที่ไหน', en: 'Please introduce yourself.' },
  { th: 'เล่าว่างานเลขา CEO ต้องทำอะไรบ้างในหนึ่งวัน', en: 'What do you do in a normal workday?' },
  { th: 'เล่าว่าบริษัทของเราทำอะไร และแจมดูแลงานอะไร', en: 'Tell me about your company and your role.' },
];
