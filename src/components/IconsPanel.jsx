import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Path, Group, loadSVGFromString } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import BloodFill from './BloodFill'

// Google Material Icons categories with curated icon sets
const MATERIAL_ICON_CATEGORIES = [
  {
    id: 'actions',
    label: 'Actions',
    icons: [
      'search', 'home', 'settings', 'favorite', 'star', 'check_circle', 'delete', 'add_circle',
      'remove_circle', 'edit', 'visibility', 'visibility_off', 'lock', 'lock_open', 'bookmark',
      'share', 'download', 'upload', 'refresh', 'sync', 'done', 'close', 'add', 'remove'
    ]
  },
  {
    id: 'navigation',
    label: 'Navigation',
    icons: [
      'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'chevron_left', 'chevron_right',
      'expand_more', 'expand_less', 'menu', 'more_vert', 'more_horiz', 'apps', 'fullscreen',
      'fullscreen_exit', 'first_page', 'last_page', 'subdirectory_arrow_right', 'unfold_more'
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    icons: [
      'email', 'phone', 'chat', 'message', 'send', 'notifications', 'notifications_off',
      'contact_mail', 'contact_phone', 'call', 'voicemail', 'forum', 'comment', 'textsms',
      'alternate_email', 'mail_outline', 'chat_bubble', 'chat_bubble_outline'
    ]
  },
  {
    id: 'content',
    label: 'Content',
    icons: [
      'content_copy', 'content_cut', 'content_paste', 'add_box', 'create', 'flag', 'link',
      'link_off', 'report', 'save', 'save_alt', 'undo', 'redo', 'filter_list', 'sort',
      'archive', 'unarchive', 'inventory', 'push_pin', 'text_fields'
    ]
  },
  {
    id: 'social',
    label: 'Social',
    icons: [
      'person', 'people', 'group', 'person_add', 'person_remove', 'public', 'share',
      'thumb_up', 'thumb_down', 'mood', 'sentiment_satisfied', 'sentiment_dissatisfied',
      'emoji_emotions', 'cake', 'whatshot', 'local_fire_department', 'verified'
    ]
  },
  {
    id: 'media',
    label: 'Media',
    icons: [
      'play_arrow', 'pause', 'stop', 'skip_next', 'skip_previous', 'fast_forward', 'fast_rewind',
      'volume_up', 'volume_down', 'volume_off', 'mic', 'mic_off', 'videocam', 'videocam_off',
      'image', 'photo_camera', 'movie', 'music_note', 'headphones', 'equalizer'
    ]
  },
  {
    id: 'business',
    label: 'Business',
    icons: [
      'business', 'work', 'attach_money', 'payments', 'account_balance', 'store', 'shopping_cart',
      'shopping_bag', 'receipt', 'trending_up', 'trending_down', 'analytics', 'bar_chart',
      'pie_chart', 'timeline', 'assessment', 'leaderboard', 'insights'
    ]
  },
  {
    id: 'nature',
    label: 'Nature & Weather',
    icons: [
      'wb_sunny', 'nightlight', 'cloud', 'thunderstorm', 'water_drop', 'ac_unit', 'eco',
      'park', 'forest', 'grass', 'landscape', 'terrain', 'waves', 'pets', 'bug_report'
    ]
  },
  {
    id: 'objects',
    label: 'Objects',
    icons: [
      'lightbulb', 'bolt', 'rocket', 'extension', 'build', 'handyman', 'construction',
      'key', 'vpn_key', 'shield', 'security', 'lock', 'timer', 'hourglass_empty',
      'alarm', 'schedule', 'event', 'calendar_today', 'today'
    ]
  },
  {
    id: 'devices',
    label: 'Devices',
    icons: [
      'computer', 'laptop', 'phone_android', 'phone_iphone', 'tablet', 'watch', 'tv',
      'monitor', 'keyboard', 'mouse', 'headset', 'speaker', 'router', 'wifi',
      'bluetooth', 'usb', 'battery_full', 'battery_charging_full'
    ]
  },
]

// Generate Material Symbol SVG URL
const getMaterialIconSvg = (name, style = 'outlined') => {
  // Use Google's Material Symbols API
  return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/48px.svg`
}

function IconGrid({ icons, onAdd, onDragStart, dm, searchTerm }) {
  const filteredIcons = useMemo(() => {
    if (!searchTerm) return icons
    return icons.filter(icon => icon.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [icons, searchTerm])

  if (filteredIcons.length === 0) return null

  return (
    <div className="grid grid-cols-4 gap-1.5 px-1 pb-2">
      {filteredIcons.map(icon => (
        <button
          key={icon}
          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors cursor-pointer group ${
            dm
              ? 'border-gray-600/50 hover:border-blue-500/50 hover:bg-gray-700/60'
              : 'border-gray-100 hover:border-blue-400 hover:bg-blue-50'
          }`}
          onClick={() => onAdd(icon)}
          draggable
          onDragStart={(e) => onDragStart(e, icon)}
          title={icon.replace(/_/g, ' ')}
        >
          <span
            className={`material-symbols-outlined text-xl transition-colors ${
              dm ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-500 group-hover:text-blue-600'
            }`}
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            {icon}
          </span>
        </button>
      ))}
    </div>
  )
}

