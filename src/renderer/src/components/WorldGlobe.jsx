import React from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Simplified Mercator continent map — 400×200 — doubled for seamless
   loop. SVG encoded as data URI so no external assets are needed.
   ────────────────────────────────────────────────────────────────────── */
function buildEarthSVG() {
  const ocean  = '#082356'
  const land   = '#2e6b28'
  const land2  = '#3a8232'

  const continents = `
    <!-- Greenland -->
    <polygon fill="${land}" points="95,2 115,0 132,2 140,10 136,19 119,23 99,19 90,10"/>
    <!-- Iceland -->
    <polygon fill="${land}" points="141,14 152,12 158,17 155,23 145,25 139,20"/>
    <!-- North America -->
    <polygon fill="${land2}" points="30,22 56,14 82,9 110,8 137,12 158,24 169,38 174,57 170,76 159,91 143,104 122,113 98,119 76,121 56,117 41,106 31,89 26,68 26,46"/>
    <!-- Central America -->
    <polygon fill="${land}" points="87,111 101,116 109,130 102,136 86,131 78,121"/>
    <!-- South America -->
    <polygon fill="${land2}" points="66,120 96,113 122,112 142,118 156,134 162,154 160,174 151,190 133,199 111,200 91,197 74,183 64,163 60,141 64,128"/>
    <!-- UK -->
    <polygon fill="${land}" points="148,20 158,16 165,21 161,29 151,31 144,26"/>
    <!-- Europe -->
    <polygon fill="${land2}" points="157,17 177,10 196,10 213,15 221,27 221,46 212,57 197,65 179,67 162,61 153,50 151,36 154,24"/>
    <!-- Africa -->
    <polygon fill="${land2}" points="144,67 166,60 186,60 204,67 216,82 222,103 222,129 217,155 205,171 186,181 165,183 146,176 133,158 126,131 126,107 133,85 138,74"/>
    <!-- Madagascar -->
    <polygon fill="${land}" points="221,151 229,147 233,159 231,171 222,169 218,159"/>
    <!-- Asia (main) -->
    <polygon fill="${land2}" points="179,15 228,6 278,4 326,6 368,11 394,20 400,36 400,64 394,86 379,104 356,116 325,122 291,124 260,121 232,113 208,101 190,87 181,66 177,43"/>
    <!-- Arabian Peninsula -->
    <polygon fill="${land}" points="197,83 220,75 240,79 246,98 240,114 226,120 209,115 199,103 195,91"/>
    <!-- India -->
    <polygon fill="${land2}" points="214,80 234,71 252,73 263,88 261,110 250,124 232,129 215,122 207,107 209,89"/>
    <!-- Sri Lanka -->
    <polygon fill="${land}" points="248,131 256,129 259,138 255,144 247,140"/>
    <!-- Southeast Asia -->
    <polygon fill="${land2}" points="267,110 296,103 320,108 330,122 327,142 311,152 287,150 267,138 261,123"/>
    <!-- Japan -->
    <polygon fill="${land}" points="363,36 377,33 387,40 385,54 374,61 363,56 359,44"/>
    <!-- Taiwan -->
    <polygon fill="${land}" points="349,82 355,80 358,88 354,95 347,91"/>
    <!-- Philippines -->
    <polygon fill="${land}" points="333,107 347,104 355,114 352,130 340,133 330,124"/>
    <!-- Australia -->
    <polygon fill="${land2}" points="300,143 343,137 369,139 386,151 394,168 392,184 377,194 350,198 324,196 302,185 290,171 287,156 292,146"/>
    <!-- New Zealand -->
    <polygon fill="${land}" points="392,174 400,169 400,185 394,183"/>
  `

  // Build a 800×400 SVG (two 400×200 maps side by side for seamless repeat)
  const half = (xOffset = 0) => continents.replace(
    /points="([^"]+)"/g,
    (_, pts) => `points="${pts.trim().split(/\s+/).map(pair => {
      const [x, y] = pair.split(',')
      return `${parseFloat(x) + xOffset},${y}`
    }).join(' ')}"`
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <rect width="800" height="400" fill="${ocean}"/>
    ${half(0)}
    ${half(400)}
  </svg>`
}

const EARTH_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildEarthSVG())}`

