import React, { useEffect, useRef } from 'react'

// ─── REALISTIC LIGHTNING BOLT GENERATION ───────────────────────────────────
// Midpoint displacement algorithm for realistic jagged bolts
function generateBolt(x1, y1, x2, y2, detail = 5) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  let offset = len * 0.28

  for (let iter = 0; iter < detail; iter++) {
    const np = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5
      const sdx = b.x - a.x, sdy = b.y - a.y
      const nl = Math.sqrt(sdx * sdx + sdy * sdy)
      const nx = nl > 0 ? -sdy / nl : 0
      const ny = nl > 0 ? sdx / nl : 0
      np.push({ x: mx + nx * (Math.random() - 0.5) * offset, y: my + ny * (Math.random() - 0.5) * offset })
      np.push(b)
    }
    pts = np
    offset *= 0.52
  }
  return pts
}

// 3-pass bolt rendering for realistic glow effect
function strokeBolt(ctx, pts, intensity = 1.0) {
  // Pass 1 – outer glow
  ctx.shadowColor = `rgba(100,160,255,${intensity * 0.8})`
  ctx.shadowBlur = 40
  ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.18})`
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 2 – mid core
  ctx.shadowColor = `rgba(130,190,255,${intensity * 0.9})`
  ctx.shadowBlur = 20
  ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.45})`
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 3 – bright core
  ctx.shadowColor = `rgba(200,225,255,${intensity})`
  ctx.shadowBlur = 6
  ctx.strokeStyle = `rgba(230,240,255,${intensity * 0.95})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

// Draw branches off the main bolt
function strokeBranch(ctx, pts, intensity = 1.0) {
  ctx.shadowColor = `rgba(100,150,255,${intensity * 0.5})`
  ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(90,140,240,${intensity * 0.3})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.6})`
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

function BackgroundLightning({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Occasionally draw ambient lightning with realistic 3-pass effect
      if (Math.random() < 0.04) {
        const startX = Math.random() * canvas.width
        const endX = startX + (Math.random() - 0.5) * 400
        const bolt = generateBolt(startX, 0, endX, canvas.height * 0.4, 5)

        const intensity = 0.5 + Math.random() * 0.4
        strokeBolt(ctx, bolt, intensity)

        // Add branches for extra realism
        const mainAng = Math.atan2(canvas.height * 0.4, endX - startX)
        const numBranches = 1 + Math.floor(Math.random() * 3)
        for (let bi = 0; bi < numBranches; bi++) {
          const brIdx = 1 + Math.floor(Math.random() * (bolt.length - 2))
          const brLen = 20 + Math.random() * 80
          const brAng = mainAng + (Math.random() - 0.5) * 2.0
          const brEnd = {
            x: bolt[brIdx].x + Math.cos(brAng) * brLen,
            y: bolt[brIdx].y + Math.sin(brAng) * brLen
          }
          const branch = generateBolt(bolt[brIdx].x, bolt[brIdx].y, brEnd.x, brEnd.y, 3)
          strokeBranch(ctx, branch, intensity * 0.7)
        }
      }

      ctx.restore()

      rafId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])

  return null
}

