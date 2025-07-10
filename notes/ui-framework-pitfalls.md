# UI Framework Implementation Pitfalls & Best Practices

## Key Learnings for Senior Engineers

### Container Constructor Timing Issues
- **Problem**: Accessing `this` properties before `super()` call causes runtime errors
- **Solution**: Initialize properties after `super()`, add guards in overridden methods like `setPosition()`
- **Example**: ActionWidget constructor needed config assignment after Container construction

### Pixel Font Scaling Anti-Pattern
- **Problem**: Never manually scale pixel fonts - breaks crisp rendering and visual consistency
- **Solution**: Always use predefined font sizes from `@/fonts.ts` via `getFontStyle()` helper
- **Context**: Game resolution is 427x240, fonts are designed for specific pixel-perfect sizes

### Focus Manager Integration Conflicts
- **Problem**: Old UI elements (menus) can conflict with new widgets when using existing focus states
- **Solution**: Disable old show methods and ensure proper cleanup in hide methods
- **Example**: BattleScene action menu conflicted with ActionWidget - needed conditional showing

### Container Scaling vs. Child Element Independence  
- **Problem**: When containers scale, child text/graphics scale too, breaking pixel precision
- **Solution**: Avoid container scaling for UI widgets, let shaders handle visual effects instead
- **Approach**: Remove targetScale/currentScale logic, rely on 3D hover shaders for feedback

### Resolution-Aware Sizing Strategy
- **Problem**: Modern defaults (32px icons, 16px fonts) look massive on retro 427x240 resolution
- **Solution**: Design with target resolution first - use 16px icons, 6px font size, tight spacing
- **Rule**: Everything should feel proportional to the game's pixel art aesthetic, not modern web UI