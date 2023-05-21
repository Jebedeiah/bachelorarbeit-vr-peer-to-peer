import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

//Three variables
let camera, dummyCam, scene, renderer;
let wall, wall2, wall3, wall4;
let obstacle, obstacle2, obstacle3, obstacle4;
let bulletBB, obstacleBB, playerBB, playerBBHelper;
let removeBullet;
let dolly;
let player = new THREE.Object3D();
let canShoot = true;
let otherPlayers = [];
let otherPlayersBullets = [];
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let tempMatrix = new THREE.Matrix4();
let raycaster = new THREE.Raycaster();
let rayEndPoint = new THREE.Vector3();
let maxRayDistance = 200;
let interactiveBalls = [];
let lastBallPositions = [];
let selectedObject;
let objects = [];
let obstacles = [];
let collisionBoxes = [];
let gamepad;
let robot = new THREE.Object3D();
const clock = new THREE.Clock();
let mixer, clips, clip, grabClip, throwClip, activeAction, prevAction, grabAction, throwAction;
let group = new THREE.Group();

//Peer variables
let remotePeers = ["host"];
let conns = [];
let peer = new Peer("host");
let peerID;

const loader = new GLTFLoader();

window.addEventListener('DOMContentLoaded', () => {
	init();			
});

// Three.js Code
async function init(){
	// GLTF Loader
	const loadedData = await loader.loadAsync( 'public/models/robot_animations.glb');
	robot = loadedData.scene;	
	mixer = new THREE.AnimationMixer(robot);
	clips = loadedData.animations;
	clip = THREE.AnimationClip.findByName(clips, "idle");
	activeAction = mixer.clipAction(clip);
	robot.position.set(0, 0.5, 0);
	robot.rotation.y += Math.PI;
	player = robot.clone();
	activeAction.play();

	grabClip = THREE.AnimationClip.findByName(clips, "take");
	grabAction = mixer.clipAction(grabClip);
	grabAction.setLoop(THREE.LoopOnce);
	grabAction.setEffectiveTimeScale(1.5);
	
	throwClip = THREE.AnimationClip.findByName(clips, "throw");
	throwAction = mixer.clipAction(throwClip);
	throwAction.setLoop(THREE.LoopOnce);
	throwAction.setEffectiveTimeScale(1.3);
	
	// tank.traverse((obj) => {
	// 	if(obj.isMesh){
	// 			obj.material = new THREE.MeshStandardMaterial({color: 0x0096FF})					
	// 		}
	// 	}			
	// )
	// tank.position.set(0, .5, 0);
	// player = tank.clone();	
	// playerWeapon = player.children[1];

	
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 500 );
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	document.body.appendChild( renderer.domElement );
	document.body.appendChild( VRButton.createButton( renderer ) );
	renderer.xr.enabled = true;
	scene.add(group);

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.background = new THREE.Color( 0x505050 );
	scene.environment = pmremGenerator.fromScene( environment ).texture;

	camera.position.set( 0, 1.6, 0 );

	// scene.add(robot);
	playerBB = new THREE.Box3().setFromObject(player);
	// playerBBHelper = new THREE.Box3Helper( playerBB, 0xffff00 );
	// scene.add( playerBBHelper );

	// Add floor
	const ground = new THREE.Mesh(
		new THREE.BoxGeometry(100, 1, 100),
		new THREE.MeshStandardMaterial({ color: 0x222222 }));
	ground.castShadow = false;
	ground.receiveShadow = true;
	const groundBB = new THREE.Box3().setFromObject(ground);
	collisionBoxes.push(groundBB);

	objects.push(ground);
 	scene.add(ground);	

	// Add walls
	const geometry = new THREE.BoxGeometry( 100, 10, 2 );
	const material = new THREE.MeshBasicMaterial( {color: 0x999999, side: THREE.DoubleSide} );
	wall = new THREE.Mesh( geometry, material );
	wall2 = wall.clone();
	wall3 = wall.clone();
	wall4 = wall.clone();
	wall.position.set(0, 5, -50);
	const wallBB = new THREE.Box3().setFromObject(wall);
	collisionBoxes.push(wallBB);
	wall2.position.set(-50, 5, 0);
	wall2.rotateY(Math.PI / 2);
	const wall2BB = new THREE.Box3().setFromObject(wall2);
	collisionBoxes.push(wall2BB);
	wall3.position.set(0, 5, 50);
	const wall3BB = new THREE.Box3().setFromObject(wall3);
	collisionBoxes.push(wall3BB);
	wall4.position.set(50, 5, 0);
	wall4.rotateY(Math.PI / 2);
	const wall4BB = new THREE.Box3().setFromObject(wall4);
	collisionBoxes.push(wall4BB);
	objects.push(wall, wall2, wall3, wall4)
	scene.add( wall, wall2, wall3, wall4 );
	
	// Add obstacles
	obstacle = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshStandardMaterial({ color: 0x11ff11 }));
	obstacle.position.set(-30, 5, -20);
	obstacle.castShadow = true;
	objects.push(obstacle);
	scene.add(obstacle);

	// 	scene.add(obs);
	// for(let i = 0; i < 10; i++){
	// 	const obs = obstacle.copy();
	// 	objects.push(obs);
	// 	scene.add(obs);
	// }

		
	obstacleBB = new THREE.Box3().setFromObject(obstacle);
	collisionBoxes.push(obstacleBB);
	
	// Ball the player can interact with
	let ball = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 12), new THREE.MeshStandardMaterial({color: 0xffff77}));
	ball.position.set(0, 2, -5);
	ball.isMoving = false;
	ball.velocity = new THREE.Vector3();
	ball.distance = 0;
	interactiveBalls.push(ball);
	scene.add(ball);

	for(let ball of interactiveBalls){
		lastBallPositions.push(ball.position.clone());
	}

	// Raycaster maximum Distanz entspricht Größe der Karte
	raycaster.far = maxRayDistance;

	// controllers
	function onSelectStart() {
		this.userData.isSelecting = true;
		grabAction.play();
		// grabAction.fadeOut(1);
		grabAction.reset();
	}
	
	function onSelectEnd() {
		this.userData.isSelecting = false;
		grabAction.stop();
		throwAction.play();
		// throwAction.fadeOut(1);
		throwAction.reset();
	}

	controller1 = renderer.xr.getController(0);
	controller1.addEventListener( 'connected', function ( event ) {
		this.add( buildController() );	
		gamepad = event.data.gamepad;
	});
	
	controller1.addEventListener( 'disconnected', function () {
		this.remove( this.children[ 0 ] );
	} );
	scene.add( controller1 );

	controller2 = renderer.xr.getController( 1 );
	controller2.addEventListener( 'selectstart', onSelectStart );
	controller2.addEventListener( 'selectend', onSelectEnd );
	controller2.addEventListener( 'connected', function ( event ) {
		this.add( buildRaycasterLine() );
	});

	controller2.addEventListener( 'disconnected', function () {
		this.remove( this.children[ 0 ] );
	} );
	scene.add( controller2 );

	const controllerModelFactory = new XRControllerModelFactory();

	controllerGrip1 = renderer.xr.getControllerGrip( 0 );
	controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
	scene.add( controllerGrip1 );

	controllerGrip2 = renderer.xr.getControllerGrip( 1 );
	controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
	scene.add( controllerGrip2 );

	dolly = new THREE.Group();
	dummyCam = new THREE.Group();
	
    dolly.position.set(0, 0, 0);
    scene.add(dolly);
    dolly.add(camera);
	camera.add(dummyCam);
    dolly.add(controller1);
    dolly.add(controller2);
    dolly.add(controllerGrip1);
    dolly.add(controllerGrip2);
	dolly.add(robot);

	animate();
}