/* ──────────────────────────────────────────────────────────────────────
   WorldGlobe — spinning realistic Earth with orbiting rings
   ────────────────────────────────────────────────────────────────────── */
export default function WorldGlobe({ size = 80, style = {} }) {
  const orbitW1 = size * 1.78
  const orbitW2 = size * 1.52

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>

      {/* ── Atmosphere glow ── */}
      <div style={{
        position: 'absolute',
        inset: -(size * 0.14),
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(60,130,255,0.14) 45%, rgba(20,70,180,0.07) 70%, transparent 100%)',
        filter: `blur(${Math.round(size * 0.09)}px)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Orbital ring 1 (blue tint) ── */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: orbitW1, height: orbitW1,
        marginLeft: -(orbitW1 / 2), marginTop: -(orbitW1 / 2),
        borderRadius: '50%',
        border: '1.2px solid rgba(90,190,255,0.40)',
        boxShadow: '0 0 8px rgba(90,190,255,0.10) inset',
        animation: `worldOrbit1 7s linear infinite`,
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: -4, left: '50%', marginLeft: -4,
          width: 8, height: 8, borderRadius: '50%',
          background: 'radial-gradient(circle, #c8eeff 0%, #5abcff 55%, transparent 100%)',
          boxShadow: '0 0 8px rgba(90,200,255,1), 0 0 18px rgba(90,200,255,0.5)',
        }} />
      </div>

      {/* ── Orbital ring 2 (purple tint) ── */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: orbitW2, height: orbitW2,
        marginLeft: -(orbitW2 / 2), marginTop: -(orbitW2 / 2),
        borderRadius: '50%',
        border: '1px solid rgba(170,130,255,0.32)',
        animation: `worldOrbit2 11s linear infinite`,
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: -3.5, left: '50%', marginLeft: -3.5,
          width: 7, height: 7, borderRadius: '50%',
          background: 'radial-gradient(circle, #eedeff 0%, #b080ff 55%, transparent 100%)',
          boxShadow: '0 0 7px rgba(170,130,255,0.9), 0 0 14px rgba(170,130,255,0.4)',
        }} />
      </div>

      {/* ── Earth sphere ── */}
      <div style={{
        width: size, height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative', zIndex: 1,
        flexShrink: 0,
        boxShadow: [
          `0 0 0 1.5px rgba(80,160,255,0.22)`,
          `0 0 ${Math.round(size * 0.45)}px rgba(15,65,160,0.55)`,
          `0 6px ${Math.round(size * 0.3)}px rgba(0,0,0,0.65)`,
        ].join(', '),
      }}>

        {/* Ocean base gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 38% 36%, #0c3f80 0%, #062050 55%, #030e28 100%)',
        }} />

        {/* Scrolling continent map */}
        <div style={{
          position: 'absolute', inset: 0,
          width: '200%', height: '100%',
          backgroundImage: `url("${EARTH_URI}")`,
          backgroundSize: '50% 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: '0 center',
          animation: 'earthSpin 22s linear infinite',
        }} />

        {/* Specular highlight — top-left white glow */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: [
            'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 32%, transparent 56%)',
          ].join(', '),
          pointerEvents: 'none',
        }} />

        {/* Shadow — bottom-right darkening */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 68% 66%, rgba(0,0,35,0.60) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />

        {/* Edge vignette — gives sphere depth */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(0,5,28,0.80) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle latitude haze */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(180,220,255,0.04) 0%, transparent 38%, transparent 62%, rgba(0,10,40,0.10) 100%)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
