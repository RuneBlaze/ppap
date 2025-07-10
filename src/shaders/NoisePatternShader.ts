export class NoisePatternShader extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	private _time: number = 0;
	private _speed: number = 1.0;

	constructor(game: Phaser.Game) {
		super({
			game,
			name: 'NoisePattern',
			renderTarget: true,
			fragShader: `
				precision mediump float;
				uniform sampler2D uMainSampler;
				uniform float uTime;
				uniform float uSpeed;
				uniform vec2 uResolution;
				varying vec2 outTexCoord;

				const float SPIN_ROTATION = -2.0;
				const float SPIN_SPEED   = 7.0;
				const vec2  OFFSET       = vec2(0.0);
				// Subdued dusk-like palette
				const vec4  COLOUR_1     = vec4(0.55, 0.36, 0.42, 1.0); // muted rose
				const vec4  COLOUR_2     = vec4(0.14, 0.34, 0.52, 1.0); // desaturated teal
				const vec4  COLOUR_3     = vec4(0.07, 0.10, 0.12, 1.0); // deep charcoal blue
				const float CONTRAST     = 2.8;
				const float LIGTHING     = 0.4;
				const float SPIN_AMOUNT  = 0.25;
				const float PIXEL_FILTER = 745.0;
				const float SPIN_EASE    = 1.0;
				const bool  IS_ROTATE    = false;
				const float PI           = 3.14159265359;

				vec4 effect(vec2 screenSize, vec2 screen_coords, float time) {
				    float pixel_size = length(screenSize.xy) / PIXEL_FILTER;
				    vec2 uv = (floor(screen_coords.xy*(1.0/pixel_size))*pixel_size - 0.5*screenSize.xy)/length(screenSize.xy) - OFFSET;
				    float uv_len = length(uv);

				    float speed = (SPIN_ROTATION*SPIN_EASE*0.2);
				    if(IS_ROTATE){
				       speed = time * speed;
				    }
				    speed += 302.2;
				    float new_pixel_angle = atan(uv.y, uv.x) + speed - SPIN_EASE*20.0*(1.0*SPIN_AMOUNT*uv_len + (1.0 - 1.0*SPIN_AMOUNT));
				    vec2 mid = (screenSize.xy/length(screenSize.xy))/2.0;
				    uv = (vec2((uv_len * cos(new_pixel_angle) + mid.x), (uv_len * sin(new_pixel_angle) + mid.y)) - mid);

				    uv *= 30.0;
				    speed = time*(SPIN_SPEED);
				    vec2 uv2 = vec2(uv.x+uv.y);

				    for(int i=0; i < 5; i++) {
				        uv2 += sin(max(uv.x, uv.y)) + uv;
				        uv  += 0.5*vec2(cos(5.1123314 + 0.353*uv2.y + speed*0.131121),sin(uv2.x - 0.113*speed));
				        uv  -= 1.0*cos(uv.x + uv.y) - 1.0*sin(uv.x*0.711 - uv.y);
				    }

				    float contrast_mod = (0.25*CONTRAST + 0.5*SPIN_AMOUNT + 1.2);
				    float paint_res = min(2.0, max(0.0,length(uv)*(0.035)*contrast_mod));
				    float c1p = max(0.0,1.0 - contrast_mod*abs(1.0-paint_res));
				    float c2p = max(0.0,1.0 - contrast_mod*abs(paint_res));
				    float c3p = 1.0 - min(1.0, c1p + c2p);
				    float light = (LIGTHING - 0.2)*max(c1p*5.0 - 4.0, 0.0) + LIGTHING*max(c2p*5.0 - 4.0, 0.0);
				    return (0.3/CONTRAST)*COLOUR_1 + (1.0 - 0.3/CONTRAST)*(COLOUR_1*c1p + COLOUR_2*c2p + vec4(c3p*COLOUR_3.rgb, c3p*COLOUR_1.a)) + light;
				}

				void main() {
				    float time = uTime * uSpeed;
				    vec2 screen_coords = outTexCoord * uResolution;
				    vec4 col = effect(uResolution, screen_coords, time);

				    // Subtle radial vignette & time-based pulse lighting
				    vec2 uvNorm = outTexCoord - vec2(0.5);
				    float dist  = length(uvNorm);
				    float vignette = smoothstep(0.80, 0.30, dist);
				    float pulse    = 0.9 + 0.1 * sin(time * 1.0);

				    col.rgb *= vignette * pulse;
				    gl_FragColor = col;
				}
			`
		});
	}

	onPreRender(): void {
		this.set1f('uTime', this._time);
		this.set1f('uSpeed', this._speed);
		this.set2f('uResolution', this.renderer.width, this.renderer.height);
	}

	get time(): number {
		return this._time;
	}

	set time(value: number) {
		this._time = value / 1000;
	}

	get speed(): number {
		return this._speed;
	}

	set speed(value: number) {
		this._speed = value;
	}

	static registerShader(game: Phaser.Game): void {
		const renderer = game.renderer;
		
		if (renderer.type === Phaser.WEBGL) {
			const webglRenderer = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
			webglRenderer.pipelines.addPostPipeline('NoisePattern', NoisePatternShader);
		}
	}
} 