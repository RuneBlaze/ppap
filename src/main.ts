import "./style.css";
import Navigo from "navigo";
import Phaser from "phaser";
import { AnimationDemoScene } from "./scenes/AnimationDemoScene";

// Extend the Window interface for TypeScript
declare global {
	interface Window {
		debugStore: {
			dithering: boolean;
			battleHighlight: string;
			currentScene: string;
			fps: number;
			isBattleScene: boolean;
			toggleDithering: () => void;
			cycleBattleHighlight: () => void;
			resetBattleHighlight: () => void;
			update: () => void;
		};
	}
}

import { BattleScene } from "./scenes/BattleScene";
import { BootScene } from "./scenes/BootScene";
import { ShopScene } from "./scenes/ShopScene";
import { SocietyScene } from "./scenes/SocietyScene";

// Calculate the maximum scale that fits the viewport while maintaining aspect ratio
function calculateScale() {
	const targetWidth = 427;
	const targetHeight = 240;
	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;

	const scaleX = Math.floor(windowWidth / targetWidth);
	const scaleY = Math.floor(windowHeight / targetHeight);

	// Use the smaller scale to ensure it fits, minimum scale of 1
	return Math.max(1, Math.min(scaleX, scaleY));
}

// Phaser game configuration
const scale = calculateScale();

const config: Phaser.Types.Core.GameConfig = {
	type: Phaser.AUTO,
	width: 427, // DO NOT MODIFY -- we want to keep the game at 427x240
	height: 240, // DO NOT MODIFY
	parent: "game-container",
	backgroundColor: "#1a1a2e",
	pixelArt: true,
	antialias: false,
	scene: [BootScene, BattleScene, ShopScene, AnimationDemoScene, SocietyScene],
	scale: {
		mode: Phaser.Scale.NONE,
		zoom: scale,
	},
	fps: {
		target: 30,
		smoothStep: true,
	},
	render: {
		pixelArt: true,
		antialias: false,
	},
};

// Initialize the game
const game = new Phaser.Game(config);

// --- ROUTING ---
const router = new Navigo("/", { hash: true });

// Wait for the game to be ready before setting up routes
game.events.on("ready", () => {
	// Store the target scene for BootScene to transition to
	const setTargetScene = (sceneKey: string) => {
		game.registry.set("targetScene", sceneKey);
		// Always start with BootScene to ensure assets are loaded
		game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
		game.scene.start("BootScene");
	};

	router
		.on("/", () => {
			setTargetScene("BattleScene");
		})
		.on("/battle", () => {
			setTargetScene("BattleScene");
		})
		.on("/shop", () => {
			setTargetScene("ShopScene");
		})
		.on("/anim-demo", () => {
			setTargetScene("AnimationDemoScene");
		})
		.on("/society", () => {
			setTargetScene("SocietyScene");
		})
		.resolve();

	// Create the debug UI after game is ready
	createDebugUI();

	// Update debug info periodically
	setInterval(() => {
		window.debugStore.update();
	}, 100);
});

// --- NAVIGATION BUTTONS ---
const navContainer = document.createElement("div");
navContainer.style.cssText = `
	display: block;
	width: 100%;
	text-align: center;
	margin-top: 10px;
`;

const gameContainer = document.getElementById("game-container");
if (gameContainer && gameContainer.parentNode) {
	gameContainer.parentNode.insertBefore(
		navContainer,
		gameContainer.nextSibling,
	);
} else {
	document.body.appendChild(navContainer);
}

const createNavButton = (text: string, path: string) => {
	const button = document.createElement("button");
	button.textContent = text;
	button.style.margin = "4px";
	button.style.padding = "8px 12px";
	button.style.cursor = "pointer";
	button.style.fontFamily = "monospace";
	button.onclick = () => router.navigate(path);
	navContainer.appendChild(button);
};

createNavButton("Battle", "/battle");
createNavButton("Shop", "/shop");
createNavButton("Anim Demo", "/anim-demo");
createNavButton("Society", "/society");

// Handle window resize to recalculate scale
window.addEventListener("resize", () => {
	const newScale = calculateScale();
	game.scale.setZoom(newScale);
});

