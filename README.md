# Ant Colony Genetic Simulation

An interactive, browser-based simulation of an ant colony that evolves over time using a genetic algorithm. This project was built with p5.js and demonstrates concepts of emergent behavior, natural selection, and environmental adaptation.

**[Live Demo Here!](https://editor.p5js.org/theneolorenzo/full/l3BcC2nTg)**

![Screenshot of the simulation](https://github.com/NeoLorenzo/Ant-Colony-Genetic-Simulation/blob/main/Screenshot%202025-07-28%20173453.png)

## About The Project

This simulation creates a dynamic ecosystem where a colony of ants must survive and thrive. Each ant has a unique set of genes that determine its traits, such as speed, size, and sensory range. The colony faces challenges like finding food, navigating obstacles, and defending against predators. Through a process of natural selection, the genetic makeup of the colony evolves to better adapt to its environment.

### Key Features

*   **Genetic Algorithm:** Ants pass on their genes to the next generation with a chance of mutation. Successful traits are naturally selected for, leading to an evolving colony.
*   **Emergent Behavior:** Complex colony-level strategies, like efficient foraging paths, emerge from the simple rules governing individual ants and their pheromone trails.
*   **Specialized Ant Roles:** The colony is composed of different types of ants—Workers, Soldiers, and Scouts—each with distinct behaviors and genetic predispositions, creating a natural division of labor.
*   **Dynamic Environment:** The world is procedurally generated with obstacles, food sources, and predator nests, ensuring that each simulation run is unique.
*   **Real-time Data Visualization:** The simulation includes interactive graphs that display the colony's population dynamics and the evolution of key genetic traits over time.

### Built With

*   [p5.js](https://p5js.org/) - The core JavaScript library for creative coding.
*   HTML5 & CSS3

## Getting Started

To run this simulation on your local machine, you can simply download the repository and open the `index.html` file in your web browser.

### Prerequisites

You will need a modern web browser that supports HTML5 and JavaScript.

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/NeoLorenzo/Ant-Colony-Genetic-Simulation.git
    ```
2.  Navigate to the project directory and open `index.html` in your browser.

## How It Works

The simulation loop continuously updates the state of each ant and the environment.

1.  **Ants' Behavior:** Each ant makes decisions based on its current state (e.g., carrying food, seeking food), its role, and the pheromone trails it senses.
2.  **Pheromones:** Ants leave behind "home" and "food" pheromones. These trails evaporate and diffuse over time, guiding other ants. "Danger" pheromones are dropped when predators are encountered.
3.  **Reproduction:** The colony reproduces by spending "reproduction energy" gathered from food. New ants inherit a mix of genes from two parent ants, with a chance of mutation. The parents are chosen based on their success (e.g., how much food a worker has gathered).
4.  **Predators:** Predators spawn and hunt ants, creating selective pressure on the colony, particularly favoring stronger soldiers and more cautious workers and scouts.

Project Link: [https://github.com/NeoLorenzo/Ant-Colony-Genetic-Simulation](https://github.com/NeoLorenzo/Ant-Colony-Genetic-Simulation)
