# Writing PostFX Shader Effects in Phaser 3

## Overview

PostFX shaders in Phaser 3 are fragment shaders that process the final rendered output of game objects. They're applied as post-processing effects after the object is rendered to a texture.

## Shader Architecture

### 1. Extend PostFXPipeline

Create a class extending `Phaser.Renderer.WebGL.Pipelines.PostFXPipeline`:

```typescript
class MyEffectShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _myParameter: number = 1.0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'MyEffect',
      renderTarget: true,
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float myParameter;
        varying vec2 outTexCoord;
        
        void main() {
          vec4 color = texture2D(uMainSampler, outTexCoord);
          // Apply your effect here
          gl_FragColor = color;
        }
      `
    });
  }
}
```

### 2. Handle Uniforms in onPreRender

The `onPreRender()` method runs before each frame and sets uniform values:

```typescript
onPreRender(): void {
  this.set1f('myParameter', this._myParameter);
  this.set2f('resolution', this._resolution.width, this._resolution.height);
  this.set3fv('colorArray', new Float32Array(colors));
}
```

### 3. Property Getters/Setters

Expose shader parameters through TypeScript properties:

```typescript
get myParameter(): number {
  return this._myParameter;
}

set myParameter(value: number) {
  this._myParameter = value;
}
```

## Registration & Application

### 1. Register with Pipeline Manager

Call once during initialization:

```typescript
static registerShader(game: Phaser.Game): void {
  const renderer = game.renderer;
  
  if (renderer.type === Phaser.WEBGL) {
    const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    webglRenderer.pipelines.addPostPipeline('MyEffect', MyEffectShader);
  }
}
```

### 2. Apply to Game Objects

Apply the shader to sprites/images:

```typescript
// Apply shader
gameObject.setPostPipeline('MyEffect');

// Configure shader instance
const shader = gameObject.getPostPipeline('MyEffect') as MyEffectShader;
shader.myParameter = 0.5;

// Remove shader
gameObject.resetPipeline();
```

## Key Patterns

- **Uniform Management**: Set uniforms in `onPreRender()`, not in the constructor
- **Error Handling**: Wrap registration/application in try-catch blocks
- **WebGL Check**: Always verify WebGL renderer availability
- **Resource Cleanup**: Use `resetPipeline()` to remove effects

## Example Use Cases

The dithering shaders in `draw-utils.ts` demonstrate palette quantization and error diffusion techniques, showing how to process texture data through multiple algorithmic approaches within the fragment shader pipeline.