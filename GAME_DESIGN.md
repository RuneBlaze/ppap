# Game Design Document

This document outlines the core concepts for the game, codenamed `ppap`.

*   **Core Gameplay:** A dual-loop game blending fast-paced roguelite dungeon crawling with a slower, strategic political simulation. Actions in one loop directly influence the other, creating a deep, interconnected experience.

*   **The Dungeon (Front Office):** Players will form a party and explore dangerous, procedurally-generated labyrinths in a top-down, branching-path roguelite view. Combat is turn-based and tactical, requiring careful party composition and resource management to survive.

*   **The Society (Back Office):** Outside the dungeon, players engage in a narrative-driven simulation of politics and intrigue. This is represented by a grid of geographic regions where character "cards" (24x24 cells) move each turn (approx. 6 hours in-game). The player can influence events by dragging player character cards to different regions to trigger interactions. A future "org chart" view will provide an alternative way to manage relationships and influence.

*   **Visual Identity:** The game features a distinct retro-inspired "HD-2D" aesthetic. It combines detailed pixel art with modern visual effects, such as a custom particle system for abilities and full-screen shaders, to create a rich and immersive atmosphere.

*   **Progression & Hubs:** Gameplay is structured around distinct scenes. The `BattleScene` is for tactical combat, while areas like the `ShopScene` act as central hubs for outfitting the party, interacting with characters, and engaging with the "Back Office" political systems.
