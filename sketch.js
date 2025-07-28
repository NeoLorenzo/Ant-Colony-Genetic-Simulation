p5.disableFriendlyErrors = false;

let pheromoneBuffer;
const pheromoneUpdateInterval = 5; // update the pheromone buffer every 5 frames

// Global accumulators for timing
let totalFrameTimeAcc = 0;
let pheromoneTimeAcc = 0;
let staticDrawTimeAcc = 0;
let antTimeAcc = 0;
let predTimeAcc = 0;
let graphTimeAcc = 0;
let frameCounter = 0;

// Global accumulators for detailed ant update timing (in addition to antTimeAcc)
let antCollisionTimeAcc = 0;
let antBehaviorTimeAcc = 0;
let antMovementTimeAcc = 0;
let antCountForTiming = 0;

// Add these new accumulators (at the top with your other globals)
let antFoodDetectTimeAcc = 0;
let antNestDeliveryTimeAcc = 0;
let antFollowTimeAcc = 0;

let reproductionTimeAcc = 0;

let antGridTimeAcc = 0;

let spawnTimeAcc = 0;

let bgTimeAcc = 0;
let uiTimeAcc = 0;

let antGrid = [];

// ======================================================
//               SIMULATION PARAMETERS
// ======================================================

// -- Nest and Colony Storage --
let nestX, nestY; // Coordinates for the colony's nest (placed later in setup)
let nestReproduction = 0; // Accumulated reproduction energy
let nestStorage = 0; // Accumulated food storage

// -- Food Sources --
let foodSources = []; // Array to store food source objects
const energyFromUnitOfFood = 50; // Energy gained per unit of food

// -- Ants --
let ants = []; // Array to store ant objects
let queenAnt; // Global variable for the queen ant

// -- Pheromones --
let dangerPheromones = []; // Grid for danger pheromones
let homePheromones = []; // Grid for home pheromones
let foodPheromones = []; // Grid for food pheromones

// -- Genetic History Data --
// Colony-wide gene history
let geneHistory = {
  speed: [],
  pheromoneSensitivity: [],
  size: [],
  wanderStrength: [],
  lifespan: [],
  sensoryRange: [],
  relativeStrength: [],
};
// Role-specific gene history: Workers, Soldiers, Scouts
let geneHistoryWorkers = {
  speed: [],
  pheromoneSensitivity: [],
  size: [],
  wanderStrength: [],
  lifespan: [],
  sensoryRange: [],
  relativeStrength: [],
};
let geneHistorySoldiers = {
  speed: [],
  pheromoneSensitivity: [],
  size: [],
  wanderStrength: [],
  lifespan: [],
  sensoryRange: [],
  relativeStrength: [],
};
let geneHistoryScouts = {
  speed: [],
  pheromoneSensitivity: [],
  size: [],
  wanderStrength: [],
  lifespan: [],
  sensoryRange: [],
  relativeStrength: [],
};

let showGeneHistory = true; // Toggle display of gene history graphs
const maxGeneHistory = 300; // Maximum number of frames to record for gene history

// -- Role Display Toggle --
let toggleGeneRolesButton; // Button to toggle between colony and role-specific gene displays
let showGeneRoles = false; // When false, only the colony average is shown

// -- Mutation --
const mutationRate = 0.5; // 50% mutation variation (high mutation rate)

// ======================================================
//               TIME AND ENVIRONMENT
// ======================================================

let timeOfDay = 0; // Normalized time (0 = dawn, 0.5 = dusk, 1 = dawn again)
const dayDuration = 1800; // Total frames for one full day cycle

// ======================================================
//               PREDATOR PARAMETERS
// ======================================================

let predators = []; // Array to hold predator objects
let predatorNests = []; // Array to hold predator nest objects
const predatorNestSpawnProbability = 0.0025; // Small chance for a predator nest to spawn
const predatorNestDetectionRadius = 50; // Radius for detecting predator nests

// Predator combat metrics
let totalDamageDealt = 0;
let predatorsKilled = 0;
let soldierAntsKilled = 0;
let colonyAntsKilledByPredators = 0;

// ======================================================
//               VISUALIZATION VARIABLES
// ======================================================

// Population history for graphing (overall and per role)
let populationHistory = [];
let populationHistoryWorkers = [];
let populationHistorySoldiers = [];
let populationHistoryScouts = [];

// ======================================================
//               CANVAS AND GRID SETTINGS
// ======================================================

const width = 1600; // Canvas width in pixels
const height = 1000; // Canvas height in pixels

// -- Pheromone Grid --
const gridSize = 5; // Resolution of the pheromone grid
const cols = Math.floor(width / gridSize); // Number of grid columns
const rows = Math.floor(height / gridSize); // Number of grid rows

// -- Pheromone Settings --
const evaporationRate = 0.997; // Pheromone evaporation rate per frame
const diffusionRate = 0.025; // Pheromone diffusion rate per frame

// ======================================================
//               OBSTACLE SETTINGS
// ======================================================

let obstacles = []; // Array to hold obstacle objects

// Spatial grid for obstacles for efficient collision detection
const obstacleGridSize = 50; // Size of each cell in the spatial grid
let obstacleGrid = []; // The grid (2D array) for obstacles
let gridCountX, gridCountY; // Number of cells in X and Y directions

// =================================================================
//        UTILITY FUNCTIONS
// =================================================================

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -PI) diff += TWO_PI;
  while (diff > PI) diff -= TWO_PI;
  return a + diff * t;
}

function unwrapAngle(a) {
  while (a < -PI) a += TWO_PI;
  while (a > PI) a -= TWO_PI;
  return a;
}

