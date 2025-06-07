// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -30, 0); // m/s²
world.solver.iterations = 20; // Increase solver iterations for more accuracy

// Materials
const ballMaterial = new CANNON.Material('ballMaterial');
const wallMaterial = new CANNON.Material('wallMaterial');
const ballWallContactMaterial = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
    friction: 0.05,
    restitution: 0.0
});
world.addContactMaterial(ballWallContactMaterial);

// Cube
const cubeSize = 10;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2 });
const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
scene.add(cubeMesh);

const cubeEdges = new THREE.EdgesGeometry(cubeGeometry);
const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.8 });
const cubeLine = new THREE.LineSegments(cubeEdges, edgesMaterial);
scene.add(cubeLine);

const cubeBody = new CANNON.Body({ mass: 0 }); // mass = 0 makes it static
cubeBody.type = CANNON.Body.KINEMATIC;
world.addBody(cubeBody);

// Add walls to the cube body
const wallThickness = 0.1;
const wallMaterialOptions = { friction: 0.1, restitution: 0.7 };

// Create 6 walls
const wallShapes = [
    new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, wallThickness / 2)), // back
    new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, wallThickness / 2)), // front
    new CANNON.Box(new CANNON.Vec3(wallThickness / 2, cubeSize / 2, cubeSize / 2)), // left
    new CANNON.Box(new CANNON.Vec3(wallThickness / 2, cubeSize / 2, cubeSize / 2)), // right
    new CANNON.Box(new CANNON.Vec3(cubeSize / 2, wallThickness / 2, cubeSize / 2)), // bottom
    new CANNON.Box(new CANNON.Vec3(cubeSize / 2, wallThickness / 2, cubeSize / 2))  // top
];

const wallOffsets = [
    new CANNON.Vec3(0, 0, -cubeSize / 2),
    new CANNON.Vec3(0, 0, cubeSize / 2),
    new CANNON.Vec3(-cubeSize / 2, 0, 0),
    new CANNON.Vec3(cubeSize / 2, 0, 0),
    new CANNON.Vec3(0, -cubeSize / 2, 0),
    new CANNON.Vec3(0, cubeSize / 2, 0)
];

for (let i = 0; i < 6; i++) {
    cubeBody.addShape(wallShapes[i], wallOffsets[i]);
}


// Balls
const ballRadius = 0.8;
const ballShape = new CANNON.Sphere(ballRadius);
const balls = [];
const ballMeshes = [];

// Function to create pool ball textures
function createPoolBallTexture(number, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Base color
    if ((number > 0 && number < 8) || number === 8) { // Solid balls & 8-ball
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, canvas.height);
    } else { // Cue ball and striped balls
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stripe for striped balls
    if (number > 8) {
        context.fillStyle = color;
        context.fillRect(0, centerY - 50, canvas.width, 100);
    }

    if (number > 0) { // All balls except cue ball
        // Number circle
        context.fillStyle = 'white';
        context.beginPath();
        context.arc(centerX, centerY, 40, 0, Math.PI * 2);
        context.fill();
        context.closePath();

        // Number text
        context.fillStyle = 'black';
        context.font = 'bold 50px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(number.toString(), centerX, centerY);
    }
    
    return new THREE.CanvasTexture(canvas);
}

const poolBallColors = [
    '#FFFFFF', // 0 cue ball (white)
    '#FFC107', // 1 yellow
    '#03A9F4', // 2 blue
    '#F44336', // 3 red
    '#9C27B0', // 4 purple
    '#FF9800', // 5 orange
    '#4CAF50', // 6 green
    '#795548', // 7 maroon
    '#000000', // 8 black
    '#FFC107', // 9 yellow stripe
    '#03A9F4', // 10 blue stripe
    '#F44336', // 11 red stripe
    '#9C27B0', // 12 purple stripe
    '#FF9800', // 13 orange stripe
    '#4CAF50', // 14 green stripe
    '#795548'  // 15 maroon stripe
];


