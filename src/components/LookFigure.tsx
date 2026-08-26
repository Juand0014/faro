import { useId } from 'react';
import { normalizeOutfit, type FashionPoint, type Outfit } from '../lib/fashion';

export default function LookFigure({ outfit, compact }: { outfit: Outfit; compact?: boolean }) {
  const look = normalizeOutfit(outfit);
  const uid = useId().replace(/:/g, '');
  const dressed = look.dress !== 'none';
  const fill = (layer: 'top' | 'bottom' | 'dress') => {
    const pattern = look[`${layer}Pattern`];
    return pattern === 'solid' ? look[`${layer}Color`] : `url(#${uid}-${layer})`;
  };
  const artPath = (points: FashionPoint[], target: 'top' | 'bottom' | 'dress') => {
    const box = target === 'top'
      ? { x: 54, y: 124, w: 112, h: 116 }
      : target === 'bottom'
        ? { x: 58, y: 222, w: 104, h: 126 }
        : { x: 42, y: 124, w: 136, h: 224 };
    return points.map((point, i) =>
      `${i ? 'L' : 'M'} ${box.x + point.x * box.w / 100} ${box.y + point.y * box.h / 100}`).join(' ');
  };

  return (
    <svg className={'look-fig voxel' + (compact ? ' compact' : '')} viewBox="0 0 220 400"
      role="img" aria-label="Avatar voxel con el look diseñado">
      <defs>
        {(['top', 'bottom', 'dress'] as const).map((layer) => (
          <GarmentPattern key={layer} id={`${uid}-${layer}`} color={look[`${layer}Color`]}
            pattern={look[`${layer}Pattern`]} />
        ))}
        <clipPath id={`${uid}-top-clip`}><rect x="52" y="122" width="116" height="120" /></clipPath>
        <clipPath id={`${uid}-bottom-clip`}><rect x="54" y="218" width="112" height="134" /></clipPath>
        <clipPath id={`${uid}-dress-clip`}><path d="M52 122 H168 L178 350 H42 Z" /></clipPath>
      </defs>
      <ellipse cx="110" cy="376" rx="65" ry="9" fill="#03040a" opacity=".35" />

      {/* Cabello posterior y cuerpo construidos con bloques, estética voxel original. */}
      {['long', 'waves', 'braids', 'ponytail'].includes(look.hair) &&
        <rect x="68" y="42" width="84" height={look.hair === 'long' ? 190 : 150} fill={look.hairColor} />}
      {look.hair === 'afro' && <>
        <rect x="60" y="34" width="100" height="68" fill={look.hairColor} />
        <rect x="72" y="22" width="76" height="92" fill={look.hairColor} />
      </>}
      <rect x="78" y="268" width="28" height="82" fill={look.skin} />
      <rect x="114" y="268" width="28" height="82" fill={look.skin} />
      <rect x="48" y="142" width="24" height="118" fill={look.skin} />
      <rect x="148" y="142" width="24" height="118" fill={look.skin} />
      <rect x="76" y="122" width="68" height="150" fill={look.skin} />
      <rect x="98" y="102" width="24" height="25" fill={look.skin} />
      <rect x="72" y="38" width="76" height="72" fill={look.skin} />
      <rect x="66" y="48" width="6" height="52" fill="#000" opacity=".12" />
      <rect x="76" y="106" width="68" height="6" fill="#000" opacity=".12" />

      {/* Rostro pixelado */}
      <rect x="88" y="66" width="8" height="8" fill="#282033" />
      {look.face === 'wink'
        ? <rect x="124" y="69" width="9" height="3" fill="#282033" />
        : <rect x="124" y="66" width="8" height="8" fill="#282033" />}
      {look.face === 'bold' && <><rect x="86" y="58" width="13" height="3" fill="#282033" /><rect x="121" y="58" width="13" height="3" fill="#282033" /></>}
      {look.face === 'freckles' && <><rect x="82" y="82" width="3" height="3" fill="#9d5f47" /><rect x="99" y="84" width="3" height="3" fill="#9d5f47" /><rect x="119" y="84" width="3" height="3" fill="#9d5f47" /><rect x="136" y="82" width="3" height="3" fill="#9d5f47" /></>}
      <rect x="104" y="91" width="13" height="4" fill="#9f5361" />

      <VoxelShoes look={look} />
      {!dressed && <VoxelBottom look={look} fill={fill('bottom')} />}
      {!dressed && <VoxelTop look={look} fill={fill('top')} />}
      {dressed && <VoxelDress look={look} fill={fill('dress')} />}

      {look.art.map((stroke) => {
        if ((stroke.target === 'dress') !== dressed) return null;
        return <path key={stroke.id} d={artPath(stroke.points, stroke.target)} fill="none"
          stroke={stroke.color} strokeWidth={stroke.width * 0.75} strokeLinecap="round"
          strokeLinejoin="round" clipPath={`url(#${uid}-${stroke.target}-clip)`} />;
      })}

      <VoxelOuter look={look} />

      {/* Cabello frontal */}
      <rect x="68" y="34" width="84" height="20" fill={look.hairColor} />
      <rect x="68" y="48" width="12" height="55" fill={look.hairColor} />
      <rect x="140" y="48" width="12" height="55" fill={look.hairColor} />
      {look.hair === 'bob' && <><rect x="68" y="94" width="24" height="28" fill={look.hairColor} /><rect x="128" y="94" width="24" height="28" fill={look.hairColor} /></>}
      {look.hair === 'pixie' && <rect x="80" y="27" width="60" height="17" fill={look.hairColor} />}
      {look.hair === 'bun' && <rect x="94" y="10" width="32" height="27" fill={look.hairColor} />}
      {look.hair === 'ponytail' && <rect x="148" y="52" width="22" height="118" fill={look.hairColor} />}
      {look.hair === 'braids' && <><rect x="66" y="92" width="12" height="178" fill={look.hairColor} /><rect x="142" y="92" width="12" height="178" fill={look.hairColor} /></>}

      <VoxelAccessory look={look} />
    </svg>
  );
}