// --- DEBUG UI ---
const createDebugUI = () => {
	const debugContainer = document.createElement("div");
	debugContainer.id = "debug-ui";
	debugContainer.innerHTML = `
		<div class="debug-panel">
			<h3>Debug Controls</h3>
			
			<div class="debug-section">
				<h4>Rendering</h4>
				<label>
					<input type="checkbox" id="dithering-checkbox"> 
					Dithering Effect
				</label>
			</div>
			
			<div class="debug-section">
				<h4>Battle Scene</h4>
				<button id="cycle-highlight-button">
					Highlight: <span id="highlight-value">Off</span>
				</button>
				<button id="reset-highlight-button">Reset</button>
			</div>
			
			<div class="debug-section">
				<h4>System Info</h4>
				<div>Current Scene: <span id="current-scene">Loading...</span></div>
				<div>FPS: <span id="fps-value">0</span></div>
			</div>
		</div>
	`;

	debugContainer.style.cssText = `
		position: fixed;
		top: 10px;
		right: 10px;
		background: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 15px;
		border-radius: 8px;
		font-family: monospace;
		font-size: 12px;
		z-index: 1000;
		min-width: 200px;
	`;

	const style = document.createElement("style");
	style.textContent = `
		.debug-panel h3 {
			margin: 0 0 10px 0;
			color: #4CAF50;
			border-bottom: 1px solid #333;
			padding-bottom: 5px;
		}
		
		.debug-section {
			margin-bottom: 15px;
		}
		
		.debug-section h4 {
			margin: 0 0 8px 0;
			color: #FFC107;
			font-size: 11px;
		}
		
		.debug-section label {
			display: block;
			margin-bottom: 5px;
			cursor: pointer;
		}
		
		.debug-section button {
			background: #333;
			color: white;
			border: 1px solid #555;
			padding: 4px 8px;
			margin: 2px;
			border-radius: 3px;
			cursor: pointer;
			font-size: 10px;
		}
		
		.debug-section button:hover:not(:disabled) {
			background: #555;
		}
		
		.debug-section button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		
		.debug-section input[type="checkbox"] {
			margin-right: 8px;
		}
		
		.debug-section div {
			margin-bottom: 3px;
		}
	`;

	document.head.appendChild(style);
	document.body.appendChild(debugContainer);

	// Add event listeners
	document
		.getElementById("dithering-checkbox")
		?.addEventListener("click", () => {
			window.debugStore.toggleDithering();
		});
	document
		.getElementById("cycle-highlight-button")
		?.addEventListener("click", () => {
			window.debugStore.cycleBattleHighlight();
		});
	document
		.getElementById("reset-highlight-button")
		?.addEventListener("click", () => {
			window.debugStore.resetBattleHighlight();
		});
};

// Create global debug store
window.debugStore = {
	dithering: true,
	battleHighlight: "Off",
	currentScene: "Loading...",
	fps: 0,
	isBattleScene: false,

	toggleDithering() {
		this.dithering = !this.dithering;
		const activeScenes = game.scene.getScenes(true);
		if (activeScenes.length > 0) {
			activeScenes[0].events.emit("debug:toggleDithering");
		}
	},

	cycleBattleHighlight() {
		const battleScene = game.scene.getScene("BattleScene");
		if (battleScene) {
			battleScene.events.emit("debug:cycleBattleHighlight");
		}
	},

	resetBattleHighlight() {
		const battleScene = game.scene.getScene("BattleScene");
		if (battleScene) {
			battleScene.events.emit("debug:resetBattleHighlight");
			this.battleHighlight = "Off";
		}
	},

	update() {
		// Update state
		this.fps = Math.round(game.loop.actualFps) || 0;
		const activeScenes = game.scene.getScenes(true);
		if (activeScenes.length > 0) {
			this.currentScene = activeScenes[0].scene.key;
			this.isBattleScene = this.currentScene === "BattleScene";
		} else {
			this.currentScene = "None";
			this.isBattleScene = false;
		}

		// Update DOM elements
		const ditheringCheckbox = document.getElementById(
			"dithering-checkbox",
		) as HTMLInputElement;
		if (ditheringCheckbox) ditheringCheckbox.checked = this.dithering;

		const highlightValue = document.getElementById("highlight-value");
		if (highlightValue) highlightValue.innerText = this.battleHighlight;

		const currentScene = document.getElementById("current-scene");
		if (currentScene) currentScene.innerText = this.currentScene;

		const fpsValue = document.getElementById("fps-value");
		if (fpsValue) fpsValue.innerText = this.fps.toString();

		const cycleButton = document.getElementById(
			"cycle-highlight-button",
		) as HTMLButtonElement;
		if (cycleButton) cycleButton.disabled = !this.isBattleScene;

		const resetButton = document.getElementById(
			"reset-highlight-button",
		) as HTMLButtonElement;
		if (resetButton) resetButton.disabled = !this.isBattleScene;
	},
};