function CategorySection({ category, onAdd, onDragStart, dm, searchTerm }) {
  const [expanded, setExpanded] = useState(true)

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return category.icons
    return category.icons.filter(icon => icon.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [category.icons, searchTerm])

  if (filteredIcons.length === 0) return null

  return (
    <div className="mb-2">
      <button
        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{category.label}</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            {filteredIcons.length}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 12 12"
            className={`transition-transform ${dm ? 'text-gray-500' : 'text-gray-400'} ${expanded ? 'rotate-0' : '-rotate-90'}`}
          >
            <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {expanded && (
        <IconGrid
          icons={filteredIcons}
          onAdd={onAdd}
          onDragStart={onDragStart}
          dm={dm}
          searchTerm=""
        />
      )}
    </div>
  )
}

export default function IconsPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, saveUndoState, refreshObjects, bloodRain } = canvasState
  const [searchTerm, setSearchTerm] = useState('')
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const markReady = () => { if (!cancelled) setFontsLoaded(true) }

    const existing = document.querySelector('link[href*="Material+Symbols+Outlined"]')
    if (!existing) {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    document.fonts.ready.then(markReady).catch(markReady)
    const fallback = setTimeout(markReady, 2500)
    return () => { cancelled = true; clearTimeout(fallback) }
  }, [])

  const addIcon = useCallback(async (iconName) => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      // Fetch the SVG from Google's Material Symbols
      const svgUrl = getMaterialIconSvg(iconName)
      const response = await fetch(svgUrl)

      if (!response.ok) {
        // Fallback: create a simple text-based representation
        console.warn(`Could not fetch icon ${iconName}, using fallback`)
        return
      }

      const svgText = await response.text()

      saveUndoState()

      const { objects } = await loadSVGFromString(svgText)
      const valid = objects.filter(Boolean)

      if (valid.length === 0) return

      const obj = valid.length === 1 ? valid[0] : new Group(valid)
      obj.set({
        _dtoolId: uuidv4(),
        _dtoolIconName: iconName,
      })

      // Scale to reasonable size
      const targetSize = 80
      const scale = targetSize / Math.max(obj.width || 48, obj.height || 48)
      obj.set({
        scaleX: scale,
        scaleY: scale,
        left: 100 + Math.random() * 50,
        top: 100 + Math.random() * 50,
        fill: '#333333',
      })

      canvas.add(obj)
      canvas.setActiveObject(obj)
      canvas.renderAll()
      refreshObjects()
    } catch (err) {
      console.error('Error adding icon:', err)
    }
  }, [canvasRef, saveUndoState, refreshObjects])

  const handleDragStart = useCallback((e, iconName) => {
    e.dataTransfer.setData('text/plain', `material-icon:${iconName}`)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const totalIcons = useMemo(() =>
    MATERIAL_ICON_CATEGORIES.reduce((sum, cat) => sum + cat.icons.length, 0),
    []
  )

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return MATERIAL_ICON_CATEGORIES
    return MATERIAL_ICON_CATEGORIES.map(cat => ({
      ...cat,
      icons: cat.icons.filter(icon => icon.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(cat => cat.icons.length > 0)
  }, [searchTerm])

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>Icons</span>
          <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{totalIcons} icons</span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search icons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-3 py-1.5 pr-8 text-xs rounded-lg border outline-none transition-colors ${
              dm
                ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-blue-500'
                : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400 focus:border-blue-400'
            }`}
          />
          <svg
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {!fontsLoaded ? (
          <div className={`flex items-center justify-center py-8 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <span className="text-xs">Loading icons...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className={`flex items-center justify-center py-8 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <span className="text-xs">No icons found</span>
          </div>
        ) : (
          filteredCategories.map(category => (
            <CategorySection
              key={category.id}
              category={category}
              onAdd={addIcon}
              onDragStart={handleDragStart}
              dm={dm}
              searchTerm={searchTerm}
            />
          ))
        )}
      </div>

      <div className={`px-3 py-2 border-t text-center ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <a
          href="https://fonts.google.com/icons"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[10px] ${dm ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Powered by Google Material Icons
        </a>
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