function GarmentPattern({ id, color, pattern }: { id: string; color: string; pattern: string }) {
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill={color} />
      {pattern === 'stripes' && <path d="M-3 3 L3 -3 M0 12 L12 0 M9 15 L15 9" stroke="#fff" strokeOpacity=".32" strokeWidth="3" />}
      {pattern === 'dots' && <rect x="4" y="4" width="4" height="4" fill="#fff" fillOpacity=".42" />}
      {pattern === 'check' && <><rect width="6" height="6" fill="#000" fillOpacity=".16" /><rect x="6" y="6" width="6" height="6" fill="#000" fillOpacity=".16" /></>}
    </pattern>
  );
}

function VoxelTop({ look, fill }: { look: Outfit; fill: string }) {
  const wide = ['hoodie', 'oversized'].includes(look.top);
  const cropped = ['crop', 'bustier', 'corset'].includes(look.top);
  const narrow = look.top === 'tank';
  return <>
    <rect x={wide ? 54 : narrow ? 83 : 68} y="126" width={wide ? 112 : narrow ? 54 : 84}
      height={cropped ? 65 : wide ? 116 : 104} fill={fill} />
    {!narrow && !['bustier', 'corset'].includes(look.top) && <>
      <rect x="48" y="142" width="24" height={wide ? 85 : 58} fill={fill} />
      <rect x="148" y="142" width="24" height={wide ? 85 : 58} fill={fill} />
    </>}
    {look.top === 'turtleneck' && <rect x="96" y="105" width="28" height="28" fill={fill} />}
    {look.top === 'hoodie' && <path d="M84 126 V112 H136 V126 M92 135 V180 H128 V135" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="5" />}
    {look.top === 'corset' && <path d="M88 140 L132 205 M132 140 L88 205" stroke="#fff" strokeOpacity=".42" strokeWidth="3" />}
    {look.top === 'blouse' && <rect x="104" y="130" width="4" height="96" fill="#fff" fillOpacity=".3" />}
  </>;
}

function VoxelBottom({ look, fill }: { look: Outfit; fill: string }) {
  const pants = ['jeans', 'trousers', 'cargo', 'wideleg', 'jogger'].includes(look.bottom);
  if (pants) {
    const wide = look.bottom === 'wideleg' ? 36 : 30;
    return <>
      <rect x={110 - wide} y="222" width={wide} height="128" fill={fill} />
      <rect x="110" y="222" width={wide} height="128" fill={fill} />
      {look.bottom === 'cargo' && <><rect x="76" y="260" width="22" height="22" fill="#000" fillOpacity=".2" /><rect x="122" y="260" width="22" height="22" fill="#000" fillOpacity=".2" /></>}
      {look.bottom === 'jeans' && <path d="M110 224 V348" stroke="#fff" strokeOpacity=".22" strokeWidth="2" />}
    </>;
  }
  const bottom = look.bottom === 'mini' ? 270 : look.bottom === 'maxi' ? 344 : look.bottom === 'shorts' ? 272 : 310;
  return <>
    <path d={`M72 220 H148 L${look.bottom === 'maxi' ? 164 : 154} ${bottom} H${look.bottom === 'maxi' ? 56 : 66} Z`} fill={fill} />
    {look.bottom === 'pleated' && [82, 96, 110, 124, 138].map((x) => <path key={x} d={`M${x} 225 L${x - 8} ${bottom}`} stroke="#fff" strokeOpacity=".28" strokeWidth="2" />)}
    {look.bottom === 'slit' && <rect x="110" y="265" width="9" height={bottom - 265} fill={look.skin} />}
  </>;
}

