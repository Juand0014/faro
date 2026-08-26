import type { Outfit } from '../lib/fashion';

export default function LookFigure({ outfit, compact }: { outfit: Outfit; compact?: boolean }) {
  const skin = outfit.skin;
  const hair = outfit.hairColor;
  const dressed = outfit.dress !== 'none';

  return (
    <svg className={'look-fig' + (compact ? ' compact' : '')} viewBox="0 0 220 400" aria-hidden="true">
      <defs>
        <linearGradient id="lg-floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="378" rx="58" ry="8" fill="url(#lg-floor)" />

      {outfit.hair === 'long' && <path d="M62 92 C58 170 70 250 78 292 L92 292 C86 230 78 160 80 100 Z M158 92 C162 170 150 250 142 292 L128 292 C134 230 142 160 140 100 Z" fill={hair} />}
      {outfit.hair === 'waves' && <path d="M60 88 C50 150 62 210 70 250 C78 220 68 170 78 100 Z M160 88 C170 150 158 210 150 250 C142 220 152 170 142 100 Z" fill={hair} />}

      <path d="M96 148 L88 268 L102 268 L110 168 L118 268 L132 268 L124 148 Z" fill={skin} />
      <path d="M74 150 C40 200 48 280 58 318 L74 312 C68 270 70 210 92 168 Z" fill={skin} />
      <path d="M146 150 C180 200 172 280 162 318 L146 312 C152 270 150 210 128 168 Z" fill={skin} />
      <ellipse cx="110" cy="138" rx="28" ry="36" fill={skin} />
      <rect x="100" y="96" width="20" height="18" rx="6" fill={skin} />
      <circle cx="110" cy="68" r="32" fill={skin} />

      {outfit.shoes === 'pumps' && <>
        <path d="M86 318 L78 352 L108 352 L102 318 Z" fill={outfit.shoesColor} />
        <path d="M118 318 L112 352 L142 352 L134 318 Z" fill={outfit.shoesColor} />
        <path d="M90 352 L86 368" stroke={outfit.shoesColor} strokeWidth="3" />
        <path d="M130 352 L134 368" stroke={outfit.shoesColor} strokeWidth="3" />
      </>}
      {outfit.shoes === 'boots' && <>
        <path d="M86 300 L80 352 L108 352 L102 300 Z" fill={outfit.shoesColor} />
        <path d="M118 300 L112 352 L140 352 L134 300 Z" fill={outfit.shoesColor} />
      </>}
      {outfit.shoes === 'sneakers' && <>
        <path d="M84 330 L76 350 L110 350 L104 330 Z" fill={outfit.shoesColor} />
        <path d="M116 330 L110 350 L144 350 L136 330 Z" fill={outfit.shoesColor} />
        <path d="M76 350 H110" stroke="#f4efe6" strokeWidth="2" />
        <path d="M110 350 H144" stroke="#f4efe6" strokeWidth="2" />
      </>}
      {outfit.shoes === 'sandals' && <>
        <path d="M84 346 H108" stroke={outfit.shoesColor} strokeWidth="5" strokeLinecap="round" />
        <path d="M112 346 H136" stroke={outfit.shoesColor} strokeWidth="5" strokeLinecap="round" />
        <path d="M92 318 L90 346" stroke={outfit.shoesColor} strokeWidth="2" />
        <path d="M128 318 L130 346" stroke={outfit.shoesColor} strokeWidth="2" />
      </>}

      {!dressed && outfit.bottom === 'jeans' && <path d="M90 218 L86 318 L104 318 L110 236 L116 318 L134 318 L130 218 Z" fill={outfit.bottomColor} />}
      {!dressed && outfit.bottom === 'trousers' && <path d="M88 216 L82 318 L106 318 L110 234 L114 318 L138 318 L132 216 Z" fill={outfit.bottomColor} />}
      {!dressed && outfit.bottom === 'shorts' && <path d="M90 218 L88 268 L110 250 L132 268 L130 218 Z" fill={outfit.bottomColor} />}
      {!dressed && outfit.bottom === 'skirt' && <path d="M90 216 L70 292 L150 292 L130 216 Z" fill={outfit.bottomColor} />}
      {!dressed && outfit.bottom === 'slit' && <>
        <path d="M90 216 L74 300 L108 292 L110 230 L146 300 L130 216 Z" fill={outfit.bottomColor} />
        <path d="M110 230 L118 300" stroke={skin} strokeWidth="6" />
      </>}

      {!dressed && outfit.top === 'tee' && <path d="M64 148 L92 136 L128 136 L156 148 L148 214 L72 214 Z" fill={outfit.topColor} />}
      {!dressed && outfit.top === 'blouse' && <path d="M68 146 C90 128 130 128 152 146 L146 218 C110 228 110 228 74 218 Z" fill={outfit.topColor} />}
      {!dressed && outfit.top === 'crop' && <path d="M70 148 L92 138 L128 138 L150 148 L142 196 L78 196 Z" fill={outfit.topColor} />}
      {!dressed && outfit.top === 'turtleneck' && <>
        <path d="M70 150 L92 138 L128 138 L150 150 L144 220 L76 220 Z" fill={outfit.topColor} />
        <rect x="98" y="108" width="24" height="34" rx="8" fill={outfit.topColor} />
      </>}
      {!dressed && outfit.top === 'bustier' && <path d="M82 150 C92 138 128 138 138 150 L134 200 L110 210 L86 200 Z" fill={outfit.topColor} />}

      {outfit.dress === 'slip' && <path d="M78 148 C96 132 124 132 142 148 L150 300 L70 300 Z" fill={outfit.dressColor} />}
      {outfit.dress === 'cocktail' && <path d="M80 146 C98 128 122 128 140 146 L136 210 L170 318 L50 318 L84 210 Z" fill={outfit.dressColor} />}
      {outfit.dress === 'shirt' && <path d="M66 148 L92 134 L128 134 L154 148 L148 300 L72 300 Z" fill={outfit.dressColor} />}

      {outfit.acc === 'belt' && <rect x="86" y="214" width="48" height="8" rx="2" fill="#d4a054" />}

      {outfit.outer === 'blazer' && <path d="M58 146 L90 132 L110 168 L130 132 L162 146 L170 230 L138 222 L110 176 L82 222 L50 230 Z" fill={outfit.outerColor} />}
      {outfit.outer === 'coat' && <path d="M52 144 L88 128 L110 160 L132 128 L168 144 L176 300 L140 292 L110 180 L80 292 L44 300 Z" fill={outfit.outerColor} />}
      {outfit.outer === 'cardigan' && <path d="M60 150 C88 136 110 150 110 150 C110 150 132 136 160 150 L166 240 L138 232 L110 170 L82 232 L54 240 Z" fill={outfit.outerColor} fillOpacity=".92" />}

      {outfit.hair === 'bob' && <path d="M78 48 C78 22 142 22 142 48 L148 92 C140 108 80 108 72 92 Z" fill={hair} />}
      {outfit.hair === 'pixie' && <path d="M82 42 C90 20 136 22 140 48 L138 78 C120 70 92 72 80 78 Z" fill={hair} />}
      {outfit.hair === 'bun' && <>
        <path d="M80 50 C84 28 136 28 140 50 L144 88 C130 100 90 100 76 88 Z" fill={hair} />
        <circle cx="110" cy="28" r="16" fill={hair} />
      </>}
      {outfit.hair === 'long' && <path d="M78 46 C80 18 140 18 142 48 L148 96 C132 88 88 88 72 96 Z" fill={hair} />}
      {outfit.hair === 'waves' && <path d="M76 48 C78 16 142 16 144 50 L150 100 C128 84 90 84 70 100 Z" fill={hair} />}

      {outfit.acc === 'necklace' && <path d="M96 108 Q110 128 124 108" fill="none" stroke="#d4a054" strokeWidth="2.4" />}
      {outfit.acc === 'glasses' && <>
        <rect x="86" y="62" width="18" height="12" rx="4" fill="none" stroke="#1a1520" strokeWidth="2" />
        <rect x="116" y="62" width="18" height="12" rx="4" fill="none" stroke="#1a1520" strokeWidth="2" />
        <path d="M104 68 H116" stroke="#1a1520" strokeWidth="2" />
      </>}
      {outfit.acc === 'bag' && <path d="M24 210 L18 258 L62 258 L56 210 Z M30 210 Q40 190 50 210" fill="#d4a054" />}
    </svg>
  );
}
