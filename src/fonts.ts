// Font definitions for retro pixel fonts
export interface FontConfig {
  key: string
  path: string
  size: number
  family: string
}

// Import only the fonts we want to keep
import retroPixelPettyUrl from './assets/fonts/retro-pixel-petty-5h.ttf?url'
import retroPixelArcadeUrl from './assets/fonts/retro-pixel-arcade.ttf?url'
import capitalHillUrl from './assets/fonts/Capital_Hill.ttf?url'
import willowBranchUrl from './assets/fonts/Willow_Branch.ttf?url'
import nobleBlabberUrl from './assets/fonts/Noble_Blabber.ttf?url'
import tomorrowNightUrl from './assets/fonts/Tomorrow_Night.ttf?url'

export const fonts = {
  retro: {
    key: 'retro-font',
    path: retroPixelPettyUrl,
    size: 5,
    family: 'RetroPixelPetty'
  },
  arcade: {
    key: 'arcade-font',
    path: retroPixelArcadeUrl,
    size: 8,
    family: 'RetroPixelArcade'
  },
  capitalHill: {
    key: 'capital-hill-font',
    path: capitalHillUrl,
    size: 8,
    family: 'CapitalHill'
  },
  willowBranch: {
    key: 'willow-branch-font',
    path: willowBranchUrl,
    size: 8,
    family: 'WillowBranch'
  },
  nobleBlabber: {
    key: 'noble-blabber-font',
    path: nobleBlabberUrl,
    size: 8,
    family: 'NobleBlabber'
  },
  tomorrowNight: {
    key: 'tomorrow-night-font',
    path: tomorrowNightUrl,
    size: 8,
    family: 'TomorrowNight'
  }
} as const

export type FontKey = keyof typeof fonts

// Load fonts via CSS
let fontsLoaded = false

export function loadFonts(): Promise<void> {
  if (fontsLoaded) return Promise.resolve()
  
  const fontFaces = Object.values(fonts).map(font => {
    return new FontFace(font.family, `url(${font.path})`)
  })
  
  return Promise.all(
    fontFaces.map(async (fontFace) => {
      try {
        await fontFace.load()
        document.fonts.add(fontFace)
      } catch (error) {
        console.warn('Failed to load font:', error)
      }
    })
  ).then(() => {
    fontsLoaded = true
  })
}

// Helper function to get font style string for Phaser text objects
export function getFontStyle(fontKey: FontKey, customSize?: number): Phaser.Types.GameObjects.Text.TextStyle {
  const font = fonts[fontKey]
  return {
    fontFamily: font.family,
    fontSize: `${customSize || font.size}px`,
    color: '#ffffff',
    // Disable antialiasing for crisp pixel fonts
    resolution: 1,
    // Additional properties to ensure crisp rendering
    stroke: '',
    strokeThickness: 0,
    // Force integer positioning
    fixedWidth: 0,
    fixedHeight: 0
  }
}

// Helper function to get all font keys for iteration
export function getAllFontKeys(): FontKey[] {
  return Object.keys(fonts) as FontKey[]
}
