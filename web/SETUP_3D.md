# 3D Hub Setup Guide

## Installation

To use the 3D G logo breaking animation, you need to install Three.js dependencies:

```bash
cd web
npm install @react-three/fiber @react-three/drei three
npm install --save-dev @types/three
```

## Files Created

1. **`web/components/3D/GRNDSLogo3D.tsx`** - 3D G logo breaking animation component
2. **`web/app/hub/page.tsx`** - Landing page that shows the breaking animation
3. **`web/public/grnds-logo.png`** - Your G logo image (already copied)

## Usage

1. Install dependencies (see above)
2. Navigate to `/hub` to see the breaking animation
3. The animation will:
   - Show the G logo for 1.5 seconds
   - Break it into 120 pieces
   - Pieces fly outward with rotation
   - Transition to dashboard after 4 seconds

## How It Works

- Uses your exact PNG image (`grnds-logo.png`) as a texture
- Creates a 3D plane with the texture
- Breaks the logo into pieces that fly outward
- Each piece rotates and fades as it moves
- Similar effect to igloo.inc's igloo breaking up

## Customization

You can adjust:
- `pieceCount` - Number of pieces (currently 120)
- `delay` - Time before breaking starts (currently 1500ms)
- `speed` - How fast pieces fly (currently 3-8 units/second)
- Camera position and lighting

## Next Steps

After installing dependencies, the `/hub` route will work automatically!
