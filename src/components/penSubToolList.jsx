import React from 'react'
import { PEN_SUB_TOOLS } from '../utils/penTool'

export const PEN_SUB_TOOL_LIST = [
  {
    id: PEN_SUB_TOOLS.SELECT,
    label: 'Selection Tool',
    desc: 'Select and move entire objects (V)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
        <path d="M3 3l7 18 2.5-7.5L20 11z" />
      </svg>
    ),
  },
  {
    id: PEN_SUB_TOOLS.DIRECT_SELECT,
    label: 'Direct Selection',
    desc: 'Select and move anchor points and handles (A)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 3l7 18 2.5-7.5L20 11z" strokeLinejoin="round" />
        <rect x="16" y="16" width="5" height="5" rx="0.5" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: PEN_SUB_TOOLS.PEN,
    label: 'Pen Tool',
    desc: 'Click to place anchor points, drag to create curves (P)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: PEN_SUB_TOOLS.ADD_POINT,
    label: 'Add Anchor Point',
    desc: 'Add anchor points to existing paths (+)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <line x1="8" y1="18" x2="8" y2="24" strokeWidth="2" />
        <line x1="5" y1="21" x2="11" y2="21" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: PEN_SUB_TOOLS.DELETE_POINT,
    label: 'Delete Anchor Point',
    desc: 'Remove anchor points from paths (-)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <line x1="5" y1="21" x2="11" y2="21" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: PEN_SUB_TOOLS.CONVERT_POINT,
    label: 'Anchor Point Tool',
    desc: 'Drag to create handles, click handle to break link (Shift+C)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20L10 4" />
        <path d="M10 4Q17 4 20 12" />
        <rect x="2" y="18" width="4" height="4" rx="0.5" />
        <circle cx="10" cy="4" r="2.5" />
        <circle cx="20" cy="12" r="2.5" />
      </svg>
    ),
  },
]