function VoxelDress({ look, fill }: { look: Outfit; fill: string }) {
  const bottom = look.dress === 'mini' ? 270 : look.dress === 'bodycon' ? 318 : look.dress === 'gala' ? 350 : 330;
  const flare = ['cocktail', 'gala', 'pinafore'].includes(look.dress);
  return <>
    <rect x="76" y="126" width="68" height="100" fill={fill} />
    <path d={`M76 214 H144 L${flare ? 178 : 150} ${bottom} H${flare ? 42 : 70} Z`} fill={fill} />
    {look.dress === 'shirt' && <><rect x="48" y="142" width="24" height="65" fill={fill} /><rect x="148" y="142" width="24" height="65" fill={fill} /><path d="M108 130 V300" stroke="#fff" strokeOpacity=".3" strokeWidth="3" /></>}
    {look.dress === 'pinafore' && <><rect x="84" y="126" width="12" height="90" fill="#fff" fillOpacity=".25" /><rect x="124" y="126" width="12" height="90" fill="#fff" fillOpacity=".25" /></>}
  </>;
}

function VoxelOuter({ look }: { look: Outfit }) {
  if (look.outer === 'none') return null;
  const long = look.outer === 'coat';
  return <>
    <rect x="48" y="132" width="28" height={long ? 170 : 108} fill={look.outerColor} />
    <rect x="144" y="132" width="28" height={long ? 170 : 108} fill={look.outerColor} />
    <path d={`M70 124 H102 L110 170 L118 124 H150 V${long ? 310 : 235} H128 L110 184 L92 ${long ? 310 : 235} H70 Z`}
      fill={look.outerColor} fillOpacity={look.outer === 'cardigan' ? '.88' : '1'} />
    {look.outer === 'denim' && <><rect x="78" y="175" width="22" height="18" fill="#fff" fillOpacity=".18" /><rect x="120" y="175" width="22" height="18" fill="#fff" fillOpacity=".18" /></>}
    {look.outer === 'leather' && <path d="M78 130 L136 225 M142 132 L96 220" stroke="#fff" strokeOpacity=".22" strokeWidth="4" />}
  </>;
}

function VoxelShoes({ look }: { look: Outfit }) {
  const tall = look.shoes === 'boots';
  const platform = look.shoes === 'platforms';
  return <>
    <rect x="72" y={tall ? 310 : 342} width="38" height={tall ? 48 : platform ? 24 : 14} fill={look.shoesColor} />
    <rect x="110" y={tall ? 310 : 342} width="38" height={tall ? 48 : platform ? 24 : 14} fill={look.shoesColor} />
    {look.shoes === 'sneakers' && <><rect x="72" y="352" width="38" height="5" fill="#f4efe6" /><rect x="110" y="352" width="38" height="5" fill="#f4efe6" /></>}
    {look.shoes === 'sandals' && <><rect x="78" y="330" width="5" height="24" fill={look.shoesColor} /><rect x="137" y="330" width="5" height="24" fill={look.shoesColor} /></>}
    {look.shoes === 'pumps' && <><rect x="78" y="356" width="5" height="13" fill={look.shoesColor} /><rect x="137" y="356" width="5" height="13" fill={look.shoesColor} /></>}
  </>;
}

function VoxelAccessory({ look }: { look: Outfit }) {
  if (look.acc === 'belt') return <rect x="70" y="215" width="80" height="9" fill="#d4a054" />;
  if (look.acc === 'necklace') return <path d="M94 111 V132 H126 V111" fill="none" stroke="#d4a054" strokeWidth="4" />;
  if (look.acc === 'glasses') return <><rect x="81" y="61" width="24" height="17" fill="none" stroke="#17121d" strokeWidth="4" /><rect x="115" y="61" width="24" height="17" fill="none" stroke="#17121d" strokeWidth="4" /><path d="M105 68 H115" stroke="#17121d" strokeWidth="4" /></>;
  if (look.acc === 'bag') return <><rect x="20" y="214" width="38" height="52" fill="#d4a054" /><path d="M28 214 V198 H50 V214" fill="none" stroke="#d4a054" strokeWidth="5" /></>;
  if (look.acc === 'backpack') return <rect x="150" y="152" width="38" height="74" fill="#7a1f3d" />;
  if (look.acc === 'hat') return <><rect x="62" y="22" width="96" height="12" fill="#7a1f3d" /><rect x="82" y="0" width="56" height="28" fill="#7a1f3d" /></>;
  if (look.acc === 'earrings') return <><rect x="64" y="84" width="7" height="15" fill="#d4a054" /><rect x="149" y="84" width="7" height="15" fill="#d4a054" /></>;
  return null;
}
