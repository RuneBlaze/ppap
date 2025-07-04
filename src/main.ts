import "./style.css";
import Phaser from "phaser";
import Navigo from "navigo";
import { BattleScene } from "./scenes/BattleScene";
import { ShopScene } from "./scenes/ShopScene";
import { GameScene } from "./scenes/GameScene";
import { AnimationDemoScene } from "./scenes/AnimationDemoScene";

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
	scene: [BattleScene, ShopScene, GameScene, AnimationDemoScene],
	scale: {
		mode: Phaser.Scale.NONE,
		zoom: scale,
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
	router
		.on("/", () => {
			// Stop other scenes before starting a new one
			game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
			game.scene.start("GameScene");
		})
		.on("/battle", () => {
			game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
			game.scene.start("BattleScene");
		})
		.on("/shop", () => {
			game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
			game.scene.start("ShopScene");
		})
		.on("/anim-demo", () => {
			game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
			game.scene.start("AnimationDemoScene");
		})
		.resolve();
});

// --- NAVIGATION BUTTONS ---
const navContainer = document.createElement("div");
const gameContainer = document.getElementById("game-container");
if (gameContainer) {
	document.body.insertBefore(navContainer, gameContainer);
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

createNavButton("Game", "/");
createNavButton("Battle", "/battle");
createNavButton("Shop", "/shop");
createNavButton("Anim Demo", "/anim-demo");

// Handle window resize to recalculate scale
window.addEventListener("resize", () => {
	const newScale = calculateScale();
	game.scale.setZoom(newScale);
});