function computeGeneAverageByRole(geneKey, role) {
  let sum = 0;
  let count = 0;
  for (let ant of ants) {
    if (ant.role === role) {
      sum += ant.genes[geneKey];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function smoothAndDownsample(data, targetCount) {
  let result = [];
  let n = data.length;
  let segment = n / targetCount;
  for (let i = 0; i < targetCount; i++) {
    let start = floor(i * segment);
    let end = floor((i + 1) * segment);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < n; j++) {
      sum += data[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}

// =================================================================
//        OBSTACLE FUNCTIONS
// =================================================================

function spawnObstacles() {
  obstacles = [];
  let numObstacles = floor(random(500, 750)); // 500 to 750 obstacles
  for (let i = 0; i < numObstacles; i++) {
    let valid = false;
    let tries = 0;
    let obs;
    // Randomly decide on obstacle type: 50% chance each.
    let type = random() < 0.5 ? "rect" : "circle";
    while (!valid && tries < 10) {
      if (type === "rect") {
        let w = random(2, 10);
        let h = random(2, 10);
        let x = random(0, width - w);
        let y = random(0, height - h);
        obs = { type: "rect", x: x, y: y, w: w, h: h };
        // Check that the nest isn't inside the rectangle.
        if (dist(nestX, nestY, x + w / 2, y + h / 2) >= 75) {
          valid = true;
        }
      } else {
        // type === "circle"
        let r = random(2, 10);
        let x = random(r, width - r);
        let y = random(r, height - r);
        obs = { type: "circle", x: x, y: y, r: r };
        // Check that the nest isn't inside the circle.
        if (dist(nestX, nestY, x, y) >= 75) {
          valid = true;
        }
      }
      tries++;
    }
    if (valid) {
      obstacles.push(obs);
    }
  }
}

function buildObstacleGrid() {
  gridCountX = Math.ceil(width / obstacleGridSize);
  gridCountY = Math.ceil(height / obstacleGridSize);
  // Initialize the grid cells.
  obstacleGrid = new Array(gridCountX);
  for (let i = 0; i < gridCountX; i++) {
    obstacleGrid[i] = new Array(gridCountY);
    for (let j = 0; j < gridCountY; j++) {
      obstacleGrid[i][j] = [];
    }
  }
  // Add each obstacle to all grid cells it occupies.
  for (let obs of obstacles) {
    let xMin, xMax, yMin, yMax;
    if (obs.type === "rect") {
      xMin = obs.x;
      xMax = obs.x + obs.w;
      yMin = obs.y;
      yMax = obs.y + obs.h;
    } else {
      // circle
      xMin = obs.x - obs.r;
      xMax = obs.x + obs.r;
      yMin = obs.y - obs.r;
      yMax = obs.y + obs.r;
    }
    let iMin = Math.floor(xMin / obstacleGridSize);
    let iMax = Math.floor(xMax / obstacleGridSize);
    let jMin = Math.floor(yMin / obstacleGridSize);
    let jMax = Math.floor(yMax / obstacleGridSize);
    for (let i = iMin; i <= iMax; i++) {
      for (let j = jMin; j <= jMax; j++) {
        if (i >= 0 && i < gridCountX && j >= 0 && j < gridCountY) {
          obstacleGrid[i][j].push(obs);
        }
      }
    }
  }
}

function drawObstacles() {
  let dayColor = color(120, 120, 120);
  let nightColor = color(180, 130, 90);
  let currentObstacleColor = lerpColor(dayColor, nightColor, timeOfDay);
  fill(currentObstacleColor);
  noStroke();
  for (let obs of obstacles) {
    if (obs.type === "rect") {
      rect(obs.x, obs.y, obs.w, obs.h);
    } else if (obs.type === "circle") {
      ellipse(obs.x, obs.y, obs.r * 2, obs.r * 2);
    }
  }
}

function collides(x, y) {
  let i = Math.floor(x / obstacleGridSize);
  let j = Math.floor(y / obstacleGridSize);
  // Check the cell (i,j) and its 8 neighboring cells.
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      let ni = i + di;
      let nj = j + dj;
      if (ni >= 0 && ni < gridCountX && nj >= 0 && nj < gridCountY) {
        for (let obs of obstacleGrid[ni][nj]) {
          if (obs.type === "rect") {
            if (
              x > obs.x &&
              x < obs.x + obs.w &&
              y > obs.y &&
              y < obs.y + obs.h
            ) {
              return true;
            }
          } else if (obs.type === "circle") {
            let dx = x - obs.x;
            let dy = y - obs.y;
            if (dx * dx + dy * dy < obs.r * obs.r) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function isNearObstacle(x, y) {
  for (let obs of obstacles) {
    if (obs.type === "rect") {
      let centerX = obs.x + obs.w / 2;
      let centerY = obs.y + obs.h / 2;
      if (dist(x, y, centerX, centerY) < 20) {
        return true;
      }
    } else if (obs.type === "circle") {
      if (dist(x, y, obs.x, obs.y) < 20) {
        return true;
      }
    }
  }
  return false;
}

// =================================================================
//        PHEROMONE FUNCTIONS
// =================================================================

function updatePheromones(effEvap, effDiff) {
  // Update border cells:
  for (let i = 0; i < cols; i++) {
    homePheromones[i][0] *= effEvap;
    foodPheromones[i][0] *= effEvap;
    dangerPheromones[i][0] *= effEvap;
    homePheromones[i][rows - 1] *= effEvap;
    foodPheromones[i][rows - 1] *= effEvap;
    dangerPheromones[i][rows - 1] *= effEvap;
  }
  for (let j = 1; j < rows - 1; j++) {
    homePheromones[0][j] *= effEvap;
    foodPheromones[0][j] *= effEvap;
    dangerPheromones[0][j] *= effEvap;
    homePheromones[cols - 1][j] *= effEvap;
    foodPheromones[cols - 1][j] *= effEvap;
    dangerPheromones[cols - 1][j] *= effEvap;
  }

  // For interior cells, combine evaporation with diffusion:
  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      let currentHome = homePheromones[i][j] * effEvap;
      let currentFood = foodPheromones[i][j] * effEvap;
      let currentDanger = dangerPheromones[i][j] * effEvap;
      let homeSum = 0,
        foodSum = 0,
        dangerSum = 0;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di !== 0 || dj !== 0) {
            homeSum += homePheromones[i + di][j + dj] * effEvap;
            foodSum += foodPheromones[i + di][j + dj] * effEvap;
            dangerSum += dangerPheromones[i + di][j + dj] * effEvap;
          }
        }
      }
      let homeAvg = homeSum / 8;
      let foodAvg = foodSum / 8;
      let dangerAvg = dangerSum / 8;

      homePheromones[i][j] = currentHome * (1 - effDiff) + homeAvg * effDiff;
      foodPheromones[i][j] = currentFood * (1 - effDiff) + foodAvg * effDiff;
      dangerPheromones[i][j] =
        currentDanger * (1 - effDiff) + dangerAvg * effDiff;
    }
  }
}

function updatePheromoneBuffer() {
  // Get the native 2D context from the offscreen buffer
  let ctx = pheromoneBuffer.drawingContext;
  // Clear the buffer
  ctx.clearRect(0, 0, width, height);

  // Loop over each cell in your grid
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * gridSize;
      let y = j * gridSize;

      // Draw HOME pheromones (blue)
      if (homePheromones[i][j] > 0.1) {
        // Set fill style with alpha; note that canvas alpha is 0–1 so we convert
        ctx.fillStyle = `rgba(0, 0, 255, ${constrain(
          (homePheromones[i][j] * 50) / 255,
          0,
          1
        )})`;
        ctx.fillRect(x, y, gridSize, gridSize);
      }

      // Draw FOOD pheromones (green)
      if (foodPheromones[i][j] > 0.1) {
        ctx.fillStyle = `rgba(0, 255, 0, ${constrain(
          (foodPheromones[i][j] * 50) / 255,
          0,
          1
        )})`;
        ctx.fillRect(x, y, gridSize, gridSize);
      }

      // Draw DANGER pheromones (red)
      if (dangerPheromones[i][j] > 0.1) {
        ctx.fillStyle = `rgba(255, 0, 0, ${constrain(
          (dangerPheromones[i][j] * 50) / 255,
          0,
          1
        )})`;
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }
  }
}

// =================================================================
//        ANT FUNCTIONS
// =================================================================

function tryMoveAnt(ant, speed) {
  // Define a small set of candidate angle offsets (in radians) around the intended direction.
  let offsets = [-PI / 6, -PI / 12, 0, PI / 12, PI / 6];
  let intendedAngle = ant.angle;
  let bestCandidate = null;
  let minDeviation = Infinity;

  // First try the preset offsets.
  for (let offset of offsets) {
    let candidateAngle = intendedAngle + offset;
    let candidateX = ant.x + cos(candidateAngle) * speed;
    let candidateY = ant.y + sin(candidateAngle) * speed;
    if (!collides(candidateX, candidateY)) {
      if (abs(offset) < minDeviation) {
        bestCandidate = {
          newX: candidateX,
          newY: candidateY,
          newAngle: candidateAngle,
        };
        minDeviation = abs(offset);
      }
    }
  }

  // If none of the preset offsets works, do an iterative search.
  if (!bestCandidate) {
    // Search in small increments (5° steps) around the full circle.
    let step = PI / 36; // 5 degrees
    for (let delta = step; delta < TWO_PI; delta += step) {
      let candidateAngle = ant.angle + delta;
      let candidateX = ant.x + cos(candidateAngle) * speed;
      let candidateY = ant.y + sin(candidateAngle) * speed;
      if (!collides(candidateX, candidateY)) {
        bestCandidate = {
          newX: candidateX,
          newY: candidateY,
          newAngle: candidateAngle,
        };
        break;
      }
    }
  }

  // As a last resort, if still no valid move is found, back up.
  if (!bestCandidate) {
    bestCandidate = {
      newX: ant.x - cos(ant.angle) * speed,
      newY: ant.y - sin(ant.angle) * speed,
      newAngle: ant.angle + PI,
    };
  }
  return bestCandidate;
}

function createAnt(role) {
  if (role === undefined) role = "worker"; // Default role

  // Define gene values for the ant’s traits.
  let geneSpeed, geneWanderStrength, geneSize, genePheromoneSensitivity;
  let geneLifespan, geneSensoryRange; // NEW genes
  let geneRelativeStrength; // NEW gene

  // Define genes based on role:
  if (role === "queen") {
    geneSpeed = random(0.5, 1);
    geneWanderStrength = 0.1;
    geneSize = 20;
    genePheromoneSensitivity = 1;
    geneLifespan = random(10000, 15000);
    geneSensoryRange = random(80, 120);
    geneRelativeStrength = random(1, 1.2); // Queens get moderate relative strength
  } else if (role === "soldier") {
    geneSpeed = random(0.8, 2);
    geneWanderStrength = 0.15;
    geneSize = 10;
    genePheromoneSensitivity = 1;
    geneLifespan = random(6000, 11000);
    geneSensoryRange = random(70, 100);
    geneRelativeStrength = random(1.5, 2); // Soldiers tend to be stronger
  } else if (role === "scout") {
    geneSpeed = random(2, 4);
    geneWanderStrength = 0.5;
    geneSize = 6;
    genePheromoneSensitivity = 1;
    geneLifespan = random(5400, 10800);
    geneSensoryRange = random(100, 140);
    geneRelativeStrength = random(0.8, 1.2);
  } else {
    // worker
    geneSpeed = random(1, 3);
    geneWanderStrength = 0.25;
    geneSize = 6;
    genePheromoneSensitivity = 1;
    geneLifespan = random(5400, 10800);
    geneSensoryRange = random(80, 120);
    geneRelativeStrength = random(0.8, 1.2);
  }

  // Set the ant's starting properties.
  let speed = geneSpeed;
  let wanderStrength = geneWanderStrength;
  let size = geneSize;
  let lifetime = geneLifespan; // Lifetime is now determined by the gene

  // Every ant knows where the nest is from the start.
  let nestMemory = createVector(nestX, nestY);

  let antObj = {
    x: nestX,
    y: nestY,
    angle: random(TWO_PI),
    speed: speed,
    hasFood: false,
    wanderStrength: wanderStrength,
    age: 0,
    lifetime: lifetime,
    role: role,
    size: size,
    nestMemory: nestMemory,
    isFleeing: false,
    energy: size * 10,
    maxEnergy: size * 10,
    genes: {
      speed: geneSpeed,
      pheromoneSensitivity: genePheromoneSensitivity,
      size: geneSize,
      wanderStrength: geneWanderStrength,
      lifespan: geneLifespan,
      sensoryRange: geneSensoryRange,
      relativeStrength: geneRelativeStrength,
    },
  };
  if (role === "scout") {
    antObj.bravery = 0; // maximum distance from nest reached
  } else if (role === "worker") {
    antObj.efficiency = 0; // total food delivered
  } else if (role === "soldier") {
    antObj.might = 0; // total damage dealt
  }
  return antObj;
}

function weightedRandom(parents) {
  let total = 0;
  for (let p of parents) {
    total += p.weight;
  }
  let r = random(total);
  let cumulative = 0;
  for (let p of parents) {
    cumulative += p.weight;
    if (r < cumulative) {
      return p.parent;
    }
  }
  return parents[0].parent; // fallback
}

function mixGenes(genesA, genesB) {
  let newGenes = {};
  newGenes.speed =
    ((genesA.speed + genesB.speed) / 2) *
    (1 + random(-mutationRate, mutationRate));
  newGenes.pheromoneSensitivity =
    ((genesA.pheromoneSensitivity + genesB.pheromoneSensitivity) / 2) *
    (1 + random(-mutationRate, mutationRate));
  newGenes.size =
    ((genesA.size + genesB.size) / 2) *
    (1 + random(-mutationRate, mutationRate));
  newGenes.wanderStrength =
    ((genesA.wanderStrength + genesB.wanderStrength) / 2) *
    (1 + random(-mutationRate, mutationRate));
  newGenes.lifespan =
    ((genesA.lifespan + genesB.lifespan) / 2) *
    (1 + random(-mutationRate, mutationRate));
  newGenes.sensoryRange =
    ((genesA.sensoryRange + genesB.sensoryRange) / 2) *
    (1 + random(-mutationRate, mutationRate));
  // NEW: Mix relative strength
  newGenes.relativeStrength =
    ((genesA.relativeStrength + genesB.relativeStrength) / 2) *
    (1 + random(-mutationRate, mutationRate));
  return newGenes;
}

function createAntFromGenes(role, genes) {
  if (role === undefined) role = "worker";
  let nestMemory = createVector(nestX, nestY);
  let antObj = {
    x: nestX,
    y: nestY,
    angle: random(TWO_PI),
    speed: genes.speed,
    hasFood: false,
    wanderStrength: genes.wanderStrength,
    age: 0,
    lifetime: genes.lifespan,
    role: role,
    size: genes.size,
    nestMemory: nestMemory,
    isFleeing: false,
    energy: genes.size * 10,
    maxEnergy: genes.size * 10,
    genes: genes,
  };
  // Initialize role‑specific reproduction metrics:
  if (role === "scout") {
    antObj.bravery = 0; // maximum distance traveled from the nest
  } else if (role === "worker") {
    antObj.efficiency = 0; // total food delivered to the nest
  } else if (role === "soldier") {
    antObj.might = 0; // total number of predators killed
  }
  return antObj;
}

function updateAnt(ant) {
  // Special behavior for the queen ant:
  if (ant.role === "queen") {
    ant.age++; // Increase age

    // Calculate distance and desired angle toward the nest
    let dx = nestX - ant.x;
    let dy = nestY - ant.y;
    let dFromNest = sqrt(dx * dx + dy * dy);
    let nestAngle = atan2(dy, dx);

    // Compute a bias factor (gradually stronger as she gets further away)
    // Here we map distances from 0 to 100 to a bias factor of 0 to 0.3.
    // (You can tweak these numbers as needed.)
    let biasFactor = map(dFromNest, 0, 100, 0, 0.1, true);

    // Gradually bias the queen's current angle toward the nest
    ant.angle = lerpAngle(ant.angle, nestAngle, biasFactor);

    // Move the queen using the same candidate move logic as other ants
    let move = tryMoveAnt(ant, ant.speed);
    ant.x = move.newX;
    ant.y = move.newY;
    ant.angle = move.newAngle;

    // (Optional) If she drifts too far, gently nudge her back
    if (dFromNest > 50) {
      ant.angle = lerpAngle(ant.angle, nestAngle, 0.2);
    }

    // Ensure the queen never picks up food
    ant.hasFood = false;
    return; // Skip further processing for the queen
  }

  let t0 = performance.now();

  ant.age++; // Increase age every frame

  // If this is a scout, record the farthest distance from the nest.
  if (ant.role === "scout") {
    let dxScout = ant.x - nestX;
    let dyScout = ant.y - nestY;
    let currentDist = sqrt(dxScout * dxScout + dyScout * dyScout);
    if (currentDist > ant.bravery) {
      ant.bravery = currentDist;
    }
  }

  updateMetabolism(ant);

  //check for regeneration near the nest.
  let dx = ant.x - nestX;
  let dy = ant.y - nestY;
  let dSq = dx * dx + dy * dy;
  if (dSq < 20 * 20 && !ant.hasFood) {
    let regenAmount = 0.1; // energy gained this frame
    // Only allow regeneration if storage can supply the energy:
    let availableEnergy = nestStorage * energyFromUnitOfFood;
    let actualRegen = min(
      regenAmount,
      availableEnergy,
      ant.maxEnergy - ant.energy
    );
    ant.energy = min(ant.energy + actualRegen, ant.maxEnergy);
    // Decrease nestStorage by the corresponding food units.
    let foodUsed = actualRegen / energyFromUnitOfFood;
    nestStorage = max(nestStorage - foodUsed, 0);
  }

  if (!ant.isFleeing) {
    for (let pNest of predatorNests) {
      let dxNest = ant.x - pNest.x;
      let dyNest = ant.y - pNest.y;
      let dNestSq = dxNest * dxNest + dyNest * dyNest;
      if (dNestSq < predatorNestDetectionRadius * predatorNestDetectionRadius) {
        // Drop danger pheromone at the ant's grid cell.
        let gridI = constrain(Math.floor(ant.x / gridSize), 0, cols - 1);
        let gridJ = constrain(Math.floor(ant.y / gridSize), 0, rows - 1);
        dangerPheromones[gridI][gridJ] = min(
          dangerPheromones[gridI][gridJ] + 1,
          5
        );

        if (ant.role === "soldier") {
          if (dNestSq < 20 * 20 && frameCount % 60 === 0) {
            // Only deal damage once every 60 frames
            let baseDamage = 1;
            let damage =
              baseDamage * ant.genes.relativeStrength * (ant.size / 10);
            pNest.hp -= damage;
            // Increase soldier's "might" by the damage done.
            ant.might += damage;
            if (pNest.hp <= 0) {
              let index = predatorNests.indexOf(pNest);
              if (index > -1) {
                predatorNests.splice(index, 1);
              }
              // If the nest is destroyed, skip further processing for this nest.
              continue;
            }
          }
          // Soldier ants run toward the predator nest.
          ant.angle = atan2(pNest.y - ant.y, pNest.x - ant.x);
        } else {
          // Non-soldier ants start fleeing: run directly toward the colony nest.
          ant.isFleeing = true;
          ant.angle = atan2(nestY - ant.y, nestX - ant.x);
        }
        // Handle only one predator nest per update.
        break;
      }
    }
  } else {
    // Already fleeing: continue to drop danger pheromones and run toward the nest.
    let gridI = constrain(Math.floor(ant.x / gridSize), 0, cols - 1);
    let gridJ = constrain(Math.floor(ant.y / gridSize), 0, rows - 1);
    dangerPheromones[gridI][gridJ] = min(dangerPheromones[gridI][gridJ] + 1, 5);
    ant.angle = atan2(nestY - ant.y, nestX - ant.x);
    let dxFlee = ant.x - nestX;
    let dyFlee = ant.y - nestY;
    if (dxFlee * dxFlee + dyFlee * dyFlee < 20 * 20) {
      ant.isFleeing = false;
    }
  }

  let tBehavior0 = performance.now();

  // Check for nearby predator nests.
  for (let pNest of predatorNests) {
    let dNest = dist(ant.x, ant.y, pNest.x, pNest.y);
    if (dNest < predatorNestDetectionRadius) {
      // Drop danger pheromone in the ant's grid cell.
      let gridI = constrain(Math.floor(ant.x / gridSize), 0, cols - 1);
      let gridJ = constrain(Math.floor(ant.y / gridSize), 0, rows - 1);
      dangerPheromones[gridI][gridJ] = min(
        dangerPheromones[gridI][gridJ] + 1,
        5
      );

      if (ant.role === "soldier") {
        // Soldier ants run toward the predator nest.
        ant.angle = atan2(pNest.y - ant.y, pNest.x - ant.x);
      } else {
        // Other ants run away: head back toward the colony nest.
        ant.angle = atan2(nestY - ant.y, nestX - ant.x);
      }

      // Optionally, break after handling the first predator nest seen.
      break;
    }
  }

  let basePredatorAvoidanceRadius = 50;
  let effectivePredatorAvoidanceRadius =
    ant.role === "soldier"
      ? basePredatorAvoidanceRadius * (ant.genes.sensoryRange / 100)
      : basePredatorAvoidanceRadius;
  for (let predator of predators) {
    let dPred = dist(ant.x, ant.y, predator.x, predator.y);
    if (dPred < effectivePredatorAvoidanceRadius) {
      if (ant.role === "soldier") {
        // Soldier ants chase predators.
        ant.angle = atan2(predator.y - ant.y, predator.x - ant.x);
      } else {
        // Other ants run away from predators.
        ant.angle = atan2(ant.y - predator.y, ant.x - predator.x);
      }
      // Drop a danger pheromone at the ant's grid cell:
      let gridI = constrain(Math.floor(ant.x / gridSize), 0, cols - 1);
      let gridJ = constrain(Math.floor(ant.y / gridSize), 0, rows - 1);
      dangerPheromones[gridI][gridJ] = min(
        dangerPheromones[gridI][gridJ] + 1,
        5
      );
      break;
    }
  }

  // Convert ant position to grid coordinates
  let i = Math.floor(ant.x / gridSize);
  let j = Math.floor(ant.y / gridSize);

  // Keep within bounds - ensure full valid range
  i = constrain(i, 0, cols - 1);
  j = constrain(j, 0, rows - 1);

  // Drop pheromones based on state and experience
  if (ant.hasFood) {
    // Set the pickup time if not already set
    if (ant.pickupTime === undefined) {
      ant.pickupTime = frameCount;
      ant.freshPickup = frameCount; // Mark the fresh pickup moment
    }
    let timeSincePickup = frameCount - ant.pickupTime;
    let freshMultiplier = map(frameCount - ant.freshPickup, 0, 100, 2, 1, true);
    let depositFactor = max(1 - timeSincePickup / 3000, 0);
    let depositAmount =
      (ant.collectedFoodQuality !== undefined
        ? 0.5 * ant.collectedFoodQuality
        : 0.5) * depositFactor;
    depositAmount *= freshMultiplier;
    foodPheromones[i][j] = min(foodPheromones[i][j] + depositAmount, 5);
  } else {
    ant.pickupTime = undefined;
    let d = dist(ant.x, ant.y, nestX, nestY);
    let maxDist = 400;
    let depositStrength = map(d, 0, maxDist, 0.7, 0.1);
    depositStrength = constrain(depositStrength, 0.1, 0.7);
    if (ant.role === "soldier") {
      depositStrength *= 0.1; // Adjust the multiplier as needed.
    }
    homePheromones[i][j] = min(homePheromones[i][j] + depositStrength, 5);
  }

  let tBehavior1 = performance.now();
  antBehaviorTimeAcc += tBehavior1 - tBehavior0;

  // --- FOOD DETECTION & PICKUP ---
  let tFoodDetect0 = performance.now();

  const foodDetectionRadius = ant.genes.sensoryRange * 0.3;
  const workerFoodDetectionRadius = ant.genes.sensoryRange * 0.5;
  let nearestFoodDist = Infinity;
  let nearestFoodX = 0;
  let nearestFoodY = 0;
  let nearFood = false;

  let nearestFoodDistSq = Infinity;

  for (let food of foodSources) {
    let dxFood = ant.x - food.x;
    let dyFood = ant.y - food.y;
    let dFoodSq = dxFood * dxFood + dyFood * dyFood;
    if (food.amount > 0 && dFoodSq < 10 * 10) {
      // If the ant's energy is low, try to eat.
      if (ant.energy < 50) {
        let energyNeeded = ant.maxEnergy - ant.energy;
        let foodUnitsNeeded = energyNeeded / energyFromUnitOfFood;
        let foodConsumed = min(food.amount, foodUnitsNeeded);
        ant.energy += foodConsumed * energyFromUnitOfFood;
        food.amount = max(food.amount - foodConsumed, 0);
      }
      if (ant.role !== "soldier") {
        // Non-soldier ants: pick up food for delivery to the nest.
        if (!ant.hasFood) {
          let carryCapacity = (ant.size / 3) * ant.genes.relativeStrength;
          ant.hasFood = true;
          ant.collectedFoodQuality = carryCapacity;
          food.amount = max(food.amount - carryCapacity, 0);
          let nestAngle = atan2(nestY - ant.y, nestX - ant.x);
          ant.angle = nestAngle;
          nearFood = true;
          break;
        }
      } else {
        // Soldier ants only eat; break once they’ve eaten.
        break;
      }
    }
    // Also update nearest food for detection (applies to all ants)
    let detectionRadius =
      ant.role === "worker" ? workerFoodDetectionRadius : foodDetectionRadius;
    let detectionRadiusSq = detectionRadius * detectionRadius;
    if (
      food.amount > 0 &&
      dFoodSq < detectionRadiusSq &&
      dFoodSq < nearestFoodDistSq
    ) {
      nearestFoodDistSq = dFoodSq;
      nearestFoodX = food.x;
      nearestFoodY = food.y;
      nearFood = true;
    }
  }

  let tFoodDetect1 = performance.now();
  antFoodDetectTimeAcc += tFoodDetect1 - tFoodDetect0;

  // --- NEST DELIVERY ---
  let tNestDelivery0 = performance.now();

  let dxDelivery = ant.x - nestX;
  let dyDelivery = ant.y - nestY;
  if (ant.hasFood && (ant.x - nestX) ** 2 + (ant.y - nestY) ** 2 < 20 * 20) {
    if (ant.role === "worker") {
      ant.efficiency += ant.collectedFoodQuality; // accumulate food delivered
    }
    ant.hasFood = false;
    ant.angle = atan2(ant.y - nestY, ant.x - nestX);
    let deliveredFood = ant.collectedFoodQuality;
    nestReproduction += deliveredFood / 2;
    nestStorage += deliveredFood / 2;
    delete ant.collectedFoodQuality;
    delete ant.freshPickup;
  }

  let tNestDelivery1 = performance.now();
  antNestDeliveryTimeAcc += tNestDelivery1 - tNestDelivery0;

  // --- FOLLOW PHEROMONES / WANDER ---
  let tFollow0 = performance.now();

  let alpha = 5;
  if (ant.hasFood) {
    let nestProximityThreshold = 75;
    let dxNest = ant.x - nestX;
    let dyNest = ant.y - nestY;
    let distToNest = sqrt(dxNest * dxNest + dyNest * dyNest);
    if (distToNest < nestProximityThreshold) {
      ant.angle = atan2(nestY - ant.y, nestX - ant.x);
      ant.angle += random(-ant.wanderStrength / 2, ant.wanderStrength / 2);
    } else {
      let candidates = [];
      for (let offset = -PI / 4; offset <= PI / 4; offset += PI / 8) {
        let testAngle = ant.angle + offset;
        let testX = ant.x + cos(testAngle) * 10;
        let testY = ant.y + sin(testAngle) * 10;
        let ti = Math.floor(testX / gridSize);
        let tj = Math.floor(testY / gridSize);
        if (ti >= 0 && ti < cols && tj >= 0 && tj < rows) {
          let baseline = 0.001;
          let sensitivity = ant.genes.pheromoneSensitivity;
          let pheromoneWeight = pow(
            homePheromones[ti][tj] + baseline,
            alpha * sensitivity
          );
          candidates.push({ angle: testAngle, pheromone: pheromoneWeight });
        }
      }
      let total = candidates.reduce(
        (sum, candidate) => sum + candidate.pheromone,
        0
      );
      if (total > 0.01) {
        let r = random(total);
        let cumulative = 0;
        for (let candidate of candidates) {
          cumulative += candidate.pheromone;
          if (r < cumulative) {
            ant.angle = candidate.angle;
            break;
          }
        }
      } else {
        let nestAngle = atan2(nestY - ant.y, nestX - ant.x);
        ant.angle =
          lerp(ant.angle, nestAngle, 0.1) +
          random(-ant.wanderStrength * 0.3, ant.wanderStrength * 0.3);
      }
    }
  } else {
    if (
      (ant.role === "worker" || (ant.role === "soldier" && ant.energy < 50)) &&
      nearFood
    ) {
      ant.angle = atan2(nearestFoodY - ant.y, nearestFoodX - ant.x);
      ant.angle += random(-ant.wanderStrength / 3, ant.wanderStrength / 3);
    } else {
      let candidates = [];
      for (let offset = -PI / 4; offset <= PI / 4; offset += PI / 8) {
        let testAngle = ant.angle + offset;
        let sampleDistance = ant.role === "soldier" ? 20 : 10;
        let testX = ant.x + cos(testAngle) * sampleDistance;
        let testY = ant.y + sin(testAngle) * sampleDistance;
        let ti = Math.floor(testX / gridSize);
        let tj = Math.floor(testY / gridSize);
        if (ti >= 0 && ti < cols && tj >= 0 && tj < rows) {
          let baseline = 0.001;
          let sensitivity = ant.genes.pheromoneSensitivity;
          let pheromoneWeight;
          if (ant.role === "soldier") {
            if (ant.energy < 50) {
              pheromoneWeight = pow(
                foodPheromones[ti][tj] + baseline,
                alpha * sensitivity
              );
            } else {
              pheromoneWeight = pow(
                dangerPheromones[ti][tj] + baseline,
                alpha * sensitivity
              );
            }
          } else {
            pheromoneWeight = pow(
              foodPheromones[ti][tj] + baseline,
              alpha * sensitivity
            );
          }
          candidates.push({ angle: testAngle, pheromone: pheromoneWeight });
        }
      }
      let total = candidates.reduce(
        (sum, candidate) => sum + candidate.pheromone,
        0
      );
      if (total > 0.01) {
        let r = random(total);
        let cumulative = 0;
        for (let candidate of candidates) {
          cumulative += candidate.pheromone;
          if (r < cumulative) {
            ant.angle = candidate.angle;
            break;
          }
        }
      } else {
        ant.angle += random(-ant.wanderStrength, ant.wanderStrength);
      }
    }
  }
  let tFollow1 = performance.now();
  antFollowTimeAcc += tFollow1 - tFollow0;

  let tMove0 = performance.now();

  if (ant.role === "soldier") {
    let dxSoldier = nestX - ant.x;
    let dySoldier = nestY - ant.y;
    let dFromNestSq = dxSoldier * dxSoldier + dySoldier * dySoldier;
    let dFromNest = sqrt(dFromNestSq);
    let biasFactor = map(dFromNest, 0, (width / 2) * 5, 0, 0.3, true);
    let nestAngle = atan2(dySoldier, dxSoldier);
    ant.angle = lerpAngle(ant.angle, nestAngle, biasFactor);
  }

  let currentSpeed = ant.speed;
  if (ant.hasFood) {
    currentSpeed *= 0.75;
  }

  // Calculate potential new position using collision avoidance.
  let oldX = ant.x;
  let oldY = ant.y;
  let move = tryMoveAnt(ant, currentSpeed);
  ant.x = move.newX;
  ant.y = move.newY;
  ant.angle = move.newAngle;
  let dxMove = ant.x - oldX;
  let dyMove = ant.y - oldY;
  let distanceTraveled = sqrt(dxMove * dxMove + dyMove * dyMove);
  let movementCostFactor = 0.001 * (ant.speed * ant.speed);
  ant.energy -= distanceTraveled * movementCostFactor;

  // Check if energy is depleted; if so, kill the ant.
  if (ant.energy <= 0) {
    ant.lifetime = ant.age;
  }

  if (ant.x < 0 || ant.x > width || ant.y < 0 || ant.y > height) {
    ant.angle += PI;
  }

  ant.x = constrain(ant.x, 0, width);
  ant.y = constrain(ant.y, 0, height);

  let tMove1 = performance.now();
  antMovementTimeAcc += tMove1 - tMove0;

  let t1 = performance.now();

  antCollisionTimeAcc +=
    t1 - t0 - (tBehavior1 - tBehavior0 + (tMove1 - tMove0));

  antCountForTiming++;
}

function reproduce() {
  const tStart = performance.now(); // Start timer

  const reproductionThreshold = 2;

  // While there is enough energy to spawn new ants:
  while (nestReproduction >= reproductionThreshold) {
    // Randomly pick a role for the new ant.
    // For example, with 50% chance a worker, 25% a soldier, and 25% a scout:
    let r = random();
    let role;
    if (r < 0.5) {
      role = "worker";
    } else if (r < 0.75) {
      role = "soldier";
    } else {
      role = "scout";
    }

    // Get potential parents of the chosen role (excluding the queen if desired)
    let potentialParents = ants.filter((a) => a.role === role);

    let newAnt;
    // If we have at least two parents, mix their genes
    if (potentialParents.length >= 2) {
      // Select two random parents (ensure they are not the same)
      let weightedParents = [];
      for (let parent of potentialParents) {
        let weight = 0.01; // default minimum weight to avoid zero chance
        if (role === "scout") {
          weight = parent.bravery; // bravery is the farthest distance traveled
        } else if (role === "worker") {
          weight = parent.efficiency; // efficiency is total food delivered
        } else if (role === "soldier") {
          weight = parent.might; // might is total damage dealt
        }
        // Ensure weight is at least a small positive value:
        weight = max(weight, 0.01);
        weightedParents.push({ parent: parent, weight: weight });
      }
      let parentA = weightedRandom(weightedParents);
      let parentB = weightedRandom(weightedParents);
      while (parentA === parentB && potentialParents.length > 1) {
        parentB = weightedRandom(weightedParents);
      }

      // Mix their genes using your mixGenes() function
      let childGenes = mixGenes(parentA.genes, parentB.genes);

      // Create a new ant with the mixed genes
      newAnt = createAntFromGenes(role, childGenes);
    } else {
      // If there aren't two potential parents, default to creating a new ant with random genes
      newAnt = createAnt(role);
    }

    // Add the new ant to the colony
    ants.push(newAnt);

    // Deduct the reproduction energy cost for this new ant.
    nestReproduction -= reproductionThreshold;
  }

  const tEnd = performance.now(); // End timer
  reproductionTimeAcc += tEnd - tStart;
}

function updateMetabolism(ant) {
  // Base cost proportional to mass (using ant.size as a proxy) and relative strength.
  const baseCostConstant = 0.001; // tuning parameter for baseline cost
  let baseCost = baseCostConstant * ant.size * ant.genes.relativeStrength;

  // Activity multiplier based on speed.
  const activityMultiplier = 1 + ant.speed / 10;

  let metabolicCost = baseCost * activityMultiplier;

  // --- Oxygen Diffusion Penalty (modified) ---
  // Oxygen supply scales roughly as size^2, while oxygen demand scales as size^3.
  // To simulate the fact that diffusion limits size, we penalize any size above an optimal value quadratically.
  let optimalSize = 10; // optimal or typical maximum realistic size
  if (ant.size > optimalSize) {
    let excess = ant.size - optimalSize;
    // Quadratic penalty: even a small excess increases metabolic cost significantly.
    let oxygenPenalty = excess * excess * 0.005;
    metabolicCost += oxygenPenalty;
  }

  ant.energy -= metabolicCost;
}

function drawAnt(ant) {
  push();
  translate(ant.x, ant.y);
  rotate(ant.angle);

  // Set color based on role:
  let roleColor;
  if (ant.role === "soldier") {
    roleColor = color(80, 80, 80); // Dark gray for soldiers
  } else if (ant.role === "scout") {
    roleColor = color(0, 150, 0); // Bright green for scouts
  } else {
    roleColor = color(0); // Workers: black
  }

  // Blend with age for visual variation:
  let ageRatio = ant.age / ant.lifetime;
  let greyColor = color(200);
  let antColor = lerpColor(roleColor, greyColor, ageRatio);

  stroke(0);
  fill(antColor);

  // Draw the ant's body using the size property.
  // Soldiers are larger; workers and scouts are drawn smaller.
  ellipse(0, 0, ant.size, ant.size * 0.67);
  // Draw a head as a small circle, offset slightly.
  ellipse(ant.size * 0.3, 0, ant.size * 0.5, ant.size * 0.5);

  pop();
}

function addAnts() {
  for (let i = 0; i < 10; i++) {
    let r = random();
    let role;
    if (r < 0.5) {
      role = "worker";
    } else if (r < 0.8) {
      role = "soldier";
    } else {
      role = "scout";
    }
    ants.push(createAnt(role));
  }
}

// =================================================================
//        PREDATOR FUNCTIONS
// =================================================================

function spawnPredatorNest() {
  let attempts = 0;
  const maxAttempts = 10;
  let x, y;
  let valid = false;
  while (attempts < maxAttempts && !valid) {
    x = random(50, width - 50);
    y = random(50, height - 50);
    // Ensure the nest is not on obstacles, is a safe distance from the ant nest, and is not on a food source
    if (
      !collides(x, y) &&
      dist(x, y, nestX, nestY) > 100 &&
      !foodSpawnAt(x, y)
    ) {
      valid = true;
    }
    attempts++;
  }
  if (valid) {
    // Set hitpoints randomly between 20 and 30 (inclusive)
    let hp = floor(random(20, 31));
    predatorNests.push({ x: x, y: y, lastSpawnTime: frameCount, hp: hp });
  }
}

function spawnPredatorAt(x, y) {
  let attempts = 0;
  const maxAttempts = 10;
  let newX, newY;
  let valid = false;
  while (attempts < maxAttempts && !valid) {
    newX = x + random(-50, 50);
    newY = y + random(-50, 50);
    if (!collides(newX, newY)) {
      valid = true;
    }
    attempts++;
  }
  if (valid) {
    let predator = {
      x: newX,
      y: newY,
      angle: random(TWO_PI),
      speed: 0, // initial speed is 0; will accelerate
      maxSpeed: random(1.5, 2.5),
      patrolSpeed: 0.7,
      acceleration: 0.05,
      detectionRadius: 70,
      size: 20, // assign a size property
      health: 20,
      state: "patrolling",
      velocity: createVector(0, 0),
      fov: PI / 3,
    };
    predators.push(predator);
  }
}

function updatePredator(predator) {
  let targetAnt = null;
  let closestDist = Infinity;
  // Field-of-view detection (unchanged)
  for (let ant of ants) {
    let d = dist(predator.x, predator.y, ant.x, ant.y);
    if (d < predator.detectionRadius && d < closestDist) {
      let angleToAnt = atan2(ant.y - predator.y, ant.x - predator.x);
      let angleDiff = abs(unwrapAngle(angleToAnt - predator.angle));
      if (angleDiff < predator.fov / 2) {
        closestDist = d;
        targetAnt = ant;
      }
    }
  }

  // Update state and speed based on target detection.
  if (targetAnt !== null) {
    predator.state = "chasing";
    let desiredAngle = atan2(
      targetAnt.y - predator.y,
      targetAnt.x - predator.x
    );
    predator.angle = lerpAngle(predator.angle, desiredAngle, 0.1);
    predator.speed = min(
      predator.speed + predator.acceleration,
      predator.maxSpeed
    );
  } else {
    if (predator.state === "chasing") {
      predator.state = "patrolling";
    }
    if (predator.speed < predator.patrolSpeed) {
      predator.speed = min(
        predator.speed + predator.acceleration,
        predator.patrolSpeed
      );
    } else {
      predator.speed = max(
        predator.speed - predator.acceleration,
        predator.patrolSpeed
      );
    }
    predator.angle += random(-0.1, 0.1);
  }

  // Update velocity vector.
  predator.velocity.x = cos(predator.angle) * predator.speed;
  predator.velocity.y = sin(predator.angle) * predator.speed;

  // Calculate tentative new position.
  let newX = predator.x + predator.velocity.x;
  let newY = predator.y + predator.velocity.y;

  // Bounce off obstacles if necessary.
  let bounceAttempts = 0;
  while (collides(newX, newY) && bounceAttempts < 5) {
    predator.angle += PI + random(-0.3, 0.3);
    predator.velocity.x = cos(predator.angle) * predator.speed;
    predator.velocity.y = sin(predator.angle) * predator.speed;
    newX = predator.x + predator.velocity.x;
    newY = predator.y + predator.velocity.y;
    bounceAttempts++;
  }

  // --- Canvas Edge Bounce ---
  const edgeMargin = 1;
  if (
    newX < edgeMargin ||
    newX > width - edgeMargin ||
    newY < edgeMargin ||
    newY > height - edgeMargin
  ) {
    // If too near an edge, adjust the angle to steer the predator back into the canvas.
    let centerAngle = atan2(height / 2 - predator.y, width / 2 - predator.x);
    predator.angle =
      lerpAngle(predator.angle, centerAngle, 0.3) + random(-0.2, 0.2);
    // Recalculate newX/newY after the adjustment.
    predator.velocity.x = cos(predator.angle) * predator.speed;
    predator.velocity.y = sin(predator.angle) * predator.speed;
    newX = predator.x + predator.velocity.x;
    newY = predator.y + predator.velocity.y;
  }

  // Constrain the new position to the canvas.
  predator.x = constrain(newX, 0, width);
  predator.y = constrain(newY, 0, height);

  // --- Optimized Collision Detection with Ants ---
  // (Assumes that a global antGrid is built each frame via buildAntGrid())
  let cellSize = obstacleGridSize; // Use same cell size as for obstacles
  let cellI = Math.floor(predator.x / cellSize);
  let cellJ = Math.floor(predator.y / cellSize);
  for (let i = cellI - 1; i <= cellI + 1; i++) {
    for (let j = cellJ - 1; j <= cellJ + 1; j++) {
      if (i >= 0 && i < gridCountX && j >= 0 && j < gridCountY) {
        for (let ant of antGrid[i][j]) {
          let dx = predator.x - ant.x;
          let dy = predator.y - ant.y;
          let dSq = dx * dx + dy * dy;
          let collisionDistance = predator.size / 2 + ant.size / 2 + 2; // 2-pixel buffer
          if (dSq < collisionDistance * collisionDistance) {
            // Handle collision based on ant role.
            if (ant.role === "soldier") {
              // For this example, we let each collision deal a fixed 1 unit of damage.
              let baseDamage = 4; // Base damage value
              let damage =
                baseDamage * ant.genes.relativeStrength * (ant.size / 10);
              predator.health -= damage;
              // Instead of accumulating damage, if the predator dies then record one kill:
              if (predator.health <= 0) {
                foodSources.push({
                  x: predator.x,
                  y: predator.y,
                  amount: predator.size,
                });
                predatorsKilled++;
                ant.might += damage;
                // Soldier ant survives.
              } else {
                soldierAntsKilled++;
                colonyAntsKilledByPredators++;
                let index = ants.indexOf(ant);
                if (index > -1) ants.splice(index, 1);
              }
            } else {
              colonyAntsKilledByPredators++;
              let index = ants.indexOf(ant);
              if (index > -1) ants.splice(index, 1);
            }
            // After a collision, randomly change the predator’s angle.
            predator.angle = random(TWO_PI);
          }
        }
      }
    }
  }

  if (predator.health <= 0) {
    foodSources.push({ x: predator.x, y: predator.y, amount: predator.size });
    predatorsKilled++;
    predator.dead = true;
  }
}

function drawPredator(predator) {
  push();
  translate(predator.x, predator.y);
  rotate(predator.angle);
  // Draw the predator as a red beetle shape.
  fill(200, 0, 0);
  stroke(0);
  ellipse(0, 0, 15, 10); // Adjust size as needed
  pop();
}

// =================================================================
//        FOOD SOURCE FUNCTIONS
// =================================================================

function spawnFoodSource() {
  let attempts = 0;
  const maxAttempts = 10;
  let x, y;
  let valid = false;
  while (attempts < maxAttempts && !valid) {
    x = random(50, width - 50);
    y = random(50, height - 50);
    if (!collides(x, y) && !isNearObstacle(x, y)) {
      valid = true;
    }
    attempts++;
  }
  if (valid) {
    foodSources.push({
      x: x,
      y: y,
      amount: 500, // Adjust the starting amount if desired.
    });
  }
}

function foodSpawnAt(x, y) {
  for (let food of foodSources) {
    if (dist(x, y, food.x, food.y) < 50) {
      // 50 is a threshold; adjust if needed
      return true;
    }
  }
  return false;
}

// =================================================================
//        VISUALIZATION / GRAPH FUNCTIONS
// =================================================================

function drawAgeGraph() {
  let numBins = 20;
  let bins = new Array(numBins).fill(0);

  // Compute the histogram based on relative age (0 to 1)
  for (let ant of ants) {
    let ratio = ant.age / ant.lifetime;
    let binIndex = floor(ratio * numBins);
    if (binIndex >= numBins) binIndex = numBins - 1;
    bins[binIndex]++;
  }

  // Define graph dimensions and position.
  let graphWidth = 140;
  let graphHeight = 80;
  let margin = 20;
  let graphX = 1190;
  let graphY = height - margin - graphHeight;

  push();
  // Draw background with border.
  fill(255, 255, 255, 220);
  stroke(0);
  rect(graphX, graphY, graphWidth, graphHeight);

  // Draw grid lines.
  stroke(220);
  strokeWeight(1);
  let numHGrid = 4; // horizontal grid lines
  for (let i = 0; i <= numHGrid; i++) {
    let y = graphY + i * (graphHeight / numHGrid);
    line(graphX, y, graphX + graphWidth, y);
  }
  let numVGrid = numBins; // one per bin
  for (let i = 0; i <= numVGrid; i++) {
    let x = graphX + i * (graphWidth / numVGrid);
    line(x, graphY, x, graphY + graphHeight);
  }

  // Draw bars for the histogram.
  let maxVal = max(bins);
  if (maxVal === 0) maxVal = 1;
  let binWidth = graphWidth / numBins;
  noStroke();
  fill(0, 0, 255);
  for (let i = 0; i < numBins; i++) {
    let barHeight = map(bins[i], 0, maxVal, 0, graphHeight);
    rect(
      graphX + i * binWidth,
      graphY + graphHeight - barHeight,
      binWidth,
      barHeight
    );
  }

  // Add labels and title.
  noStroke();
  fill(0);
  textSize(10);
  textAlign(CENTER, BOTTOM);
  text("Relative Age", graphX + graphWidth / 2, graphY + graphHeight + 15);
  textAlign(CENTER, TOP);
  text("Age Distribution", graphX + graphWidth / 2, graphY - 15);
  pop();
}

function updatePopulationHistory() {
  if (frameCount % 5 !== 0) return; // Only update every 5 frames
  // Count ants per role:
  let workers = ants.filter((a) => a.role === "worker").length;
  let soldiers = ants.filter((a) => a.role === "soldier").length;
  let scouts = ants.filter((a) => a.role === "scout").length;

  // Record the counts
  populationHistoryWorkers.push(workers);
  populationHistorySoldiers.push(soldiers);
  populationHistoryScouts.push(scouts);
}

function drawPopulationGraph() {
  push();
  // Graph dimensions and position:
  let graphX = 1350;
  let graphY = height - 145;
  let graphWidth = 220;
  let graphHeight = 120;

  // Use the length of one of the history arrays (they should all be the same)
  let maxHistory = populationHistoryWorkers.length;

  // Compute the maximum cumulative population at any data point.
  let maxTotal = 0;
  for (let i = 0; i < maxHistory; i++) {
    let total =
      populationHistoryWorkers[i] +
      populationHistorySoldiers[i] +
      populationHistoryScouts[i];
    if (total > maxTotal) {
      maxTotal = total;
    }
  }
  // Ensure a minimum scale.
  if (maxTotal < 200) {
    maxTotal = 200;
  }

  // Draw background and border:
  fill(255, 255, 255, 220);
  stroke(200);
  rect(graphX, graphY, graphWidth, graphHeight);

  // --- Draw horizontal gridlines (4 evenly spaced lines) ---
  stroke(220);
  strokeWeight(1);
  let numHGrid = 4;
  for (let i = 0; i <= numHGrid; i++) {
    let y = graphY + i * (graphHeight / numHGrid);
    line(graphX, y, graphX + graphWidth, y);
  }

  // --- Draw the stacked filled areas ---
  noStroke();

  // 1. Workers area (base layer, fill from workers curve down to bottom)
  fill(0); // black for workers
  beginShape();
  // Trace workers cumulative curve.
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  // Close the shape along the bottom.
  vertex(graphX + graphWidth, graphY + graphHeight);
  vertex(graphX, graphY + graphHeight);
  endShape(CLOSE);

  // 2. Soldiers area (fill between workers and workers+soldiers)
  fill(80); // dark gray for soldiers
  beginShape();
  // Top edge: cumulative workers + soldiers.
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i] + populationHistorySoldiers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  // Bottom edge: workers curve (in reverse order to close the shape).
  for (let i = maxHistory - 1; i >= 0; i--) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  endShape(CLOSE);

  // 3. Scouts area (fill between workers+soldiers and total population)
  fill(0, 150, 0); // green for scouts
  beginShape();
  // Top edge: cumulative total (workers + soldiers + scouts).
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i] +
        populationHistorySoldiers[i] +
        populationHistoryScouts[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  // Bottom edge: cumulative workers + soldiers (in reverse).
  for (let i = maxHistory - 1; i >= 0; i--) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i] + populationHistorySoldiers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  endShape(CLOSE);

  // Optionally, draw the outline curves on top:
  strokeWeight(2);
  noFill();

  // Outline for workers:
  stroke(0);
  beginShape();
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  endShape();

  // Outline for workers + soldiers:
  stroke(80);
  beginShape();
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i] + populationHistorySoldiers[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  endShape();

  // Outline for total:
  stroke(0, 150, 0);
  beginShape();
  for (let i = 0; i < maxHistory; i++) {
    let x = map(i, 0, maxHistory - 1, graphX, graphX + graphWidth);
    let y = map(
      populationHistoryWorkers[i] +
        populationHistorySoldiers[i] +
        populationHistoryScouts[i],
      0,
      maxTotal,
      graphY + graphHeight,
      graphY
    );
    vertex(x, y);
  }
  endShape();

  // --- Draw vertical gridlines in red on top ---
  // These gridlines represent one day (1800 frames)
  stroke("red");
  strokeWeight(1);
  let pointsPerDay = dayDuration / 5; // For dayDuration = 1800, pointsPerDay = 360
  let numDays = floor(maxHistory / pointsPerDay);
  for (let d = 0; d <= numDays; d++) {
    let index = d * pointsPerDay;
    let xPos = map(index, 0, maxHistory, graphX, graphX + graphWidth);
    line(xPos, graphY, xPos, graphY + graphHeight);
  }

  // --- Draw axes labels and title ---
  noStroke();
  fill(0);
  textSize(12);
  textAlign(CENTER, BOTTOM);
  text("Population Over Time", graphX + graphWidth / 2, graphY - 5);
  textAlign(RIGHT, CENTER);
  text(nf(maxTotal, 0, 0), graphX - 5, graphY);
  text("0", graphX - 5, graphY + graphHeight);
  textAlign(CENTER, TOP);
  text("Time (days)", graphX + graphWidth / 2, graphY + graphHeight + 5);

  pop();
}

function updateGeneHistory() {
  if (frameCount % 5 !== 0) return;

  // Initialize totals for the colony and per-role totals.
  let tot = {
    speed: 0,
    pheromoneSensitivity: 0,
    size: 0,
    wanderStrength: 0,
    lifespan: 0,
    sensoryRange: 0,
    relativeStrength: 0,
  };
  let totWorkers = {
    speed: 0,
    pheromoneSensitivity: 0,
    size: 0,
    wanderStrength: 0,
    lifespan: 0,
    sensoryRange: 0,
    relativeStrength: 0,
  };
  let totSoldiers = {
    speed: 0,
    pheromoneSensitivity: 0,
    size: 0,
    wanderStrength: 0,
    lifespan: 0,
    sensoryRange: 0,
    relativeStrength: 0,
  };
  let totScouts = {
    speed: 0,
    pheromoneSensitivity: 0,
    size: 0,
    wanderStrength: 0,
    lifespan: 0,
    sensoryRange: 0,
    relativeStrength: 0,
  };

  let count = 0,
    countW = 0,
    countS = 0,
    countSc = 0;

  for (let ant of ants) {
    tot.speed += ant.genes.speed;
    tot.pheromoneSensitivity += ant.genes.pheromoneSensitivity;
    tot.size += ant.genes.size;
    tot.wanderStrength += ant.genes.wanderStrength;
    tot.lifespan += ant.genes.lifespan;
    tot.sensoryRange += ant.genes.sensoryRange;
    tot.relativeStrength += ant.genes.relativeStrength;
    count++;

    if (ant.role === "worker") {
      totWorkers.speed += ant.genes.speed;
      totWorkers.pheromoneSensitivity += ant.genes.pheromoneSensitivity;
      totWorkers.size += ant.genes.size;
      totWorkers.wanderStrength += ant.genes.wanderStrength;
      totWorkers.lifespan += ant.genes.lifespan;
      totWorkers.sensoryRange += ant.genes.sensoryRange;
      totWorkers.relativeStrength += ant.genes.relativeStrength;
      countW++;
    } else if (ant.role === "soldier") {
      totSoldiers.speed += ant.genes.speed;
      totSoldiers.pheromoneSensitivity += ant.genes.pheromoneSensitivity;
      totSoldiers.size += ant.genes.size;
      totSoldiers.wanderStrength += ant.genes.wanderStrength;
      totSoldiers.lifespan += ant.genes.lifespan;
      totSoldiers.sensoryRange += ant.genes.sensoryRange;
      totSoldiers.relativeStrength += ant.genes.relativeStrength;
      countS++;
    } else if (ant.role === "scout") {
      totScouts.speed += ant.genes.speed;
      totScouts.pheromoneSensitivity += ant.genes.pheromoneSensitivity;
      totScouts.size += ant.genes.size;
      totScouts.wanderStrength += ant.genes.wanderStrength;
      totScouts.lifespan += ant.genes.lifespan;
      totScouts.sensoryRange += ant.genes.sensoryRange;
      totScouts.relativeStrength += ant.genes.relativeStrength;
      countSc++;
    }
  }

  // Compute colony averages.
  geneHistory.speed.push(tot.speed / count);
  geneHistory.pheromoneSensitivity.push(tot.pheromoneSensitivity / count);
  geneHistory.size.push(tot.size / count);
  geneHistory.wanderStrength.push(tot.wanderStrength / count);
  geneHistory.lifespan.push(tot.lifespan / count);
  geneHistory.sensoryRange.push(tot.sensoryRange / count);
  geneHistory.relativeStrength.push(tot.relativeStrength / count);

  // Compute role-specific averages.
  geneHistoryWorkers.speed.push(countW ? totWorkers.speed / countW : 0);
  geneHistoryWorkers.pheromoneSensitivity.push(
    countW ? totWorkers.pheromoneSensitivity / countW : 0
  );
  geneHistoryWorkers.size.push(countW ? totWorkers.size / countW : 0);
  geneHistoryWorkers.wanderStrength.push(
    countW ? totWorkers.wanderStrength / countW : 0
  );
  geneHistoryWorkers.lifespan.push(countW ? totWorkers.lifespan / countW : 0);
  geneHistoryWorkers.sensoryRange.push(
    countW ? totWorkers.sensoryRange / countW : 0
  );
  geneHistoryWorkers.relativeStrength.push(
    countW ? totWorkers.relativeStrength / countW : 0
  );

  geneHistorySoldiers.speed.push(countS ? totSoldiers.speed / countS : 0);
  geneHistorySoldiers.pheromoneSensitivity.push(
    countS ? totSoldiers.pheromoneSensitivity / countS : 0
  );
  geneHistorySoldiers.size.push(countS ? totSoldiers.size / countS : 0);
  geneHistorySoldiers.wanderStrength.push(
    countS ? totSoldiers.wanderStrength / countS : 0
  );
  geneHistorySoldiers.lifespan.push(countS ? totSoldiers.lifespan / countS : 0);
  geneHistorySoldiers.sensoryRange.push(
    countS ? totSoldiers.sensoryRange / countS : 0
  );
  geneHistorySoldiers.relativeStrength.push(
    countS ? totSoldiers.relativeStrength / countS : 0
  );

  geneHistoryScouts.speed.push(countSc ? totScouts.speed / countSc : 0);
  geneHistoryScouts.pheromoneSensitivity.push(
    countSc ? totScouts.pheromoneSensitivity / countSc : 0
  );
  geneHistoryScouts.size.push(countSc ? totScouts.size / countSc : 0);
  geneHistoryScouts.wanderStrength.push(
    countSc ? totScouts.wanderStrength / countSc : 0
  );
  geneHistoryScouts.lifespan.push(countSc ? totScouts.lifespan / countSc : 0);
  geneHistoryScouts.sensoryRange.push(
    countSc ? totScouts.sensoryRange / countSc : 0
  );
  geneHistoryScouts.relativeStrength.push(
    countSc ? totScouts.relativeStrength / countSc : 0
  );
}

function drawGeneHistoryGraph(
  geneArray, // colony average array
  workerArray, // worker gene average history
  soldierArray, // soldier gene average history
  scoutArray, // scout gene average history
  label, // label for the gene
  col, // color for the colony average curve
  dummyMaxVal, // (not used anymore)
  posY // vertical position for the graph
) {
  push();
  let graphX = 10;
  let graphY = posY;
  let graphWidth = 150;
  let graphHeight = 100;
  let cornerRadius = 10;

  // Calculate a dynamic maximum value from all three arrays.
  let combinedValues = geneArray.concat(workerArray, soldierArray, scoutArray);
  let dynamicMax = max(combinedValues);
  if (dynamicMax <= 0) {
    dynamicMax = 1;
  }

  // Draw shadow and background.
  noStroke();
  fill(0, 0, 0, 50);
  rect(graphX + 4, graphY + 4, graphWidth, graphHeight, cornerRadius);
  fill(255, 255, 255, 230);
  stroke(200);
  rect(graphX, graphY, graphWidth, graphHeight, cornerRadius);

  // Draw horizontal grid lines.
  stroke(220);
  strokeWeight(1);
  for (let i = 0; i <= 4; i++) {
    let y = graphY + i * (graphHeight / 4);
    line(graphX, y, graphX + graphWidth, y);
  }
  let pointsPerDay = dayDuration / 5;
  let numDays = floor(geneArray.length / pointsPerDay);
  stroke("red");
  strokeWeight(1);
  for (let d = 0; d <= numDays; d++) {
    let index = d * pointsPerDay;
    let xPos = map(index, 0, geneArray.length, graphX, graphX + graphWidth);
    line(xPos, graphY, xPos, graphY + graphHeight);
  }

  // Downsample and smooth the colony average data.
  let smoothArray = smoothAndDownsample(geneArray, 50);

  if (!showGeneRoles) {
    // When not showing role‑specific history, draw only the colony average:
    noStroke();
    fill(red(col), green(col), blue(col), 70);
    beginShape();
    vertex(graphX, graphY + graphHeight);
    for (let i = 0; i < smoothArray.length; i++) {
      let x = map(i, 0, smoothArray.length - 1, graphX, graphX + graphWidth);
      let y = map(smoothArray[i], 0, dynamicMax, graphY + graphHeight, graphY);
      vertex(x, y);
    }
    vertex(graphX + graphWidth, graphY + graphHeight);
    endShape(CLOSE);

    stroke(col);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < smoothArray.length; i++) {
      let x = map(i, 0, smoothArray.length - 1, graphX, graphX + graphWidth);
      let y = map(smoothArray[i], 0, dynamicMax, graphY + graphHeight, graphY);
      vertex(x, y);
    }
    endShape();
  } else {
    // When showing role‑specific history, draw each role's curve.
    // Worker curve in black:
    stroke("black");
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < workerArray.length; i++) {
      let x = map(i, 0, workerArray.length - 1, graphX, graphX + graphWidth);
      let y = map(workerArray[i], 0, dynamicMax, graphY + graphHeight, graphY);
      vertex(x, y);
    }
    endShape();

    // Soldier curve in dark gray:
    stroke(80);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < soldierArray.length; i++) {
      let x = map(i, 0, soldierArray.length - 1, graphX, graphX + graphWidth);
      let y = map(soldierArray[i], 0, dynamicMax, graphY + graphHeight, graphY);
      vertex(x, y);
    }
    endShape();

    // Scout curve in green:
    stroke("green");
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < scoutArray.length; i++) {
      let x = map(i, 0, scoutArray.length - 1, graphX, graphX + graphWidth);
      let y = map(scoutArray[i], 0, dynamicMax, graphY + graphHeight, graphY);
      vertex(x, y);
    }
    endShape();
  }

  // Draw label above the graph.
  noStroke();
  fill(0);
  textSize(10);
  textAlign(CENTER, TOP);
  text(label, graphX + graphWidth / 2, graphY - 15);

  pop();
}