function buildController() {

	let geometry, material;

	geometry = new THREE.BufferGeometry();
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

	material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );	

	return new THREE.Line( geometry, material );
}

function buildRaycasterLine(){
	// Raycaster
	const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
	const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]);

	return new THREE.Line(rayGeometry, rayMaterial);
}

function updateOrientation() {
	// Get joystick input		
	if(gamepad){
		let input;
		input = gamepad.axes;

		let x = input[2];
		let z = input[3];
	
		if(z < -0.5 ){
			playAnimation("running");
		}else if(z > 0.5){
			playAnimation("run_backwards");
		}else if(x < -0.5){
			playAnimation("strafe_left");
		}else if(x > 0.5){
			playAnimation("strafe_right");
		}else{
			playAnimation("idle");
		}
		// Use joystick input to move camera
		const quaternion = dolly.quaternion.clone();
		dummyCam.getWorldQuaternion(dolly.quaternion);
		dolly.translateX(x * 0.05);
		dolly.translateZ(z* 0.05);
		dolly.position.y = 0;
		dolly.quaternion.copy(quaternion);
	}
}

function animate() {		
	renderer.setAnimationLoop(render);
}

function render(){
	const deltaTime = clock.getDelta();
	updateOrientation();
	updateRaycaster();
	moveBall()
	sendPlayerData();
	if(mixer) mixer.update(deltaTime);
	renderer.render( scene, camera );
}

