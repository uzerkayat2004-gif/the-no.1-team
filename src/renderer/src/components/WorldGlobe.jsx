import React, { useRef, useEffect, useState, useCallback } from 'react'

/* ── Earth SVG texture — single 400×200 equirectangular map ── */
function buildEarthTextureSVG(ocean, land, land2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
    <rect width="400" height="200" fill="${ocean}"/>
    <polygon fill="${land}"  points="95,2 115,0 132,2 140,10 136,19 119,23 99,19 90,10"/>
    <polygon fill="${land}"  points="141,14 152,12 158,17 155,23 145,25 139,20"/>
    <polygon fill="${land2}" points="30,22 56,14 82,9 110,8 137,12 158,24 169,38 174,57 170,76 159,91 143,104 122,113 98,119 76,121 56,117 41,106 31,89 26,68 26,46"/>
    <polygon fill="${land}"  points="87,111 101,116 109,130 102,136 86,131 78,121"/>
    <polygon fill="${land2}" points="66,120 96,113 122,112 142,118 156,134 162,154 160,174 151,190 133,199 111,200 91,197 74,183 64,163 60,141 64,128"/>
    <polygon fill="${land}"  points="148,20 158,16 165,21 161,29 151,31 144,26"/>
    <polygon fill="${land2}" points="157,17 177,10 196,10 213,15 221,27 221,46 212,57 197,65 179,67 162,61 153,50 151,36 154,24"/>
    <polygon fill="${land2}" points="144,67 166,60 186,60 204,67 216,82 222,103 222,129 217,155 205,171 186,181 165,183 146,176 133,158 126,131 126,107 133,85 138,74"/>
    <polygon fill="${land}"  points="221,151 229,147 233,159 231,171 222,169 218,159"/>
    <polygon fill="${land2}" points="179,15 228,6 278,4 326,6 368,11 394,20 400,36 400,64 394,86 379,104 356,116 325,122 291,124 260,121 232,113 208,101 190,87 181,66 177,43"/>
    <polygon fill="${land}"  points="197,83 220,75 240,79 246,98 240,114 226,120 209,115 199,103 195,91"/>
    <polygon fill="${land2}" points="214,80 234,71 252,73 263,88 261,110 250,124 232,129 215,122 207,107 209,89"/>
    <polygon fill="${land}"  points="248,131 256,129 259,138 255,144 247,140"/>
    <polygon fill="${land2}" points="267,110 296,103 320,108 330,122 327,142 311,152 287,150 267,138 261,123"/>
    <polygon fill="${land}"  points="363,36 377,33 387,40 385,54 374,61 363,56 359,44"/>
    <polygon fill="${land}"  points="349,82 355,80 358,88 354,95 347,91"/>
    <polygon fill="${land}"  points="333,107 347,104 355,114 352,130 340,133 330,124"/>
    <polygon fill="${land2}" points="300,143 343,137 369,139 386,151 394,168 392,184 377,194 350,198 324,196 302,185 290,171 287,156 292,146"/>
    <polygon fill="${land}"  points="392,174 400,169 400,185 394,183"/>
  </svg>`
}

/* ────────────────────────────────────────────────────────────────────────────
   Pure-JS quaternion math  (no Three.js required)
   ────────────────────────────────────────────────────────────────────────── */
const Q_ID = Object.freeze({ x: 0, y: 0, z: 0, w: 1 })

function qnorm({ x, y, z, w }) {
  const m = Math.sqrt(x*x + y*y + z*z + w*w) || 1
  return { x: x/m, y: y/m, z: z/m, w: w/m }
}

function qmul(a, b) {
  return {
    x:  a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    y:  a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    z:  a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    w:  a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
  }
}

function qfromAxisAngle(ax, ay, az, angle) {
  const s = Math.sin(angle / 2)
  const len = Math.sqrt(ax*ax + ay*ay + az*az) || 1
  return { x: (ax/len)*s, y: (ay/len)*s, z: (az/len)*s, w: Math.cos(angle/2) }
}

/* Slerp toward identity by fraction t (used for momentum decay) */
function qslerp(q, t) {
  let { x, y, z, w } = q
  // Ensure we take the short path (w >= 0)
  if (w < 0) { x=-x; y=-y; z=-z; w=-w }
  w = Math.min(1, w)
  const theta  = Math.acos(w)           // half-angle
  const sinTh  = Math.sin(theta)
  if (sinTh < 1e-6) return Q_ID         // already identity
  const wa = Math.sin((1-t)*theta) / sinTh
  const wb = Math.sin(t*theta)     / sinTh
  return qnorm({ x: wa*x, y: wa*y, z: wa*z, w: wa*w + wb })
}

/* Convert quaternion to column-major 3×3 rotation matrix (flat 9-element array) */
function qtoMatrix(q) {
  const { x, y, z, w } = q
  return [
    1-2*(y*y+z*z),   2*(x*y-z*w),   2*(x*z+y*w),
      2*(x*y+z*w), 1-2*(x*x+z*z),   2*(y*z-x*w),
      2*(x*z-y*w),   2*(y*z+x*w), 1-2*(x*x+y*y),
  ]
}

/* Arcball: map screen point (sx,sy) inside [0,size]² → unit sphere vector */
function arcball(sx, sy, size) {
  const nx = (sx / size) * 2 - 1
  const ny = -(( sy / size) * 2 - 1)   // flip Y (screen down = sphere south)
  const r2 = nx*nx + ny*ny
  if (r2 <= 1) return [nx, ny, Math.sqrt(1 - r2)]
  const r  = Math.sqrt(r2)
  return [nx/r, ny/r, 0]
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldGlobe — Canvas 2D sphere with true trackball rotation in every direction
   Props:
     size        — diameter in px (default 80)
     interactive — enable full-3D drag rotation (default false)
     style       — extra wrapper styles
   ────────────────────────────────────────────────────────────────────────── */
export default function WorldGlobe({ size = 80, interactive = false, style = {} }) {

  /* ── Theme ── */
  const [isLight, setIsLight] = useState(
    () => typeof document !== 'undefined' &&
          document.documentElement.getAttribute('data-theme') === 'light'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  /* ── Colors ── */
  const oceanColor = isLight ? '#A8714A' : '#082356'
  const landColor  = isLight ? '#6B4A1E' : '#2e6b28'
  const landColor2 = isLight ? '#4E6B18' : '#3a8232'

  const atmosphereColor = isLight
    ? 'radial-gradient(circle, rgba(196,79,0,0.20) 45%, rgba(160,60,0,0.08) 70%, transparent 100%)'
    : 'radial-gradient(circle, rgba(60,130,255,0.16) 45%, rgba(20,70,180,0.07) 70%, transparent 100%)'
  const sphereGlow = isLight
    ? `0 0 0 1.5px rgba(196,79,0,0.28), 0 0 ${Math.round(size*.45)}px rgba(130,50,0,.50), 0 6px ${Math.round(size*.3)}px rgba(0,0,0,.50)`
    : `0 0 0 1.5px rgba(80,160,255,0.22), 0 0 ${Math.round(size*.45)}px rgba(15,65,160,.55), 0 6px ${Math.round(size*.3)}px rgba(0,0,0,.65)`

  const ring1Border = isLight ? 'rgba(196,120,40,0.42)' : 'rgba(90,190,255,0.40)'
  const ring1Shadow = isLight ? '0 0 8px rgba(196,100,20,0.12) inset' : '0 0 8px rgba(90,190,255,0.10) inset'
  const ring2Border = isLight ? 'rgba(160,100,30,0.32)' : 'rgba(170,130,255,0.32)'
  const dot1Bg      = isLight
    ? 'radial-gradient(circle, #FFE0A0 0%, #E08820 55%, transparent 100%)'
    : 'radial-gradient(circle, #c8eeff 0%, #5abcff 55%, transparent 100%)'
  const dot1Shadow  = isLight
    ? '0 0 8px rgba(230,140,0,1), 0 0 18px rgba(230,120,0,0.5)'
    : '0 0 8px rgba(90,200,255,1), 0 0 18px rgba(90,200,255,0.5)'
  const dot2Bg      = isLight
    ? 'radial-gradient(circle, #FFD080 0%, #C07010 55%, transparent 100%)'
    : 'radial-gradient(circle, #eedeff 0%, #b080ff 55%, transparent 100%)'
  const dot2Shadow  = isLight
    ? '0 0 7px rgba(200,120,0,0.9), 0 0 14px rgba(180,100,0,0.4)'
    : '0 0 7px rgba(170,130,255,0.9), 0 0 14px rgba(170,130,255,0.4)'

  const orbitW1  = size * 1.78
  const orbitW2  = size * 1.52
  const dotSize1 = Math.max(6, Math.round(size * 0.055))
  const dotSize2 = Math.max(5, Math.round(size * 0.048))

  /* ── Refs ── */
  const canvasRef = useRef(null)
  const stateRef  = useRef({
    quat:    { ...Q_ID },   // current globe rotation
    quatVel: { ...Q_ID },   // momentum velocity quaternion
    texData: null,          // ImageData of the 400×200 texture
    texW: 400, texH: 200,
    dragging: false,
    lastV:    null,         // last arcball vector [x,y,z]
    deltaQ:   { ...Q_ID },  // rotation applied during current drag frame
  })
  const [dragging, setDragging] = useState(false)

  /* ── Load texture ── */
  useEffect(() => {
    let alive = true
    const svg = buildEarthTextureSVG(oceanColor, landColor, landColor2)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      const oc  = document.createElement('canvas')
      oc.width  = 400; oc.height = 200
      const ctx = oc.getContext('2d')
      ctx.drawImage(img, 0, 0, 400, 200)
      stateRef.current.texData = ctx.getImageData(0, 0, 400, 200)
    }
    img.src = url
    return () => { alive = false }
  }, [oceanColor, landColor, landColor2])

  /* ── Canvas 2D render loop — true spherical projection ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: false })

    /* Fixed screen-space light direction — stays top-left regardless of rotation */
    /* normalize([-1.7, 1.0, 2.3]) */
    const lx = -0.544, ly = 0.320, lz = 0.736

    const AUTO_SPEED = 0.004   // rad/frame for gentle westward auto-spin
    const TWO_PI = Math.PI * 2

    let animId

    function frame() {
      animId = requestAnimationFrame(frame)
      const s = stateRef.current
      const td = s.texData
      if (!td) return   // wait for texture to load

      /* ── Update rotation ── */
      if (!s.dragging) {
        const { x, y, z, w } = s.quatVel
        const halfAngle = Math.acos(Math.max(-1, Math.min(1, Math.abs(w))))
        if (halfAngle > 0.0005) {
          /* Apply momentum, decay toward identity */
          s.quat    = qnorm(qmul(s.quat, s.quatVel))
          s.quatVel = qslerp(s.quatVel, 0.05)   // decay 5% per frame toward identity
        } else {
          /* Auto westward spin */
          const aq  = qfromAxisAngle(0, 1, 0, AUTO_SPEED)
          s.quat    = qnorm(qmul(s.quat, aq))
          s.quatVel = { ...Q_ID }
        }
      } else {
        /* Consume accumulated drag delta */
        s.quat   = qnorm(qmul(s.quat, s.deltaQ))
        s.deltaQ = { ...Q_ID }
      }

      /* ── Build inverse rotation matrix (M^T since M is orthogonal) ── */
      /* We want: world_point = M^T * screen_point
         so that texture coords follow the rotation correctly */
      const M = qtoMatrix(s.quat)
      /* M^T is just the transposed layout */
      const m0=M[0], m1=M[3], m2=M[6]
      const m3=M[1], m4=M[4], m5=M[7]
      const m6=M[2], m7=M[5], m8=M[8]

      /* ── Render pixels ── */
      const imgData = ctx.createImageData(size, size)
      const buf     = imgData.data
      const { texW, texH } = s
      const R       = size / 2  // sphere radius in px

      for (let py = 0; py < size; py++) {
        /* Normalized y (positive = north / up) */
        const ny  = -((py - R) / R)
        const ny2 = ny * ny

        for (let px = 0; px < size; px++) {
          const nx = (px - R) / R
          const r2 = nx*nx + ny2
          if (r2 > 1) continue   // outside sphere circle

          const nz = Math.sqrt(1 - r2)

          /* Rotate screen-space point by M^T to get world-space position */
          const wx = m0*nx + m1*ny + m2*nz
          const wy = m3*nx + m4*ny + m5*nz
          const wz = m6*nx + m7*ny + m8*nz

          /* Spherical → UV */
          const lon = Math.atan2(wx, wz)                         // −π … +π
          const lat = Math.asin(Math.max(-1, Math.min(1, wy)))   // −π/2 … +π/2

          const u = (lon / TWO_PI + 0.5)         // 0…1  west→east
          const v = 0.5 - lat / Math.PI           // 0…1  north→south

          /* Nearest-neighbour texture sample */
          const tx = Math.min(texW-1, Math.floor(u * texW + 0.5) | 0)
          const ty = Math.min(texH-1, Math.floor(v * texH + 0.5) | 0)
          const ti = (ty * texW + tx) * 4

          /* Screen-space diffuse shading (normal = screen-space sphere point) */
          const diff  = nx*lx + ny*ly + nz*lz
          const shade = Math.max(0.28, diff)

          const pi  = (py * size + px) * 4
          buf[pi]   = (td.data[ti]   * shade + 0.5) | 0
          buf[pi+1] = (td.data[ti+1] * shade + 0.5) | 0
          buf[pi+2] = (td.data[ti+2] * shade + 0.5) | 0
          buf[pi+3] = 255
        }
      }

      ctx.putImageData(imgData, 0, 0)
    }

    animId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animId)
  }, [size])   // only depends on size; texData & quat are read via ref

  /* ── Trackball drag handlers ── */
  useEffect(() => {
    if (!interactive) return
    const canvas = canvasRef.current
    if (!canvas) return

    function getPos(e) {
      const r = canvas.getBoundingClientRect()
      const src = e.touches ? e.touches[0] : e
      return { x: src.clientX - r.left, y: src.clientY - r.top }
    }

    const onDown = (e) => {
      const { x, y } = getPos(e)
      const s = stateRef.current
      s.dragging  = true
      s.lastV     = arcball(x, y, size)
      s.deltaQ    = { ...Q_ID }
      /* Kill any existing momentum */
      s.quatVel   = { ...Q_ID }
      setDragging(true)
      e.preventDefault()
    }

    const onMove = (e) => {
      const s = stateRef.current
      if (!s.dragging) return
      const { x, y } = getPos(e)
      const v1 = s.lastV
      const v2 = arcball(x, y, size)

      /* Rotation axis = cross(v1, v2), angle = angle between them */
      const ax = v1[1]*v2[2] - v1[2]*v2[1]
      const ay = v1[2]*v2[0] - v1[0]*v2[2]
      const az = v1[0]*v2[1] - v1[1]*v2[0]
      const axLen = Math.sqrt(ax*ax + ay*ay + az*az)

      if (axLen > 1e-8) {
        /* dot product clamped for safety */
        const dot   = Math.max(-1, Math.min(1, v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]))
        const angle = Math.acos(dot) * 1.8   // × 1.8 = slight amplification for responsiveness
        const q     = qfromAxisAngle(ax/axLen, ay/axLen, az/axLen, angle)
        /* Accumulate into the frame's delta (render loop consumes it) */
        s.deltaQ    = qnorm(qmul(q, s.deltaQ))
        /* Use last delta as the momentum velocity for on-release */
        s.quatVel   = { ...q }
      }

      s.lastV = v2
      e.preventDefault()
    }

    const onUp = () => {
      const s = stateRef.current
      s.dragging = false
      /* quatVel was set on last onMove — momentum system takes over from here */
      setDragging(false)
    }

    canvas.addEventListener('mousedown',  onDown)
    canvas.addEventListener('touchstart', onDown, { passive: false })
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('touchmove',  onMove, { passive: false })
    window.addEventListener('mouseup',    onUp)
    window.addEventListener('touchend',   onUp)

    return () => {
      canvas.removeEventListener('mousedown',  onDown)
      canvas.removeEventListener('touchstart', onDown)
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('touchmove',  onMove)
      window.removeEventListener('mouseup',    onUp)
      window.removeEventListener('touchend',   onUp)
    }
  }, [interactive, size])

  /* ── Render ── */
  return (
    <div style={{
      position: 'relative',
      width: orbitW1, height: orbitW1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>

      {/* Atmosphere glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: size*1.32, height: size*1.32,
        marginLeft: -(size*1.32/2), marginTop: -(size*1.32/2),
        borderRadius: '50%',
        background: atmosphereColor,
        filter: `blur(${Math.round(size*0.10)}px)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Orbital ring 1 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: orbitW1, height: orbitW1,
        marginLeft: -(orbitW1/2), marginTop: -(orbitW1/2),
        borderRadius: '50%',
        border: `${Math.max(1, size*0.008)}px solid ${ring1Border}`,
        boxShadow: ring1Shadow,
        animation: 'worldOrbit1 7s linear infinite',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: -(dotSize1/2), left: '50%', marginLeft: -(dotSize1/2),
          width: dotSize1, height: dotSize1, borderRadius: '50%',
          background: dot1Bg, boxShadow: dot1Shadow,
        }} />
      </div>

      {/* Orbital ring 2 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: orbitW2, height: orbitW2,
        marginLeft: -(orbitW2/2), marginTop: -(orbitW2/2),
        borderRadius: '50%',
        border: `${Math.max(1, size*0.007)}px solid ${ring2Border}`,
        animation: 'worldOrbit2 11s linear infinite',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: -(dotSize2/2), left: '50%', marginLeft: -(dotSize2/2),
          width: dotSize2, height: dotSize2, borderRadius: '50%',
          background: dot2Bg, boxShadow: dot2Shadow,
        }} />
      </div>

      {/* Globe sphere (canvas + CSS overlays) */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: size, height: size,
        borderRadius: '50%', overflow: 'hidden',
        boxShadow: sphereGlow,
        cursor: interactive ? (dragging ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none', WebkitUserSelect: 'none',
        flexShrink: 0,
      }}>

        {/* Canvas 2D — spherical projection renders here */}
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ display: 'block', width: size, height: size }}
        />

        {/* Specular highlight — top-left, screen-fixed */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.07) 30%, transparent 54%)',
          pointerEvents: 'none',
        }} />

        {/* Day-shadow — bottom-right */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle at 68% 66%, rgba(40,10,0,0.50) 0%, transparent 52%)'
            : 'radial-gradient(circle at 68% 66%, rgba(0,0,40,0.62) 0%, transparent 52%)',
          pointerEvents: 'none',
        }} />

        {/* Edge vignette */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle at 50% 50%, transparent 54%, rgba(30,8,0,0.72) 100%)'
            : 'radial-gradient(circle at 50% 50%, transparent 54%, rgba(0,5,28,0.78) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Latitude haze */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isLight
            ? 'linear-gradient(180deg, rgba(255,200,120,0.05) 0%, transparent 38%, transparent 62%, rgba(30,5,0,0.10) 100%)'
            : 'linear-gradient(180deg, rgba(180,220,255,0.04) 0%, transparent 38%, transparent 62%, rgba(0,10,40,0.10) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* "drag to explore" hint */}
      {interactive && size >= 120 && (
        <div style={{
          position: 'absolute',
          bottom: -(size * 0.20),
          left: '50%', transform: 'translateX(-50%)',
          font: `400 ${Math.round(size * 0.072)}px var(--font-body, sans-serif)`,
          color: 'rgba(255,255,255,0.18)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none', letterSpacing: '0.06em',
          userSelect: 'none',
        }}>
          drag to explore
        </div>
      )}
    </div>
  )
}