// =================================================================
//        UI SETUP & EVENT HANDLERS
// =================================================================

function setup() {
  createCanvas(width, height);
  frameRate(60);

  // Create the graphics buffer (same size as the canvas)
  pheromoneBuffer = createGraphics(width, height);

  // Initialize pheromone grids, including danger pheromones.
  for (let i = 0; i < cols; i++) {
    homePheromones[i] = [];
    foodPheromones[i] = [];
    dangerPheromones[i] = []; // <-- new grid for danger pheromones
    for (let j = 0; j < rows; j++) {
      homePheromones[i][j] = 0;
      foodPheromones[i][j] = 0;
      dangerPheromones[i][j] = 0; // initialize danger pheromone value
    }
  }

  // Place nest in the center
  nestX = width / 2;
  nestY = height / 2;

  // Create the queen ant and initial workers
  queenAnt = createAnt("queen");
  ants.push(queenAnt);

  // Set total number of non-queen ants.
  const initialAntCount = 198; // 198 is divisible by 3 (66 per role)
  const numPerRole = initialAntCount / 3;

  // Create equal numbers of workers, scouts, and soldiers.
  for (let i = 0; i < numPerRole; i++) {
    ants.push(createAnt("worker"));
    ants.push(createAnt("scout"));
    ants.push(createAnt("soldier"));
  }

  // Spawn random obstacles
  spawnObstacles();
  buildObstacleGrid();

  spawnFoodSource();
  spawnFoodSource();
  spawnFoodSource();
  spawnFoodSource();
  spawnFoodSource();

  // Create a button to toggle gene history graphs.
  let toggleButton = createButton("Toggle Gene History");
  toggleButton.position(10, height - 55);

  // Improved styles:
  toggleButton.style(
    "background-image",
    "linear-gradient(to right, #4CAF50, #45a049)"
  );
  toggleButton.style("color", "white");
  toggleButton.style("padding", "12px 25px");
  toggleButton.style("font-size", "16px");
  toggleButton.style("border", "none");
  toggleButton.style("border-radius", "8px");
  toggleButton.style("cursor", "pointer");
  toggleButton.style("box-shadow", "0px 4px 6px rgba(0, 0, 0, 0.3)");
  toggleButton.style("transition", "all 0.3s ease");

  // Add hover effects with scaling and brightness change
  toggleButton.mouseOver(() => {
    toggleButton.style("transform", "scale(1.05)");
    toggleButton.style("filter", "brightness(110%)");
  });
  toggleButton.mouseOut(() => {
    toggleButton.style("transform", "scale(1)");
    toggleButton.style("filter", "brightness(100%)");
  });

  // Toggle the gene history display on press.
  toggleButton.mousePressed(() => {
    showGeneHistory = !showGeneHistory;
  });

  // Create a button to toggle between colony average and role‐specific gene history
  toggleGeneRolesButton = createButton("Toggle Role Gene History");
  // Position it on top of the first button (adjust x coordinate as needed)
  toggleGeneRolesButton.position(10, height - 110);
  // Apply similar styling:
  toggleGeneRolesButton.style(
    "background-image",
    "linear-gradient(to right, #4CAF50, #45a049)"
  );
  toggleGeneRolesButton.style("color", "white");
  toggleGeneRolesButton.style("padding", "12px 25px");
  toggleGeneRolesButton.style("font-size", "16px");
  toggleGeneRolesButton.style("border", "none");
  toggleGeneRolesButton.style("border-radius", "8px");
  toggleGeneRolesButton.style("cursor", "pointer");
  toggleGeneRolesButton.style("box-shadow", "0px 4px 6px rgba(0, 0, 0, 0.3)");
  toggleGeneRolesButton.style("transition", "all 0.3s ease");

  toggleGeneRolesButton.mouseOver(() => {
    toggleGeneRolesButton.style("transform", "scale(1.05)");
    toggleGeneRolesButton.style("filter", "brightness(110%)");
  });
  toggleGeneRolesButton.mouseOut(() => {
    toggleGeneRolesButton.style("transform", "scale(1)");
    toggleGeneRolesButton.style("filter", "brightness(100%)");
  });
  toggleGeneRolesButton.mousePressed(() => {
    showGeneRoles = !showGeneRoles;
  });
}

