import React from 'react'

const items = [
  {
    id: 'layers',
    label: 'Layers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: 'images',
    label: 'Shapes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <circle cx="17.5" cy="6.5" r="3.5" />
        <path d="M14 14l3.5 7 3.5-7z" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'icons',
    label: 'Icons',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2" />
        <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'ai-tools',
    label: 'AI Tools',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    id: 'lobsters',
    label: 'Lobsters',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19c-3 0-5.5-1-7-3 1-1 2-3 2-5s-1-4-2-5c1.5-2 4-3 7-3s5.5 1 7 3c-1 1-2 3-2 5s1 4 2 5c-1.5 2-4 3-7 3z" />
        <path d="M5 6L2 3" />
        <path d="M19 6l3-3" />
        <path d="M5 6c-1 1-2.5 1.5-4 1" />
        <path d="M19 6c1 1 2.5 1.5 4 1" />
        <circle cx="10" cy="10" r="1" fill="currentColor" />
        <circle cx="14" cy="10" r="1" fill="currentColor" />
      </svg>
    ),
  },
]

// AI Tools panel hidden from nav per product request
const SIDEBAR_ITEMS = items.filter((i) => i.id !== 'ai-tools')

export default function IconSidebar({ activePanel, onSelectPanel, darkMode }) {
  return (
    <div
      className="w-12 flex flex-col items-center py-3 gap-2 shrink-0"
      style={{
        background: darkMode
          ? 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRight: darkMode
          ? '1px solid rgba(100, 160, 255, 0.15)'
          : '1px solid #e2e8f0',
      }}
    >
      {SIDEBAR_ITEMS.map(item => {
        const isActive = activePanel === item.id
        return (
          <button
            key={item.id}
            className="w-10 h-10 flex flex-col items-center justify-center rounded-lg text-[9px] gap-0.5 transition-all duration-200"
            style={{
              background: isActive
                ? (darkMode ? 'rgba(100,160,255,0.2)' : 'rgba(59,130,246,0.1)')
                : 'transparent',
              border: isActive
                ? (darkMode ? '1px solid rgba(100,160,255,0.4)' : '1px solid rgba(59,130,246,0.3)')
                : '1px solid transparent',
              color: isActive
                ? (darkMode ? '#fff' : '#3b82f6')
                : (darkMode ? 'rgba(255,255,255,0.5)' : '#64748b'),
              boxShadow: isActive && darkMode
                ? '0 0 12px rgba(100,160,255,0.2)'
                : 'none',
            }}
            onClick={() => onSelectPanel(isActive ? null : item.id)}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = darkMode ? 'rgba(100,160,255,0.1)' : 'rgba(59,130,246,0.05)'
                e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.8)' : '#3b82f6'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = darkMode ? 'rgba(255,255,255,0.5)' : '#64748b'
              }
            }}
            title={item.label}
          >
            {item.icon}
            <span className="leading-none font-medium">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
