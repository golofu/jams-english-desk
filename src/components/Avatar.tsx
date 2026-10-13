import { useEffect, useId, useRef, useState } from 'react';
import type { Character } from '../data/characters';
import type { AvatarStyle } from '../lib/store';

type Props = {
  character: Character;
  style: AvatarStyle;
  /** Returns mouth openness 0..1 (read every frame). */
  level?: () => number;
  state?: 'idle' | 'listening' | 'speaking' | 'thinking' | 'connecting' | 'ended';
  size?: number;
  /** Accessible name, e.g. the coach's custom name. */
  label?: string;
};

// Per-style proportions: same character, three looks.
const STYLE = {
  pixar: { headRx: 64, headRy: 70, eyeRx: 13, eyeRy: 14.5, iris: 8.5, eyeY: 104, eyeDx: 24, shade: 0.5, outline: 0, chin: 0 },
  anime: { headRx: 57, headRy: 64, eyeRx: 12, eyeRy: 17, iris: 9.5, eyeY: 108, eyeDx: 22, shade: 0.15, outline: 1.6, chin: 10 },
  real: { headRx: 53, headRy: 67, eyeRx: 9, eyeRy: 6.5, iris: 5, eyeY: 102, eyeDx: 21, shade: 0.75, outline: 0, chin: 4 },
} as const;