//Peer.js Code
peer.on('open', function(id) {
	peerID = id;
	console.log('My peer ID is: ' + peerID);
});


peer.on('connection', (conn) => {
	conn.on('open', () => {
		conn.send(remotePeers);
		console.log("Connection established with", conn.peer);

		//Create other Player in Scene
		createOtherPlayer();

		conns.push(conn);
		receiveData();
		remotePeers.push(conn.peer);
	});
});

const receiveData = () => {
	for(let i = 0; i < conns.length; i++){
		
		conns[i].on('data', (data) => {	
			// other players current position and looking direction
			otherPlayers[i].position.set(data[0].x, 0.5, data[0].z);
			otherPlayers[i].rotation.y = data[1];			
			// otherPlayers[i].rotation.y += Math.PI;

			// other players weapon direction (based on their controller rotation)
			// otherPlayersWeapons[i].position.set(data[0].x, 1.12, data[0].z);
			// otherPlayersWeapons[i].quaternion.set(data[3]._x, data[3]._y, data[3]._z, data[3]._w);
			// otherPlayersWeapons[i].lookAt(new THREE.Vector3(data[3].x, data[3].y, data[3].z));
			// otherPlayersWeapons[i].rotation.y += Math.PI;

			// bullets shot from other players
			// if (data[4] === null) {
			// 	if (otherPlayersBullets[i]) {
			// 		scene.remove(otherPlayersBullets[i]);
			// 		otherPlayersBullets[i] = null;
			// 	}
			// } else {
			// 	if (!otherPlayersBullets[i]) {
			// 		const geometry = new THREE.SphereGeometry(0.1, 8, 4);
			// 		const material = new THREE.MeshStandardMaterial( { color: 0xffff00 } ); 
			// 		let otherBullet = new THREE.Mesh( geometry, material );
			// 		otherBullet.position.set(data[4].x, data[4].y, data[4].z);
			// 		otherPlayersBullets[i] = otherBullet;
			// 		scene.add(otherPlayersBullets[i]);
			// 	} else {
			// 	  	otherPlayersBullets[i].position.set(data[4].x, data[4].y, data[4].z);
			// 	}
			// }			
		});
	}
}

function playAnimation(name){
	prevAction = activeAction;
	clip = THREE.AnimationClip.findByName(clips, name);
	activeAction = mixer.clipAction(clip);
	if(grabAction.isRunning() || throwAction.isRunning()){
		activeAction.setEffectiveWeight(0.7);
	} else{
		activeAction.setEffectiveWeight(1);
	}
	
	if ( prevAction !== activeAction ) {
		prevAction.fadeOut( 0.5 );
		activeAction.reset();
		activeAction.fadeIn( 0.5 );
	}
	activeAction.play();
}