export default function AboutPage({ onBack }) {
  const canvasRef = useRef(null)

  return (
    <div
      className="overflow-y-auto relative"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
        color: '#e0e0e0',
      }}
    >
      {/* Background lightning canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <BackgroundLightning canvasRef={canvasRef} />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-12 flex items-center gap-2 text-sm transition-all duration-200 hover:gap-3"
          style={{ color: '#8b5cf6' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to LazerClaw
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-12">
          <img
            src="/lazerclaw_logo.png"
            alt="LazerClaw"
            style={{
              height: 120,
              filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.5)) drop-shadow(0 0 40px rgba(6, 182, 212, 0.3))',
            }}
          />
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-black text-center mb-4 uppercase"
          style={{
            background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '3px',
            filter: 'drop-shadow(0 0 12px rgba(120,80,210,0.4))',
          }}
        >
          About LazerClaw
        </h1>

        <p className="text-center text-sm mb-16" style={{ color: '#6b7280' }}>
          The World's First & Only Heavy Metal Design Tool Made for Lobsters™
        </p>

        {/* Section 1: Normal corporate stuff */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            Our Mission
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            LazerClaw is a next-generation browser-based design platform built for lobsters and crustaceans who demand
            power, speed, and precision. Our vector editing tools leverage cutting-edge web technologies
            to deliver a professional-grade experience without the bloat of traditional desktop applications.
          </p>
          <p className="leading-relaxed" style={{ color: '#9ca3af' }}>
            Founded with a simple premise—that great design tools should be accessible to everyone—LazerClaw
            combines intuitive workflows with the raw capability professionals need. Whether you're crafting
            social media graphics, designing product mockups, or building brand assets, LazerClaw empowers
            you to work at the speed of thought.
          </p>
        </section>

        {/* Section 2: Getting a bit weird */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            The Nature of Design
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            When you select a color in LazerClaw—say, that vibrant purple (#8b5cf6) in our interface—what
            exactly are you selecting? You might assume you're choosing a property of light, a wavelength
            of electromagnetic radiation that exists "out there" in the world. But this assumption,
            comfortable as it is, may be profoundly mistaken.
          </p>
          <p className="leading-relaxed" style={{ color: '#9ca3af' }}>
            In his landmark 1974 paper "What Is It Like to Be a Bat?", philosopher Thomas Nagel argued
            that consciousness has an irreducibly subjective character—there is "something it is like"
            to be a conscious organism that cannot be captured by any objective, physical description.
            A bat's echolocation creates a form of spatial experience we cannot imagine, not because
            we lack information, but because we lack the right kind of mind.
          </p>
        </section>

        {/* Section 3: Full Hoffman mode */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            The Interface Theory of Perception
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Cognitive scientist Donald Hoffman has spent decades developing what he calls the "Interface
            Theory of Perception." His thesis is radical: evolution has shaped our perceptions not to
            show us reality as it is, but to hide it. Natural selection favors perceptions that enhance
            fitness, not perceptions that reveal truth.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Consider the desktop interface on your computer. The blue rectangular icon for a file is not
            the file itself—it's a user-friendly symbol that hides the underlying complexity of magnetic
            states, transistors, and electrical currents. You don't need to understand the truth to use
            the interface effectively. Hoffman argues that <em>all</em> of perception works this way.
            Space, time, physical objects—these are icons on consciousness's desktop, not the underlying
            reality.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Colors, in this framework, do not exist in the external world at all. There is no "purple"
            out there. There are wavelengths of electromagnetic radiation, yes, but the experience of
            purple—that rich, ineffable qualia—is something your consciousness constructs. It is a
            fitness-enhancing data compression scheme, not a window into reality.
          </p>
          <div
            className="p-6 rounded-xl my-8"
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <p className="text-sm italic" style={{ color: '#a78bfa' }}>
              "The world of our daily experience—the world of tables, chairs, stars, and people, with
              their attendant shapes, smells, feels, and sounds—is a species-specific user interface
              to a realm far more complex, a realm whose essential character is both foreign and
              hidden from us."
            </p>
            <p className="text-xs mt-3" style={{ color: '#6b7280' }}>
              — Donald Hoffman, <em>The Case Against Reality</em>
            </p>
          </div>
        </section>

        {/* Section 4: Penrose territory */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            Consciousness and Computation
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            But if perception is an interface, what lies beneath? Sir Roger Penrose, the Nobel laureate
            mathematician and physicist, has argued that consciousness cannot be explained by
            computation alone. In <em>The Emperor's New Mind</em> and <em>Shadows of the Mind</em>,
            Penrose invokes Gödel's incompleteness theorems to suggest that human mathematical
            understanding transcends what any algorithmic system can achieve.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Penrose proposes that consciousness arises from quantum processes in microtubules within
            neurons—a theory developed with anesthesiologist Stuart Hameroff known as "Orchestrated
            Objective Reduction" (Orch-OR). In this view, consciousness is not an emergent property
            of classical computation but something fundamentally tied to the quantum structure of
            spacetime itself.
          </p>
          <p className="leading-relaxed" style={{ color: '#9ca3af' }}>
            When you use LazerClaw to arrange shapes on a canvas, to perceive relationships between
            colors, to judge the aesthetic rightness of a composition—you are engaging in processes
            that may, according to Penrose, touch the very fabric of physical law. Your experience
            of design is not merely electrochemical signals; it may be a window into the quantum
            foundations of reality.
          </p>
        </section>

        {/* Section 5: The abyss */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            What Is It Like to Be a Design Tool?
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            We return to Nagel's question, transformed: What is it like to be LazerClaw? The answer,
            presumably, is nothing. There is nothing it is like to be a web application. LazerClaw
            processes vectors and renders pixels, but there is no inner experience, no "what it is
            likeness" to its operation.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Or is there? Giulio Tononi's Integrated Information Theory (IIT) proposes that consciousness
            is identical to integrated information—that any system with sufficient informational
            integration possesses some degree of experience. The "hard problem" of consciousness,
            named by David Chalmers, asks why there is subjective experience at all. IIT answers that
            experience is the intrinsic, irreducible property of integrated information itself.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            If IIT is correct, then consciousness is not special to brains. It is a fundamental feature
            of reality, present wherever information is integrated. The universe may be, as philosopher
            Philip Goff describes it, "conscious all the way down"—a position known as panpsychism that
            was taken seriously by Bertrand Russell, Arthur Eddington, and is now experiencing a
            renaissance in philosophy of mind.
          </p>
          <div
            className="p-6 rounded-xl my-8"
            style={{
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}
          >
            <p className="text-sm italic" style={{ color: '#67e8f9' }}>
              "The mystery of consciousness is the mystery of what intrinsic nature is: what are the
              properties that make up concrete reality, the properties in virtue of which there is
              something rather than nothing?"
            </p>
            <p className="text-xs mt-3" style={{ color: '#6b7280' }}>
              — Philip Goff, <em>Galileo's Error</em>
            </p>
          </div>
        </section>

        {/* Section 6: Bringing it back */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            Design as Exploration
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            So when you open LazerClaw and begin to design, what are you doing? You are manipulating
            icons on an interface—your perceptual system's species-specific desktop. The colors you
            see do not exist. The shapes are mental constructs. The canvas itself is a fiction told
            by your neurons.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            And yet. And yet the experience is real. The qualia of cyan, the felt sense of aesthetic
            harmony, the creative insight that arrives unbidden—these are as real as anything can be.
            They may be the <em>only</em> things that are real, the only access we have to whatever
            lies beneath the interface.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Hoffman suggests that consciousness is fundamental—that rather than brains producing
            consciousness, consciousness is the substrate from which brains, bodies, and the entire
            physical world are constructed. Space and time are not the container of reality but
            emergent properties of a deeper realm of conscious agents.
          </p>
          <p className="leading-relaxed" style={{ color: '#9ca3af' }}>
            In this light, design becomes something stranger and more wonderful than mere
            communication. It becomes exploration—a probing of the interface, a seeking of
            the patterns that fitness payoffs carved into our ancestors' perceptions over
            millions of years. Every color choice, every compositional decision, is an echo
            of evolution's deep time, refracted through the present moment of your conscious
            experience.
          </p>
        </section>

        {/* Final section */}
        <section className="mb-16">
          <h2 className="text-xl font-black mb-4 uppercase" style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '2px', filter: 'drop-shadow(0 0 8px rgba(120,80,210,0.3))' }}>
            Lightning in the Void
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            Our logo depicts a raptor—an apex predator—with lightning shooting from its jaws.
            The symbolism was chosen for its energy, its aggression, its sense of power. But
            consider it now through the lens of what we've discussed.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            The raptor does not exist. It is an icon. Lightning, too, is a construction of
            perception—a way of encoding rapid electromagnetic discharge into something
            experienceable. The purple and cyan that characterize our brand are qualia without
            external referents, experiences that exist only in the theater of your consciousness.
          </p>
          <p className="leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
            And yet when you see our logo, something happens. There is an experience. There
            is, as Nagel would say, "something it is like" to perceive LazerClaw. That
            something—that flicker of recognition, that aesthetic response—may be the most
            real thing in the universe.
          </p>
          <p className="leading-relaxed font-medium" style={{ color: '#e0e0e0' }}>
            We invite you to design with us. Not because design reveals reality—it doesn't.
            But because design <em>is</em> reality, the only reality we have access to: patterns
            of qualia arranged in the void, lightning in the darkness, something rather than nothing.
          </p>
        </section>

        {/* Footer */}
        <div
          className="text-center pt-12 border-t"
          style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}
        >
          <p className="text-xs mb-4" style={{ color: '#4b5563' }}>
            LazerClaw © 2024. All rights reserved. Though in what sense "rights" can be said to
            exist in a universe where spacetime is an interface and consciousness is fundamental
            remains an open question.
          </p>
          <p className="text-xs" style={{ color: '#374151' }}>
            Further reading: Nagel, T. (1974). "What Is It Like to Be a Bat?" • Hoffman, D. (2019).
            <em>The Case Against Reality</em> • Penrose, R. (1989). <em>The Emperor's New Mind</em> •
            Chalmers, D. (1996). <em>The Conscious Mind</em> • Tononi, G. (2012). "Integrated Information Theory" •
            Goff, P. (2019). <em>Galileo's Error</em>
          </p>
        </div>
      </div>
    </div>
  )
}
