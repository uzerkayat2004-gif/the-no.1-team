import React, { useRef, useEffect, useState } from 'react'

/* ──────────────────────────────────────────────────────────────────────
   Simplified Mercator continent map — 400×200 — doubled for seamless
   loop. SVG encoded as data URI so no external assets are needed.
   ────────────────────────────────────────────────────────────────────── */
function buildEarthSVG(ocean, land, land2) {
  const continents = `
    <polygon fill="${land}" points="95,2 115,0 132,2 140,10 136,19 119,23 99,19 90,10"/>
    <polygon fill="${land}" points="141,14 152,12 158,17 155,23 145,25 139,20"/>
    <polygon fill="${land2}" points="30,22 56,14 82,9 110,8 137,12 158,24 169,38 174,57 170,76 159,91 143,104 122,113 98,119 76,121 56,117 41,106 31,89 26,68 26,46"/>
    <polygon fill="${land}" points="87,111 101,116 109,130 102,136 86,131 78,121"/>
    <polygon fill="${land2}" points="66,120 96,113 122,112 142,118 156,134 162,154 160,174 151,190 133,199 111,200 91,197 74,183 64,163 60,141 64,128"/>
    <polygon fill="${land}" points="148,20 158,16 165,21 161,29 151,31 144,26"/>
    <polygon fill="${land2}" points="157,17 177,10 196,10 213,15 221,27 221,46 212,57 197,65 179,67 162,61 153,50 151,36 154,24"/>
    <polygon fill="${land2}" points="144,67 166,60 186,60 204,67 216,82 222,103 222,129 217,155 205,171 186,181 165,183 146,176 133,158 126,131 126,107 133,85 138,74"/>
    <polygon fill="${land}" points="221,151 229,147 233,159 231,171 222,169 218,159"/>
    <polygon fill="${land2}" points="179,15 228,6 278,4 326,6 368,11 394,20 400,36 400,64 394,86 379,104 356,116 325,122 291,124 260,121 232,113 208,101 190,87 181,66 177,43"/>
    <polygon fill="${land}" points="197,83 220,75 240,79 246,98 240,114 226,120 209,115 199,103 195,91"/>
    <polygon fill="${land2}" points="214,80 234,71 252,73 263,88 261,110 250,124 232,129 215,122 207,107 209,89"/>
    <polygon fill="${land}" points="248,131 256,129 259,138 255,144 247,140"/>
    <polygon fill="${land2}" points="267,110 296,103 320,108 330,122 327,142 311,152 287,150 267,138 261,123"/>
    <polygon fill="${land}" points="363,36 377,33 387,40 385,54 374,61 363,56 359,44"/>
    <polygon fill="${land}" points="349,82 355,80 358,88 354,95 347,91"/>
    <polygon fill="${land}" points="333,107 347,104 355,114 352,130 340,133 330,124"/>
    <polygon fill="${land2}" points="300,143 343,137 369,139 386,151 394,168 392,184 377,194 350,198 324,196 302,185 290,171 287,156 292,146"/>
    <polygon fill="${land}" points="392,174 400,169 400,185 394,183"/>
  `

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

/* ──────────────────────────────────────────────────────────────────────
   WorldGlobe — spinning Earth with drag-to-rotate interactivity.

   Props:
     size        — diameter in px (default 80)
     interactive — enable drag/touch rotation (default false)
     style       — extra wrapper styles
   ────────────────────────────────────────────────────────────────────── */
export default function WorldGlobe({ size = 80, interactive = false, style = {} }) {
  const isLight = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light'

  /* ── Earth surface colors ── */
  const oceanColor  = isLight ? '#A8714A' : '#082356'
  const landColor   = isLight ? '#6B4A1E' : '#2e6b28'
  const landColor2  = isLight ? '#4E6B18' : '#3a8232'

  const earthUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    buildEarthSVG(oceanColor, landColor, landColor2)
  )}`

  /* ── Atmosphere & sphere depth ── */
  const atmosphereColor = isLight
    ? 'radial-gradient(circle, rgba(196,79,0,0.18) 45%, rgba(160,60,0,0.08) 70%, transparent 100%)'
    : 'radial-gradient(circle, rgba(60,130,255,0.14) 45%, rgba(20,70,180,0.07) 70%, transparent 100%)'

  const oceanBase = isLight
    ? 'radial-gradient(circle at 38% 36%, #8B5030 0%, #5A2E10 55%, #2E1005 100%)'
    : 'radial-gradient(circle at 38% 36%, #0c3f80 0%, #062050 55%, #030e28 100%)'

  const sphereGlow = isLight
    ? `0 0 0 1.5px rgba(196,79,0,0.28), 0 0 ${Math.round(size * 0.45)}px rgba(130,50,0,0.50), 0 6px ${Math.round(size * 0.3)}px rgba(0,0,0,0.50)`
    : `0 0 0 1.5px rgba(80,160,255,0.22), 0 0 ${Math.round(size * 0.45)}px rgba(15,65,160,0.55), 0 6px ${Math.round(size * 0.3)}px rgba(0,0,0,0.65)`

  /* ── Orbital ring colors ── */
  const ring1Border = isLight ? 'rgba(196,120,40,0.42)' : 'rgba(90,190,255,0.40)'
  const ring1Shadow = isLight ? '0 0 8px rgba(196,100,20,0.12) inset' : '0 0 8px rgba(90,190,255,0.10) inset'
  const ring2Border = isLight ? 'rgba(160,100,30,0.32)' : 'rgba(170,130,255,0.32)'

  /* ── Orbital particle colors ── */
  const dot1Bg = isLight
    ? 'radial-gradient(circle, #FFE0A0 0%, #E08820 55%, transparent 100%)'
    : 'radial-gradient(circle, #c8eeff 0%, #5abcff 55%, transparent 100%)'
  const dot1Shadow = isLight
    ? '0 0 8px rgba(230,140,0,1), 0 0 18px rgba(230,120,0,0.5)'
    : '0 0 8px rgba(90,200,255,1), 0 0 18px rgba(90,200,255,0.5)'
  const dot2Bg = isLight
    ? 'radial-gradient(circle, #FFD080 0%, #C07010 55%, transparent 100%)'
    : 'radial-gradient(circle, #eedeff 0%, #b080ff 55%, transparent 100%)'
  const dot2Shadow = isLight
    ? '0 0 7px rgba(200,120,0,0.9), 0 0 14px rgba(180,100,0,0.4)'
    : '0 0 7px rgba(170,130,255,0.9), 0 0 14px rgba(170,130,255,0.4)'

  const orbitW1 = size * 1.78
  const orbitW2 = size * 1.52

  /* ── Interactive drag + rAF animation ── */
  const textureRef  = useRef(null)
  const wrapperRef  = useRef(null)
  const animRef     = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // All mutable animation state lives here (no re-renders during rAF)
  const st = useRef({
    spinX:      0,      // current X scroll offset in px [0, size)
    offsetY:    50,     // vertical texture offset % [15, 85]
    velX:       0,      // horizontal momentum px/s (positive = eastward)
    velY:       0,      // vertical momentum %/s
    dragging:   false,
    lastX:      0,
    lastY:      0,
    lastMoveTime: 0,
    dragVelX:   0,      // instantaneous drag velocity px/s
    dragVelY:   0,
    lastFrame:  performance.now(),
  })

  /* rAF-driven animation loop — runs whenever interactive=true */
  useEffect(() => {
    if (!interactive) return

    const AUTO_SPEED = size / 22  // px/s — one revolution per 22s (same as CSS)

    function frame(now) {
      const s = st.current
      const dt = Math.min((now - s.lastFrame) / 1000, 0.05)
      s.lastFrame = now

      if (!s.dragging) {
        // Auto-spin westward
        s.spinX += AUTO_SPEED * dt

        // Horizontal momentum (decays after drag)
        s.spinX -= s.velX * dt
        s.velX  *= Math.pow(0.88, dt * 60)
        if (Math.abs(s.velX) < 0.2) s.velX = 0

        // Vertical spring — gently return to equator when not dragging
        s.velY  *= Math.pow(0.82, dt * 60)
        s.offsetY += s.velY * dt
        s.offsetY += (50 - s.offsetY) * Math.min(dt * 2.5, 1)
        s.offsetY  = Math.max(15, Math.min(85, s.offsetY))
      }

      // Wrap horizontal offset to [0, size)
      s.spinX = ((s.spinX % size) + size) % size

      // Write directly to DOM (zero React re-renders during animation)
      if (textureRef.current) {
        textureRef.current.style.transform = `translateX(${-s.spinX}px)`
        textureRef.current.style.backgroundPositionY = `${s.offsetY}%`
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [interactive, size])

  /* Drag event handlers */
  useEffect(() => {
    if (!interactive) return
    const el = wrapperRef.current
    if (!el) return

    const getPos = (e) => e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY }

    const onDown = (e) => {
      const { x, y } = getPos(e)
      const s = st.current
      s.dragging    = true
      s.lastX       = x
      s.lastY       = y
      s.dragVelX    = 0
      s.dragVelY    = 0
      s.lastMoveTime = performance.now()
      setIsDragging(true)
      e.preventDefault()
    }

    const onMove = (e) => {
      const s = st.current
      if (!s.dragging) return
      const { x, y } = getPos(e)
      const dx = x - s.lastX
      const dy = y - s.lastY
      const now = performance.now()
      const elapsed = Math.max(1, now - s.lastMoveTime)
      s.lastX = x
      s.lastY = y
      s.lastMoveTime = now

      // Drag sensitivity: 1:1 horizontal, scaled vertical
      s.spinX -= dx
      s.spinX = ((s.spinX % size) + size) % size

      // Vertical: full drag of (size / 2) px = 30% latitude shift
      const latSensitivity = 30 / Math.max(size / 2, 1)
      s.offsetY += dy * latSensitivity
      s.offsetY  = Math.max(15, Math.min(85, s.offsetY))

      // Track instantaneous velocity for momentum on release
      s.dragVelX = -(dx / elapsed) * 1000   // px/s, inverted (drag-right = spin-west)
      s.dragVelY =  (dy / elapsed) * 1000 * latSensitivity

      e.preventDefault()
    }

    const onUp = () => {
      const s = st.current
      if (!s.dragging) return
      s.dragging = false
      // Hand off drag velocity to the momentum system
      s.velX = s.dragVelX * 0.35
      s.velY = s.dragVelY * 0.30
      setIsDragging(false)
    }

    el.addEventListener('mousedown',  onDown)
    el.addEventListener('touchstart', onDown, { passive: false })
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('touchmove',  onMove, { passive: false })
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchend',  onUp)

    return () => {
      el.removeEventListener('mousedown',  onDown)
      el.removeEventListener('touchstart', onDown)
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('touchmove',  onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchend',  onUp)
    }
  }, [interactive, size])

  /* ── Dot size scales with globe ── */
  const dotSize1 = Math.max(6, Math.round(size * 0.055))
  const dotSize2 = Math.max(5, Math.round(size * 0.048))

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width:  size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style,
      }}
    >
      {/* ── Atmosphere glow ── */}
      <div style={{
        position: 'absolute',
        inset: -(size * 0.14),
        borderRadius: '50%',
        background: atmosphereColor,
        filter: `blur(${Math.round(size * 0.09)}px)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Orbital ring 1 ── */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width:     orbitW1, height: orbitW1,
        marginLeft: -(orbitW1 / 2), marginTop: -(orbitW1 / 2),
        borderRadius: '50%',
        border: `${Math.max(1, size * 0.008)}px solid ${ring1Border}`,
        boxShadow: ring1Shadow,
        animation: 'worldOrbit1 7s linear infinite',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top:  -(dotSize1 / 2), left: '50%', marginLeft: -(dotSize1 / 2),
          width: dotSize1, height: dotSize1, borderRadius: '50%',
          background: dot1Bg,
          boxShadow: dot1Shadow,
        }} />
      </div>

      {/* ── Orbital ring 2 ── */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width:     orbitW2, height: orbitW2,
        marginLeft: -(orbitW2 / 2), marginTop: -(orbitW2 / 2),
        borderRadius: '50%',
        border: `${Math.max(1, size * 0.007)}px solid ${ring2Border}`,
        animation: 'worldOrbit2 11s linear infinite',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute',
          top:  -(dotSize2 / 2), left: '50%', marginLeft: -(dotSize2 / 2),
          width: dotSize2, height: dotSize2, borderRadius: '50%',
          background: dot2Bg,
          boxShadow: dot2Shadow,
        }} />
      </div>

      {/* ── Earth sphere ── */}
      <div style={{
        width: size, height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative', zIndex: 1,
        flexShrink: 0,
        boxShadow: sphereGlow,
      }}>

        {/* Ocean base gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: oceanBase,
        }} />

        {/* Scrolling continent map
            — interactive: driven by rAF via ref, no CSS animation
            — non-interactive: CSS animation as before */}
        <div
          ref={interactive ? textureRef : undefined}
          style={{
            position: 'absolute', inset: 0,
            width: '200%', height: '100%',
            backgroundImage: `url("${earthUri}")`,
            backgroundSize: '50% 100%',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: '0 center',
            // Use CSS keyframe animation when not interactive (simpler, no JS overhead)
            ...(interactive ? {} : { animation: 'earthSpin 22s linear infinite' }),
            willChange: interactive ? 'transform' : 'auto',
          }}
        />

        {/* Specular highlight — top-left */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 32%, transparent 56%)',
          pointerEvents: 'none',
        }} />

        {/* Shadow — bottom-right */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle at 68% 66%, rgba(40,10,0,0.55) 0%, transparent 55%)'
            : 'radial-gradient(circle at 68% 66%, rgba(0,0,35,0.60) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />

        {/* Edge vignette */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(30,8,0,0.75) 100%)'
            : 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(0,5,28,0.80) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle latitude haze */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'linear-gradient(180deg, rgba(255,200,120,0.06) 0%, transparent 38%, transparent 62%, rgba(30,5,0,0.12) 100%)'
            : 'linear-gradient(180deg, rgba(180,220,255,0.04) 0%, transparent 38%, transparent 62%, rgba(0,10,40,0.10) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Drag hint ring — only shows when interactive and idle */}
        {interactive && !isDragging && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Drag hint label — only on large interactive globes */}
      {interactive && size >= 120 && (
        <div style={{
          position: 'absolute',
          bottom: -(size * 0.22),
          left: '50%',
          transform: 'translateX(-50%)',
          font: `400 ${Math.round(size * 0.075)}px var(--font-body, sans-serif)`,
          color: 'rgba(255,255,255,0.18)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}>
          drag to explore
        </div>
      )}
    </div>
  )
}