// Get raycaster rayEndPoint
function updateRaycaster() {
	
	setRaycasterFromController(raycaster, controller2);
	for(let i = 0; i < interactiveBalls.length; i++){
		const intersects = raycaster.intersectObject(interactiveBalls[i]);
		if(intersects.length > 0){
			interactiveBalls[i].material.color.set(0xff0000);
			grabBall(intersects[0], i)
		}
		else{
			interactiveBalls[i].material.color.set(0xffff77);
		}		
	}
}

function grabBall(intersection, index){
	const ball = intersection.object;
	
	if(controller2.userData.isSelecting === true){
		if(ball.isMoving){
			ball.isMoving = false;
		}
		selectedObject = ball;			
		controller2.attach(ball);	
		let vel_dist = calculateBallVelocityAndDistance(ball, index);
		ball.velocity.copy(vel_dist[0]);
		ball.distance = vel_dist[1];
		// console.log(ball.velocity);
		console.log(ball.velocity.multiplyScalar(0.1));

	} else if (selectedObject && controller2.userData.isSelecting === false){
		selectedObject = null;
		group.attach(ball);
		if(ball.distance > 0.0001){
			ball.isMoving = true;
			// ball.velocity.normalize();			
			ball.velocity.multiplyScalar(0.1);
		}
	}
}


function calculateBallVelocityAndDistance(ball, index){
	const lastPosition = lastBallPositions[index].clone();
	const currentPosition = new THREE.Vector3();
	ball.getWorldPosition(currentPosition);
	let velocity = currentPosition.clone().sub(lastPosition);
	let distance = lastPosition.distanceTo(currentPosition);
	lastBallPositions[index] = currentPosition;
	return [velocity, distance];
}

function moveBall(){
	let bounceFactor = 0.8;
	let gravity = 0.001;
	for(let ball of interactiveBalls){
		if(ball.isMoving){
			ball.position.add(ball.velocity);			
			ball.velocity.y -= gravity;
			ball.velocity.multiplyScalar(0.9);
			if(ball.position.y < 1 ){
				ball.position.y = 1;
				ball.velocity.y *= -bounceFactor;
			}			 
		}
	}
}

function setRaycasterFromController(raycaster, controller){
	controller.updateMatrixWorld();
	tempMatrix.identity().extractRotation( controller.matrixWorld );
	raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );
}


peer.on('error', function (err) {
	console.log(err);
	// alert('' + err);
});

// Send player data to all current connections
const sendPlayerData = () => {
	if(conns.length > 0){
		let controllerPos = new THREE.Vector3();
		let cameraPos = new THREE.Vector3();
		// let controllerQuat = new THREE.Quaternion();
		let cameraQuat = new THREE.Quaternion();
		let bulletPos = new THREE.Vector3();
		controller2.getWorldPosition(controllerPos);
		// controller2.getWorldQuaternion(controllerQuat);
		dummyCam.getWorldPosition(cameraPos);
		dummyCam.getWorldQuaternion(cameraQuat);
		if(bullet){
			bullet.getWorldPosition(bulletPos);
		} else{ bulletPos = null;}

		// Get only Y-Rotation from Quaternion
		const euler = new THREE.Euler(0, 0, 0, 'YXZ');
		euler.setFromQuaternion(cameraQuat, 'YXZ');
		let playerData = [cameraPos, euler.y, controllerPos, rayEndPoint, bulletPos];

		for(let conn of conns){
			conn.send(playerData);
		}
	}	
}

const createOtherPlayer = () => {
	// Create other Player in Scene
	// const oppMaterial = new THREE.MeshStandardMaterial( {color: 0xffff00} );
	let opponent = tank.clone();
	scene.add(opponent);
	otherPlayers.push(opponent);

	// Create other Player's weapon in Scene
	// const oppWepMaterial = new THREE.MeshStandardMaterial( {color: 0x00ffff} );
	let opponentsWeapon = opponent.children[1];	
	otherPlayersWeapons.push(opponentsWeapon);
	scene.add(opponentsWeapon);
}