// =================================================================
//        MAIN LOOP
// =================================================================

function draw() {
  const tStart = performance.now(); // Total frame start

  // === Update time and background ===
  const tBgStart = performance.now();

  timeOfDay = (frameCount % dayDuration) / dayDuration;
  let bgBrightness = map(sin(timeOfDay * TWO_PI), -1, 1, 100, 240);
  background(bgBrightness);

  const tBgEnd = performance.now();
  let bgTime = tBgEnd - tBgStart;
  bgTimeAcc += bgTime;

  // === Pheromone update ===
  const tPheroStart = performance.now();
  if (frameCount % 5 === 0) {
    let dt = 5;
    let effEvap = pow(evaporationRate, dt);
    let effDiff = 1 - pow(1 - diffusionRate, dt);
    updatePheromones(effEvap, effDiff);
  }
  const tPheroEnd = performance.now();
  let pheromoneTime = tPheroEnd - tPheroStart;

  // Update the pheromone buffer only every few frames
  if (frameCount % pheromoneUpdateInterval === 0) {
    updatePheromoneBuffer();
  }

  // Instead of calling drawPheromones(), draw the offscreen buffer
  image(pheromoneBuffer, 0, 0);

  // === Draw static elements: obstacles, nest, predator nests, food sources ===
  const tStaticStart = performance.now();
  drawObstacles();
  fill(150, 75, 0);
  ellipse(nestX, nestY, 50, 50);
  for (let nest of predatorNests) {
    fill(150, 0, 150);
    let nestSize = map(nest.hp, 20, 30, 20, 40);
    ellipse(nest.x, nest.y, nestSize, nestSize);
  }
  for (let food of foodSources) {
    if (food.amount > 0) {
      fill(0, 200, 0);
      ellipse(
        food.x,
        food.y,
        map(food.amount, 0, 500, 5, 20),
        map(food.amount, 0, 500, 5, 20)
      );
    }
  }
  const tStaticEnd = performance.now();
  let staticDrawTime = tStaticEnd - tStaticStart;

  // === Spawning new predator nests and food sources ===
  const tSpawnStart = performance.now();

  if (random(1) < predatorNestSpawnProbability) {
    spawnPredatorNest();
  }
  if (random(1) < 0.002) {
    spawnFoodSource();
  }
  for (let nest of predatorNests) {
    if (frameCount - nest.lastSpawnTime > 600) {
      spawnPredatorAt(nest.x, nest.y);
      nest.lastSpawnTime = frameCount;
    }
  }

  const tSpawnEnd = performance.now();
  let spawnTime = tSpawnEnd - tSpawnStart;
  spawnTimeAcc += spawnTime;

  // === Update and draw ants ===
  const tAntStart = performance.now();
  for (let ant of ants) {
    updateAnt(ant);
    drawAnt(ant);
  }

  // Remove ants that have exceeded their lifetime.
  ants = ants.filter((ant) => ant.age < ant.lifetime);

  // Build the ant grid for use in predator collision detection.
  buildAntGrid();
  const tAntEnd = performance.now();
  let antTime = tAntEnd - tAntStart;

  // Reproduction: spawn new ants based on nestReproduction energy.
  reproduce();

  // === Update and draw predators ===
  const tPredStart = performance.now();
  for (let i = predators.length - 1; i >= 0; i--) {
    updatePredator(predators[i]);
    if (!predators[i].dead) {
      drawPredator(predators[i]);
    } else {
      predators.splice(i, 1);
    }
  }
  const tPredEnd = performance.now();
  let predTime = tPredEnd - tPredStart;

  // === Update graphs and gene/population history ===
  const tGraphStart = performance.now();

  drawAgeGraph();
  updatePopulationHistory();
  drawPopulationGraph();
  updateGeneHistory();

  const tGraphEnd = performance.now();
  let graphTime = tGraphEnd - tGraphStart;

  // === UI toggles and overlays ===
  const tUiStart = performance.now();

  if (showGeneHistory) {
    toggleGeneRolesButton.show();
    drawGeneHistoryGraph(
      geneHistory.speed,
      geneHistoryWorkers.speed,
      geneHistorySoldiers.speed,
      geneHistoryScouts.speed,
      "Speed",
      color(255, 0, 0),
      5,
      height - 450 - 520
    );
    drawGeneHistoryGraph(
      geneHistory.pheromoneSensitivity,
      geneHistoryWorkers.pheromoneSensitivity,
      geneHistorySoldiers.pheromoneSensitivity,
      geneHistoryScouts.pheromoneSensitivity,
      "Pheromone Sensitivity",
      color(0, 255, 0),
      2,
      height - 450 - 400
    );
    drawGeneHistoryGraph(
      geneHistory.size,
      geneHistoryWorkers.size,
      geneHistorySoldiers.size,
      geneHistoryScouts.size,
      "Size",
      color(0, 0, 255),
      20,
      height - 450 - 280
    );
    drawGeneHistoryGraph(
      geneHistory.wanderStrength,
      geneHistoryWorkers.wanderStrength,
      geneHistorySoldiers.wanderStrength,
      geneHistoryScouts.wanderStrength,
      "Wander Strength",
      color(255, 0, 255),
      1,
      height - 450 - 160
    );
    drawGeneHistoryGraph(
      geneHistory.lifespan,
      geneHistoryWorkers.lifespan,
      geneHistorySoldiers.lifespan,
      geneHistoryScouts.lifespan,
      "Lifespan",
      color(255, 165, 0),
      15000,
      height - 450 - 40
    );
    drawGeneHistoryGraph(
      geneHistory.sensoryRange,
      geneHistoryWorkers.sensoryRange,
      geneHistorySoldiers.sensoryRange,
      geneHistoryScouts.sensoryRange,
      "Sensory Range",
      color(0, 128, 128),
      140,
      height - 450 + 80
    );
    drawGeneHistoryGraph(
      geneHistory.relativeStrength,
      geneHistoryWorkers.relativeStrength,
      geneHistorySoldiers.relativeStrength,
      geneHistoryScouts.relativeStrength,
      "Relative Strength",
      color(128, 0, 128),
      1.5,
      height - 450 + 200
    );
  } else {
    toggleGeneRolesButton.hide();
  }

  const tUiEnd = performance.now();

  // === Log simulation data every 250 frames (logSimulationData() has its own timers) ===
  if (frameCount % 250 === 0) {
    logSimulationData();
  }

  // === Overlay for night effect ===

  const tUiStart2 = performance.now();

  let overlayAlpha = map(sin(timeOfDay * TWO_PI), -1, 1, 150, 0);
  fill(20, 30, 50, overlayAlpha);
  noStroke();
  rect(0, 0, width, height);

  // === Display FPS ===
  fill(0);
  textSize(16);
  textAlign(RIGHT, TOP);
  text(`FPS: ${nf(frameRate(), 2, 2)}`, width - 10, 10);

  const tUiEnd2 = performance.now();
  let uiTime = tUiEnd - tUiStart + (tUiEnd2 - tUiStart2);

  uiTimeAcc += uiTime;

  const tEnd = performance.now();
  let totalFrameTime = tEnd - tStart;

  // === Accumulate timings for averaging ===
  totalFrameTimeAcc += totalFrameTime;
  pheromoneTimeAcc += pheromoneTime;
  staticDrawTimeAcc += staticDrawTime;
  antTimeAcc += antTime;
  predTimeAcc += predTime;
  graphTimeAcc += graphTime;
  frameCounter++;
}