export function Avatar({ character, style, level, state = 'idle', size = 260, label }: Props) {
  const L = character.look;
  const S = STYLE[style];
  const id = useId().replace(/:/g, '');
  const [t, setT] = useState(0);
  const [open, setOpen] = useState(0);
  const [blink, setBlink] = useState(1);
  const smooth = useRef(0);

  useEffect(() => {
    let raf = 0;
    let nextBlink = performance.now() + 2000;
    let blinkStart = 0;
    let last = 0;
    // Battery: 3 state updates per frame on several avatars heats a phone over a 20-minute call.
    // Lip-sync needs ~30 fps; an idle avatar (no audio level) is fine at ~15 fps.
    const frameMs = level ? 33 : 66;
    const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < frameMs) return;
      last = now;
      const target = level ? level() : 0;
      // Fast attack, slower release reads as natural speech.
      smooth.current += (target - smooth.current) * (target > smooth.current ? 0.6 : 0.25);
      setOpen(smooth.current < 0.03 ? 0 : smooth.current);
      if (now > nextBlink) {
        blinkStart = now;
        nextBlink = now + 2500 + Math.random() * 3500;
      }
      const b = now - blinkStart;
      setBlink(b < 160 ? Math.abs(1 - b / 80) : 1);
      if (!still) setT(now / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [level]);

  const talking = open > 0;
  const listening = state === 'listening';
  const tilt = Math.sin(t * 0.8) * 2 + (listening ? Math.sin(t * 1.6) * 1.5 : 0) + (talking ? Math.sin(t * 6) * 0.8 : 0);
  const bob = Math.sin(t * 1.2) * 1.5 + (talking ? open * 2 : 0);
  const brow = talking ? open * 3 : listening ? 1.5 : 0;
  const lookX = state === 'thinking' ? 3 : Math.sin(t * 0.37) * 1.2;
  const lookY = state === 'thinking' ? -3 : 0;

  const mouthH = 2 + open * 15;
  const mouthW = 20 - open * 3;
  const cx = 100;
  const eyeY = S.eyeY;
  const mouthY = eyeY + 40 + S.chin * 0.3;

  const stroke = S.outline ? { stroke: '#3a2a22', strokeWidth: S.outline } : {};

  return (
    <svg viewBox="0 0 200 230" width={size} height={size * 1.15} role="img" aria-label={label ?? character.name} className="avatar-svg">
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={L.bg[0]} />
          <stop offset="100%" stopColor={L.bg[1]} />
        </radialGradient>
        <radialGradient id={`skin${id}`} cx="45%" cy="38%" r="70%">
          <stop offset="0%" stopColor={L.skin} />
          <stop offset="100%" stopColor={S.shade > 0.3 ? L.skinShade : L.skin} />
        </radialGradient>
        <linearGradient id={`shirt${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={L.shirt} />
          <stop offset="100%" stopColor={shadeHex(L.shirt, -0.25)} />
        </linearGradient>
        <clipPath id={`frame${id}`}>
          <circle cx="100" cy="115" r="100" />
        </clipPath>
      </defs>

      <g clipPath={`url(#frame${id})`}>
        <circle cx="100" cy="115" r="100" fill={`url(#bg${id})`} />

        {/* Body */}
        <g transform={`translate(0 ${bob * 0.4})`}>
          <path d="M20 240 C 22 192, 55 178, 100 176 C 145 178, 178 192, 180 240 Z" fill={`url(#shirt${id})`} {...stroke} />
          <Collar kind={L.collar} color={L.shirt} />
          <path d={`M84 160 L84 ${178} Q100 188 116 178 L116 160 Z`} fill={L.skinShade} />
        </g>

        {/* Head */}
        <g transform={`translate(0 ${bob}) rotate(${tilt} 100 150)`}>
          <HairBack style={L.hairStyle} color={L.hair} S={S} />
          {/* Ears */}
          <ellipse cx={cx - S.headRx + 2} cy={eyeY + 6} rx="8" ry="11" fill={L.skinShade} {...stroke} />
          <ellipse cx={cx + S.headRx - 2} cy={eyeY + 6} rx="8" ry="11" fill={L.skinShade} {...stroke} />
          {L.earrings && (
            <>
              <circle cx={cx - S.headRx + 2} cy={eyeY + 19} r="3" fill="#F5C542" />
              <circle cx={cx + S.headRx - 2} cy={eyeY + 19} r="3" fill="#F5C542" />
            </>
          )}
          {/* Face */}
          <path d={facePath(S)} fill={`url(#skin${id})`} {...stroke} />
          {/* Cheeks */}
          <ellipse cx={cx - 32} cy={eyeY + 26} rx="9" ry="5.5" fill="#FF8A80" opacity={style === 'real' ? 0.12 : 0.28} />
          <ellipse cx={cx + 32} cy={eyeY + 26} rx="9" ry="5.5" fill="#FF8A80" opacity={style === 'real' ? 0.12 : 0.28} />

          {L.beard && <path d={beardPath(S, mouthY)} fill={L.hair} opacity={0.55} />}

          {/* Eyes */}
          {[-1, 1].map((side) => {
            const ex = cx + side * S.eyeDx;
            return (
              <g key={side} transform={`translate(${ex} ${eyeY}) scale(1 ${blink}) translate(${-ex} ${-eyeY})`}>
                <ellipse cx={ex} cy={eyeY} rx={S.eyeRx} ry={S.eyeRy} fill="#fff" {...stroke} />
                <circle cx={ex + lookX} cy={eyeY + 1 + lookY} r={S.iris} fill={L.eyes} />
                <circle cx={ex + lookX} cy={eyeY + 1 + lookY} r={S.iris * 0.5} fill="#1b1310" />
                <circle cx={ex + lookX + S.iris * 0.35} cy={eyeY - S.iris * 0.35 + lookY} r={S.iris * 0.3} fill="#fff" />
                {style === 'anime' && <circle cx={ex + lookX - 3} cy={eyeY + 5 + lookY} r="1.6" fill="#fff" opacity="0.8" />}
              </g>
            );
          })}
          {style === 'real' &&
            [-1, 1].map((side) => (
              <path key={side} d={`M${cx + side * S.eyeDx - 11} ${eyeY - 4} Q${cx + side * S.eyeDx} ${eyeY - 10} ${cx + side * S.eyeDx + 11} ${eyeY - 4}`} stroke={L.skinShade} strokeWidth="2" fill="none" />
            ))}
          {L.wrinkles &&
            [-1, 1].map((side) => (
              <path key={side} d={`M${cx + side * (S.eyeDx + S.eyeRx + 3)} ${eyeY - 2} l${side * 5} -2 M${cx + side * (S.eyeDx + S.eyeRx + 3)} ${eyeY + 3} l${side * 5} 2`} stroke={L.skinShade} strokeWidth="1.4" strokeLinecap="round" />
            ))}

          {/* Brows */}
          {[-1, 1].map((side) => {
            const bx = cx + side * S.eyeDx;
            const by = eyeY - S.eyeRy - 7 - brow;
            return (
              <path key={side} d={`M${bx - 11} ${by + 3} Q${bx} ${by - 4} ${bx + 11} ${by + 2}`} stroke={shadeHex(L.hair, -0.2)} strokeWidth={style === 'anime' ? 2.4 : 4} strokeLinecap="round" fill="none" />
            );
          })}

          {L.glasses && (
            <g fill="none" stroke="#3b3b3b" strokeWidth="2.6">
              <rect x={cx - S.eyeDx - S.eyeRx - 4} y={eyeY - S.eyeRy - 2} width={(S.eyeRx + 4) * 2} height={S.eyeRy * 2 + 4} rx="8" fill="#ffffff22" />
              <rect x={cx + S.eyeDx - S.eyeRx - 4} y={eyeY - S.eyeRy - 2} width={(S.eyeRx + 4) * 2} height={S.eyeRy * 2 + 4} rx="8" fill="#ffffff22" />
              <path d={`M${cx - S.eyeDx + S.eyeRx + 4} ${eyeY - 3} Q${cx} ${eyeY - 8} ${cx + S.eyeDx - S.eyeRx - 4} ${eyeY - 3}`} />
            </g>
          )}

          {/* Nose */}
          <path d={`M${cx - 4} ${eyeY + 22} Q${cx} ${eyeY + 27} ${cx + 4} ${eyeY + 22}`} stroke={L.skinShade} strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Mouth */}
          {talking ? (
            <g>
              <ellipse cx={cx} cy={mouthY} rx={mouthW / 2} ry={mouthH / 2} fill="#5a2324" />
              {mouthH > 7 && <rect x={cx - mouthW / 2 + 3} y={mouthY - mouthH / 2} width={mouthW - 6} height={Math.min(4, mouthH / 4)} rx="2" fill="#fff" />}
              {mouthH > 9 && <ellipse cx={cx} cy={mouthY + mouthH / 2 - 3} rx={mouthW / 3.2} ry={2.6} fill="#e57373" />}
            </g>
          ) : (
            <path d={`M${cx - 11} ${mouthY - 2} Q${cx} ${mouthY + (listening ? 8 : 6)} ${cx + 11} ${mouthY - 2}`} stroke="#8d3a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}

          <HairFront style={L.hairStyle} color={L.hair} S={S} />
        </g>
      </g>
    </svg>
  );
}

type St = (typeof STYLE)[AvatarStyle];

function facePath(S: St) {
  const cx = 100, cy = 108, rx = S.headRx, ry = S.headRy;
  const chin = cy + ry + S.chin;
  return `M${cx - rx} ${cy - 5}
    C ${cx - rx} ${cy - ry - 8}, ${cx + rx} ${cy - ry - 8}, ${cx + rx} ${cy - 5}
    C ${cx + rx} ${cy + ry * 0.55}, ${cx + rx * 0.45} ${chin}, ${cx} ${chin}
    C ${cx - rx * 0.45} ${chin}, ${cx - rx} ${cy + ry * 0.55}, ${cx - rx} ${cy - 5} Z`;
}

// Short trimmed beard along the jaw + a small moustache; the mouth stays clear.
function beardPath(S: St, mouthY: number) {
  const cx = 100, rx = S.headRx - 10;
  const chin = 108 + S.headRy + S.chin;
  const jaw = `M${cx - rx} ${mouthY - 6} Q${cx - rx + 6} ${chin - 6} ${cx} ${chin + 1} Q${cx + rx - 6} ${chin - 6} ${cx + rx} ${mouthY - 6}
    Q${cx + rx - 8} ${mouthY + 12} ${cx} ${mouthY + 12} Q${cx - rx + 8} ${mouthY + 12} ${cx - rx} ${mouthY - 6} Z`;
  const tache = `M${cx - 15} ${mouthY - 4} Q${cx} ${mouthY - 12} ${cx + 15} ${mouthY - 4} Q${cx} ${mouthY - 7} ${cx - 15} ${mouthY - 4} Z`;
  return `${jaw} ${tache}`;
}

function HairBack({ style, color, S }: { style: string; color: string; S: St }) {
  const rx = S.headRx;
  if (style === 'wavy')
    return <path d={`M${100 - rx - 10} 70 C ${100 - rx - 22} 170, ${100 - rx} 205, ${100 - rx + 6} 215 L${100 + rx - 6} 215 C ${100 + rx} 205, ${100 + rx + 22} 170, ${100 + rx + 10} 70 Z`} fill={color} />;
  if (style === 'bob')
    return <path d={`M${100 - rx - 8} 95 C ${100 - rx - 10} 150, ${100 - rx - 4} 172, ${100 - rx + 12} 176 L${100 + rx - 12} 176 C ${100 + rx + 4} 172, ${100 + rx + 10} 150, ${100 + rx + 8} 95 Z`} fill={color} />;
  return null;
}

function HairFront({ style, color, S }: { style: string; color: string; S: St }) {
  const rx = S.headRx;
  const top = 108 - S.headRy - 10;
  switch (style) {
    case 'side-part': // grey, a little receding — Jimmy
      return (
        <path d={`M${100 - rx - 2} 100 C ${100 - rx - 6} ${top + 10}, ${100 - 20} ${top - 4}, 100 ${top} C ${100 + 30} ${top - 4}, ${100 + rx + 6} ${top + 12}, ${100 + rx + 2} 100
          C ${100 + rx - 6} 80, ${100 + 30} ${top + 18}, ${100 - 2} ${top + 20} C ${100 - 26} ${top + 22}, ${100 - rx + 6} 74, ${100 - rx - 2} 100 Z`} fill={color} />
      );
    case 'bob':
      return <path d={`M${100 - rx - 8} 100 C ${100 - rx - 8} ${top - 6}, ${100 + rx + 8} ${top - 6}, ${100 + rx + 8} 100 C ${100 + rx - 10} 70, ${100 + 20} 66, 100 68 C ${100 - 30} 64, ${100 - rx + 4} 76, ${100 - rx - 8} 100 Z`} fill={color} />;
    case 'wavy':
      return <path d={`M${100 - rx - 10} 104 C ${100 - rx - 10} ${top - 8}, ${100 + rx + 10} ${top - 8}, ${100 + rx + 10} 104 C ${100 + rx - 4} 76, ${100 + 18} 60, ${100 - 10} 72 C ${100 - 30} 80, ${100 - rx + 2} 80, ${100 - rx - 10} 104 Z`} fill={color} />;
    case 'slick':
      return <path d={`M${100 - rx - 2} 94 C ${100 - rx - 4} ${top - 2}, ${100 + rx + 4} ${top - 2}, ${100 + rx + 2} 94 C ${100 + rx - 10} 74, ${100 - rx + 10} 70, ${100 - rx - 2} 94 Z`} fill={color} />;
    case 'bun':
      return (
        <g fill={color}>
          <circle cx="100" cy={top - 8} r="16" />
          <path d={`M${100 - rx - 4} 98 C ${100 - rx - 4} ${top - 4}, ${100 + rx + 4} ${top - 4}, ${100 + rx + 4} 98 C ${100 + rx - 10} 72, ${100 - rx + 10} 72, ${100 - rx - 4} 98 Z`} />
        </g>
      );
    default: // short
      return <path d={`M${100 - rx - 1} 96 C ${100 - rx - 4} ${top - 4}, ${100 + rx + 4} ${top - 4}, ${100 + rx + 1} 96 C ${100 + rx - 6} 76, ${100 + 10} 70, 100 74 C ${100 - 16} 70, ${100 - rx + 6} 76, ${100 - rx - 1} 96 Z`} fill={color} />;
  }
}

function Collar({ kind, color }: { kind: string; color: string }) {
  const dark = shadeHex(color, -0.35);
  switch (kind) {
    case 'blazer':
      return (
        <g>
          <path d="M84 178 L100 214 L116 178 Z" fill="#F4F1EA" />
          <path d="M80 176 L100 214 L88 240 L60 240 L70 186 Z" fill={dark} />
          <path d="M120 176 L100 214 L112 240 L140 240 L130 186 Z" fill={dark} />
        </g>
      );
    case 'shirt-tie':
      return (
        <g>
          <path d="M84 178 L100 200 L116 178 Z" fill="#fff" />
          <path d="M96 192 L104 192 L108 230 L100 240 L92 230 Z" fill="#B03A2E" />
        </g>
      );
    case 'blouse':
      return <path d="M82 178 Q100 206 118 178" fill="none" stroke="#fff" strokeWidth="4" opacity="0.8" />;
    case 'polo':
      return (
        <g fill={dark}>
          <path d="M82 177 L98 190 L92 198 Z" />
          <path d="M118 177 L102 190 L108 198 Z" />
        </g>
      );
    case 'vest':
      return (
        <g>
          <path d="M84 178 L100 205 L116 178 Z" fill="#fff" />
          <path d="M98 196 L102 196 L104 240 L96 240 Z" fill="#222" />
        </g>
      );
    default:
      return null;
  }
}

function shadeHex(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}