for (let i = 0; i < 16; i++) { // Create 16 balls (0-15)
    const color = poolBallColors[i];
    const texture = createPoolBallTexture(i, color);

    const ballMeshMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.2
    });
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMesh = new THREE.Mesh(ballGeometry, ballMeshMaterial);
    scene.add(ballMesh);
    ballMeshes.push(ballMesh);

    const ballBody = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(
            (Math.random() - 0.5) * (cubeSize - ballRadius * 2),
            (Math.random() - 0.5) * (cubeSize - ballRadius * 2),
            (Math.random() - 0.5) * (cubeSize - ballRadius * 2)
        ),
        shape: ballShape,
        material: ballMaterial
    });

    // Enable CCD for all balls to prevent tunneling
    // ballBody.ccdSpeedThreshold = 0.1;
    // ballBody.ccdMotionThreshold = ballRadius;

    world.addBody(ballBody);
    balls.push(ballBody);
}

camera.position.z = 20;

// Mouse controls
let previousMousePosition = { x: 0, y: 0 };
let isMouseDown = false;
let previousPinchDistance = null;
let touchStartTime = 0;
let touchMoved = false;

// Physics-based rotation
const rotationSpeed = 0.1;
const maxAngularVelocity = 10; // radians per second

document.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
});

document.addEventListener('mouseup', () => {
    isMouseDown = false;
});

document.addEventListener('mousemove', (event) => {
    if (!isMouseDown) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    cubeBody.angularVelocity.y += deltaX * rotationSpeed * 0.1;
    cubeBody.angularVelocity.x += deltaY * rotationSpeed * 0.1;

    previousMousePosition = { x: event.clientX, y: event.clientY };
});

// Touch controls
document.addEventListener('touchstart', (event) => {
    isMouseDown = true;
    touchMoved = false;
    touchStartTime = new Date().getTime();
    previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
});

document.addEventListener('touchend', (event) => {
    isMouseDown = false;
    const touchEndTime = new Date().getTime();
    if (!touchMoved && touchEndTime - touchStartTime < 200) { // Tap gesture
        const newColor = new THREE.Color(Math.random(), Math.random(), Math.random());
        cubeMaterial.color.set(newColor);
        edgesMaterial.color.set(newColor);
    }
});

document.addEventListener('touchmove', (event) => {
    if (!isMouseDown) return;

    event.preventDefault();

    // Handle pinch-to-zoom
    touchMoved = true;
    if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);

        if (previousPinchDistance) {
            const delta = distance - previousPinchDistance;
            camera.position.z -= delta * 0.1;
        }
        previousPinchDistance = distance;
        return; // Skip rotation when zooming
    } else {
        previousPinchDistance = null;
    }

    const deltaX = event.touches[0].clientX - previousMousePosition.x;
    const deltaY = event.touches[0].clientY - previousMousePosition.y;

    cubeBody.angularVelocity.y += deltaX * rotationSpeed * 0.1;
    cubeBody.angularVelocity.x += deltaY * rotationSpeed * 0.1;

    previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: false });

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        const newColor = new THREE.Color(Math.random(), Math.random(), Math.random());
        cubeMaterial.color.set(newColor);
        edgesMaterial.color.set(newColor);
    }
});

document.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * 0.01;
});


// Animation loop
const clock = new THREE.Clock();
let oldElapsedTime = 0;

function animate() {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    // Step the physics world
    world.step(1 / 60, deltaTime, 20); // Increased maxSubSteps from 10 to 20

    // Since the cube is now a kinematic body, the physics engine handles its rotation based on its angular velocity.
    // We can apply damping if we want it to slow down. The user wants it to spin indefinitely.
    if (!isMouseDown) {
        // No damping to let it spin forever.
        // For a slowing effect, you could use:
        // cubeBody.angularVelocity.scale(0.98, cubeBody.angularVelocity);
    }

    // Clamp angular velocity to prevent excessive speeds
    cubeBody.angularVelocity.x = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, cubeBody.angularVelocity.x));
    cubeBody.angularVelocity.y = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, cubeBody.angularVelocity.y));
    cubeBody.angularVelocity.z = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, cubeBody.angularVelocity.z));

    // Update ball positions
    for (let i = 0; i < balls.length; i++) {
        const ballBody = balls[i];
        const ballMesh = ballMeshes[i];
        ballMesh.position.copy(ballBody.position);
        ballMesh.quaternion.copy(ballBody.quaternion);
    }

    // Update cube visual representation
    cubeMesh.quaternion.copy(cubeBody.quaternion);
    cubeLine.quaternion.copy(cubeBody.quaternion);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