// =================================================================
//        SIMULATION DATA & LOGGING FUNCTIONS
// =================================================================

function logSimulationData() {
  const t0 = performance.now(); // Overall logging start

  // ------------------------------
  // 1. Detailed Timing Breakdown
  // ------------------------------
  let totalCollisionTime = (antCollisionTimeAcc / 250).toFixed(2);
  let totalBehaviorTime = (antBehaviorTimeAcc / 250).toFixed(2);
  let totalMovementTime = (antMovementTimeAcc / 250).toFixed(2);
  let totalFoodDetectTime = (antFoodDetectTimeAcc / 250).toFixed(2);
  let totalNestDeliveryTime = (antNestDeliveryTimeAcc / 250).toFixed(2);
  let totalFollowTime = (antFollowTimeAcc / 250).toFixed(2);

  console.log("==== Detailed Timing Breakdown (per update/draw) ====");
  console.log(
    "Total frame time:         " + (totalFrameTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Spawning time:            " + (spawnTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Background update time:   " + (bgTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "UI overlay time:          " + (uiTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Pheromone update time:    " + (pheromoneTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Static drawing time:      " + (staticDrawTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Ant update/draw time:     " + (antTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Predator update/draw time:" + (predTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Graphing/gene history time:" + (graphTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log(
    "Ant grid build time:      " + (antGridTimeAcc / 250).toFixed(2) + " ms"
  );
  console.log("---- Ant Breakdown ----");
  console.log("Collision/Extra processing time: " + totalCollisionTime + " ms");
  console.log(
    "Behavior (fleeing, predator checks): " + totalBehaviorTime + " ms"
  );
  console.log(
    "Movement & position update time:   " + totalMovementTime + " ms"
  );
  console.log(
    "Food detection/pickup time:          " + totalFoodDetectTime + " ms"
  );
  console.log(
    "Nest delivery time:                  " + totalNestDeliveryTime + " ms"
  );
  console.log(
    "Follow/Wander time:                  " + totalFollowTime + " ms"
  );
  console.log(
    "Reproduction time:                   " +
      (reproductionTimeAcc / 250).toFixed(2) +
      " ms"
  );

  /* 
  // ------------------------------
  // 2. Simulation Data Collection
  // (Commented out: Not directly related to performance)
  const tAntStart = performance.now();
  let colonySum = { ... };
  // ... simulation data collection loop
  const tAntEnd = performance.now();
  console.log("Ant loop processing time: " + (tAntEnd - tAntStart).toFixed(2) + " ms");

  // ------------------------------
  // 3. Compute Averages & Variances
  // (Commented out: Not directly related to performance)
  const tAvgStart = performance.now();
  // ... averages computation code
  const tAvgEnd = performance.now();
  console.log("Averages computation time: " + (tAvgEnd - tAvgStart).toFixed(2) + " ms");

  // ------------------------------
  // 4. Additional Statistics
  // (Commented out: Not directly related to performance)
  const tStatsStart = performance.now();
  // ... additional stats code
  const tStatsEnd = performance.now();
  console.log("Statistics computation time: " + (tStatsEnd - tStatsStart).toFixed(2) + " ms");

  // ------------------------------
  // 5. Food Source & Population Metrics
  // (Commented out: Not directly related to performance)
  const tFoodStart = performance.now();
  // ... food source metrics code
  const tFoodEnd = performance.now();
  console.log("Food source metrics time: " + (tFoodEnd - tFoodStart).toFixed(2) + " ms");
  */

  // ------------------------------
  // 6. Other Simulation Metrics
  // (Commented out: Not directly related to performance)
  /*
  let nestRepro = typeof nestReproduction !== "undefined" ? nestReproduction.toFixed(2) : "N/A";
  let nestStore = typeof nestStorage !== "undefined" ? nestStorage.toFixed(2) : "N/A";
  let totalDmg = typeof totalDamageDealt !== "undefined" ? totalDamageDealt : "N/A";
  let predsKilled = typeof predatorsKilled !== "undefined" ? predatorsKilled : "N/A";
  let soldiersLost = typeof soldierAntsKilled !== "undefined" ? soldierAntsKilled : "N/A";
  let colonyLosses = typeof colonyAntsKilledByPredators !== "undefined" ? colonyAntsKilledByPredators : "N/A";
  let fps = frameRate().toFixed(2);
  */

  /* 
  // ------------------------------
  // 7. Final Output: Log Everything
  // (Commented out: Not directly related to performance)
  console.log("\n==== Simulation Metrics (Frame " + frameCount + ") ====");
  console.log("Colony Gene Averages:", colonyAvg);
  console.log("Worker Gene Averages:", workerAvg);
  console.log("Soldier Gene Averages:", soldierAvg);
  console.log("Scout Gene Averages:", scoutAvg);
  console.log("Colony Gene Variance:", colonyVariance);
  console.log("Average Energy: " + avgEnergy + ", Average Age: " + avgAge);
  console.log("Population: Workers: " + popWorkers + ", Soldiers: " + popSoldiers + ", Scouts: " + popScouts);
  console.log("Predators: " + popPredators + ", Predator Nests: " + predatorNestCount);
  console.log("Food Sources: " + numFoodSources + ", Total Food Amount: " + totalFoodAmount);
  console.log("Nest Reproduction: " + nestRepro + ", Nest Storage: " + nestStore);
  console.log("Predator Interactions: Total Damage Dealt: " + totalDmg + ", Predators Killed: " + predsKilled);
  console.log("Ant Losses - Soldiers: " + soldiersLost + ", Others: " + colonyLosses);
  console.log("FPS: " + fps);
  */

  const t1 = performance.now();
  console.log(
    "Total logSimulationData() time: " + (t1 - t0).toFixed(2) + " ms"
  );

  // ------------------------------
  // 8. Reset All Accumulators
  // ------------------------------
  totalFrameTimeAcc = 0;
  pheromoneTimeAcc = 0;
  staticDrawTimeAcc = 0;
  antTimeAcc = 0;
  predTimeAcc = 0;
  graphTimeAcc = 0;
  antCollisionTimeAcc = 0;
  antBehaviorTimeAcc = 0;
  antMovementTimeAcc = 0;
  antFoodDetectTimeAcc = 0;
  antNestDeliveryTimeAcc = 0;
  antFollowTimeAcc = 0;
  antCountForTiming = 0;
  reproductionTimeAcc = 0;
  antGridTimeAcc = 0;
  spawnTimeAcc = 0;
  bgTimeAcc = 0;
  uiTimeAcc = 0;
}

//
//
//
//
// MISC             MISC               MISC                MISC              MISC           MISC
//
//
//
//

function buildAntGrid() {
  const t0 = performance.now(); // Start timing

  // Create an empty grid with the same cell size as obstacles
  antGrid = new Array(gridCountX);
  for (let i = 0; i < gridCountX; i++) {
    antGrid[i] = new Array(gridCountY);
    for (let j = 0; j < gridCountY; j++) {
      antGrid[i][j] = [];
    }
  }
  // Assign each ant to the appropriate grid cell based on its position.
  for (let ant of ants) {
    let i = Math.floor(ant.x / obstacleGridSize);
    let j = Math.floor(ant.y / obstacleGridSize);
    // Ensure indices are valid.
    i = constrain(i, 0, gridCountX - 1);
    j = constrain(j, 0, gridCountY - 1);
    antGrid[i][j].push(ant);
  }

  const t1 = performance.now(); // End timing
  antGridTimeAcc += t1 - t0;
}
