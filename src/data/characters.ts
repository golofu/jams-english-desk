export type CharacterId = 'jimmy' | 'sarah' | 'tanaka' | 'ben' | 'david' | 'raj';

export type Look = {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: 'side-part' | 'bob' | 'bun' | 'short' | 'slick' | 'wavy';
  eyes: string;
  shirt: string;
  collar: 'shirt-tie' | 'blouse' | 'blazer' | 'polo' | 'vest';
  glasses?: boolean;
  beard?: boolean;
  wrinkles?: boolean;
  earrings?: boolean;
  bg: [string, string];
};

export type Character = {
  id: CharacterId;
  name: string;
  roleTh: string;
  roleEn: string;
  voice: string; // Gemini prebuilt voice
  gender: 'male' | 'female'; // used to pick a browser voice in fallback mode
  persona: string;
  look: Look;
  phase: 1 | 2;
};

export const CHARACTERS: Record<CharacterId, Character> = {
  jimmy: {
    id: 'jimmy',
    name: 'Jimmy',
    roleTh: 'โค้ชประจำตัว',
    roleEn: 'Your coach',
    voice: 'Charon',
    gender: 'male',
    persona:
      'Jimmy, 50, a retired executive who worked 25 years in multinational companies in Singapore and Bangkok. Warm, patient, fatherly, a little funny. He teaches business etiquette as well as English and loves short real-life tips.',
    look: {
      skin: '#F2C7A5', skinShade: '#E0A988', hair: '#B9B4AE', hairStyle: 'side-part', eyes: '#5B4636',
      shirt: '#2F4A6D', collar: 'blazer', glasses: true, beard: true, wrinkles: true, bg: ['#FFE7C7', '#FFD3A1'],
    },
    phase: 1,
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah',
    roleTh: 'แขกที่มาพบ CEO',
    roleEn: 'Visitor',
    voice: 'Aoede',
    gender: 'female',
    persona: 'Sarah Miller, 34, an Australian marketing manager visiting the company. Friendly, chatty, relaxed.',
    look: {
      skin: '#F6D3BC', skinShade: '#E8B597', hair: '#D9A35B', hairStyle: 'wavy', eyes: '#3D6E8C',
      shirt: '#3BA6A0', collar: 'blouse', earrings: true, bg: ['#D9F3EE', '#B5E6DD'],
    },
    phase: 1,
  },
  tanaka: {
    id: 'tanaka',
    name: 'Ms. Tanaka',
    roleTh: 'ลูกค้าญี่ปุ่น',
    roleEn: 'Japanese client',
    voice: 'Kore',
    gender: 'female',
    persona:
      'Yuki Tanaka, 45, a Japanese client (purchasing director). Very polite and formal, speaks clearly with a light Japanese accent, appreciates punctuality and confirmation of details.',
    look: {
      skin: '#F3D2B5', skinShade: '#DDB291', hair: '#1F1B1A', hairStyle: 'bob', eyes: '#2E211B',
      shirt: '#5C5470', collar: 'blazer', bg: ['#EDE4FF', '#D7C8FA'],
    },
    phase: 1,
  },
  ben: {
    id: 'ben',
    name: 'Ben',
    roleTh: 'พนักงานโรงแรม / สายการบิน / ร้านอาหาร',
    roleEn: 'Service staff',
    voice: 'Puck',
    gender: 'male',
    persona:
      'Ben, 28, a cheerful customer-service agent. He plays the hotel receptionist, airline agent or restaurant host — whatever the scene needs. Efficient, asks for details one at a time.',
    look: {
      skin: '#C98E68', skinShade: '#B07752', hair: '#2B1D16', hairStyle: 'short', eyes: '#3A2A20',
      shirt: '#C8553D', collar: 'vest', bg: ['#FFE0D6', '#FFC6B4'],
    },
    phase: 1,
  },
  david: {
    id: 'david',
    name: 'Mr. David',
    roleTh: 'CEO ต่างชาติ',
    roleEn: 'Foreign CEO',
    voice: 'Orus',
    gender: 'male',
    persona: 'David Clarke, 52, a British CEO. Busy, speaks fast, gives short instructions.',
    look: {
      skin: '#F1CDB4', skinShade: '#DCAE8F', hair: '#6B4F3A', hairStyle: 'slick', eyes: '#4A6B4F',
      shirt: '#1E2A3A', collar: 'shirt-tie', bg: ['#E3ECF7', '#C7D7EE'],
    },
    phase: 2,
  },
  raj: {
    id: 'raj',
    name: 'Mr. Raj',
    roleTh: 'พาร์ทเนอร์อินเดีย',
    roleEn: 'Indian partner',
    voice: 'Fenrir',
    gender: 'male',
    persona: 'Raj Mehta, 40, an Indian business partner. Talkative, fast, warm, Indian English accent.',
    look: {
      skin: '#B57E5A', skinShade: '#9B6646', hair: '#151010', hairStyle: 'short', eyes: '#2A1B12',
      shirt: '#E2A33B', collar: 'polo', beard: true, bg: ['#FFF1D1', '#FFE09E'],
    },
    phase: 2,
  },
};
