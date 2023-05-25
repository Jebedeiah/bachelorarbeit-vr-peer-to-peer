import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

//Three variables
let camera, dummyCam, scene, renderer;
let wall, wall2, wall3, wall4;
let xBoundary_player = 28;
let zBoundary_player = 43;
let dolly;
let player = new THREE.Object3D();
let playerHit = false;
let otherPlayers = [];
let otherPlayersCages = [];
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let tempMatrix = new THREE.Matrix4();
let raycaster = new THREE.Raycaster();
let maxRayDistance = 1.5;
const radius = 0.3;
let cage;
let cageBB;
let cageBBHelper;
let interactiveBalls = [];
let interactiveBallBBs = [];
let lastBallPositions = [];
let selectedObject;
let floorHeight = 0.34;
let objects = [];
let obstacles = [];
let collisionBoxes = [];
let gamepad;
let robot = new THREE.Object3D();
const clock = new THREE.Clock();
let mixers = [];
let activeActions = []
let prevActions = [];
let mixer, clips, clip, grabClip, throwClip, activeAction, grabAction, throwAction;
let throwing = false;
let taking = false;
let group = new THREE.Group();

//Peer variables
let remotePeers = [];
let conns = [];
let peer = new Peer();
let peerID;
let remotePeerID;
let firstMessage = true;

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

window.addEventListener('DOMContentLoaded', () => {
	init();		
});

// Three.js Code
async function init(){
	// GLTF Loader
	const loadedData = await gltfLoader.loadAsync( 'public/models/robot_animations.glb');
	robot = loadedData.scene;	
	robot.traverse((obj) => {
		if(obj.isMesh){
				obj.material = new THREE.MeshStandardMaterial({color: 0x0096FF})					
			}
		}			
	)
	robot.rotation.y += Math.PI;
	player = SkeletonUtils.clone(robot);

	const floorTexture = textureLoader.load('public/textures/floor_tiles.jpg');
	floorTexture.wrapS = THREE.RepeatWrapping;
	floorTexture.wrapT = THREE.RepeatWrapping;
	floorTexture.repeat.set(5, 5);

	const wallTexture = textureLoader.load('public/textures/wall_stones2.jpg');
	wallTexture.wrapS = THREE.RepeatWrapping;
	wallTexture.wrapT = THREE.RepeatWrapping;
	wallTexture.repeat.set(2, 1);

	mixer = new THREE.AnimationMixer(player);
	clips = loadedData.animations;
	clip = THREE.AnimationClip.findByName(clips, "idle");
	activeAction = mixer.clipAction(clip);
	// activeAction.play();

	grabClip = THREE.AnimationClip.findByName(clips, "take");
	grabAction = mixer.clipAction(grabClip);
	grabAction.setLoop(THREE.LoopOnce);
	grabAction.setEffectiveTimeScale(1.5);

	throwClip = THREE.AnimationClip.findByName(clips, "throw");
	throwAction = mixer.clipAction(throwClip);
	throwAction.setLoop(THREE.LoopOnce);
	throwAction.setEffectiveTimeScale(1.3);

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 500 );
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	document.body.appendChild( renderer.domElement );
	document.body.appendChild( VRButton.createButton( renderer ) );
	renderer.xr.enabled = true;
	scene.add(group);

	// scene.add(player);

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );
	scene.background = new THREE.Color( 0x505050 );
	scene.environment = pmremGenerator.fromScene( environment ).texture;
	camera.position.set( 0, 1.6, 0 );

	// Add floor
	const ground = new THREE.Mesh(
		new THREE.BoxGeometry(60, 0.1, 90),
		new THREE.MeshStandardMaterial({ map: floorTexture }));
	ground.castShadow = false;
	ground.receiveShadow = true;

	// objects.push(ground);
 	scene.add(ground);

	// Add walls
	const shortGeometry = new THREE.BoxGeometry( 60, 30, 2 );
	const longGeometry = new THREE.BoxGeometry( 90, 30, 2 );
	const material = new THREE.MeshBasicMaterial( {map: wallTexture} );
	wall = new THREE.Mesh( shortGeometry, material );
	wall2 = new THREE.Mesh( longGeometry, material );
	wall3 = wall.clone();
	wall4 = wall2.clone();
	wall.position.set(0, 15, -45);
	const wallBB = new THREE.Box3().setFromObject(wall);
	collisionBoxes.push(wallBB);
	wall2.position.set(-30, 15, 0);
	wall2.rotateY(Math.PI / 2);
	const wall2BB = new THREE.Box3().setFromObject(wall2);
	collisionBoxes.push(wall2BB);
	wall3.position.set(0, 15, 45);
	const wall3BB = new THREE.Box3().setFromObject(wall3);
	collisionBoxes.push(wall3BB);
	wall4.position.set(30, 15, 0);
	wall4.rotateY(Math.PI / 2);
	const wall4BB = new THREE.Box3().setFromObject(wall4);
	collisionBoxes.push(wall4BB);
	objects.push(wall, wall2, wall3, wall4)	
	scene.add( wall, wall2, wall3, wall4 );
	
	// Cage for hit players
	cage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7), new THREE.MeshStandardMaterial({ color: 0xEA430A, opacity: 0.5, transparent: true, side: THREE.DoubleSide }));
	cage.castShadow = false;
	cage.visible = false;
	cage.position.set(camera.position.x, 0.95, camera.position.z);
	cageBB = new THREE.Box3().setFromObject(cage);
	scene.add(cage);

	
	// Balls the player can interact with
	for(let i = 0; i < 10; i++){
		let ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), new THREE.MeshStandardMaterial({color: 0xCDDC51}));
		ball.position.x = (i * 5 - 25);
		ball.position.z = 0;
		ball.position.y = floorHeight; 
		ball.isMoving = false;
		ball.velocity = new THREE.Vector3();
		ball.distance = 0;
		interactiveBalls.push(ball);
		scene.add(ball);
		let ballBB = new THREE.Box3().setFromObject(ball);
		interactiveBallBBs.push(ballBB);
	}
	
	for(let ball of interactiveBalls){
		lastBallPositions.push(ball.position.clone());
	}

	// Raycaster maximum Distanz entspricht Größe der Karte
	raycaster.far = maxRayDistance;
	
	// controllers
	function onSelectStart() {
		this.userData.isSelecting = true;
		taking = true;
		grabAction.play();
		grabAction.reset();
	}

	function onSelectEnd() {
		this.userData.isSelecting = false;
		throwing = true;
		grabAction.stop();
		throwAction.play();
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
	
    dolly.position.set(0, 0, 5);
    scene.add(dolly);
    dolly.add(camera);
	camera.add(dummyCam);
    dolly.add(controller1);
    dolly.add(controller2);
    dolly.add(controllerGrip1);
    dolly.add(controllerGrip2);
	dolly.add(cage);

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
		let x;
		let z;

		if(playerHit){
			x = 0;
			z = 0;
		} else{
			x = input[2];
			z = input[3];
		}		
	
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
		if(dolly.position.x > xBoundary_player) dolly.position.x = xBoundary_player;
		if(dolly.position.x < -xBoundary_player) dolly.position.x = -xBoundary_player;
		if(dolly.position.z > zBoundary_player ) dolly.position.z = zBoundary_player;
		if(dolly.position.z < -zBoundary_player) dolly.position.z = -zBoundary_player;
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
	moveBall();
	checkPlayerHit();
	sendPlayerData();
	updateMixers(deltaTime)
	renderer.render( scene, camera );
}

//Peer.js Code
peer.on('open', function(id) {
	peerID = id;
	console.log('My peer ID is: ' + peerID);
	remotePeerID = "host"
	connect();
});

peer.on('error', function (err) {
	console.log(err);
	// alert('' + err);
});

peer.on('connection', (conn) => {
	conn.on('open', () => {		
		console.log("Connection established with", conn.peer);		
		createOtherPlayer();
		conns.push(conn);
		receiveData();
		remotePeers.push(conn.peer);
	});
});

//Connect to host and other available Peers
const connect = () => {
    const hostConn = peer.connect(remotePeerID)
    hostConn.on('open', () => {
		console.log("Connection established with", hostConn.peer);
		conns.push(hostConn);

		hostConn.on('data', (data) => {
			if(firstMessage){
				remotePeers = data;
				for(let id of remotePeers) {

					if(id === "host"){
						createOtherPlayer();
						receiveData();
						continue;
					} 

					const newConn = peer.connect(id);
					newConn.on('open', () => {
						conns.push(newConn);
						console.log("Connection established with", newConn.peer);
						createOtherPlayer();
						receiveData();
					});
				}
				firstMessage = false;
			}
		});
	});
}

const receiveData = () => {
	for(let i = 0; i < conns.length; i++){
		
		conns[i].on('data', (data) => {	
			// other players current position and looking direction
			otherPlayers[i].position.set(data[0].x, 0.04, data[0].z);
			otherPlayers[i].rotation.y = data[1] * -1;

			//Play walk, grab and throw animations of other playes
			playWalkAnimation(data[2], i);
			if(data[3]){
				grabAction = mixers[i].clipAction(grabClip);
				grabAction.setLoop(THREE.LoopOnce);
				grabAction.setEffectiveTimeScale(1.5);
				grabAction.play();
				grabAction.reset();
			}
			if(data[4]){
				grabAction.stop();
				throwAction = mixers[i].clipAction(throwClip);
				throwAction.setLoop(THREE.LoopOnce);
				throwAction.setEffectiveTimeScale(1.3);
				throwAction.play();
				throwAction.reset();
			}
			for(let ballData of data[5]){
				interactiveBalls[ballData[0]].position.copy(ballData[1]);
			}
			if(data[6]){
				otherPlayersCages[i].position.set(data[0].x, 0.95, data[0].z);
				otherPlayersCages[i].visible = true;
			} else{ otherPlayersCages[i].visible = false; }
		});
	}	
}	

// Send player data to all current connections
function sendPlayerData() {
	let cameraPos = new THREE.Vector3();
	let cameraQuat = new THREE.Quaternion();
	let ballPosData = getBallPos();
	dummyCam.getWorldPosition(cameraPos);
	dummyCam.getWorldQuaternion(cameraQuat);
	const euler = new THREE.Euler(0, 0, 0, 'YXZ');
	euler.setFromQuaternion(cameraQuat, 'YXZ');
	let playerData = [cameraPos, euler.y, activeAction._clip.name, taking, throwing, ballPosData, playerHit];
	taking = false;
	throwing = false;
	for(let conn of conns){
		conn.send(playerData);
	}
}

function getBallPos(){
	let ballPosData = [];
	for(let i = 0; i < interactiveBalls.length; i++){
		if(interactiveBalls[i].distance > 0.0001){			
			let ballWorldPos = new THREE.Vector3();
			interactiveBalls[i].getWorldPosition(ballWorldPos);
			let data = [i, ballWorldPos];
			ballPosData.push(data);
		}		
	}
	return ballPosData;
}

function playAnimation(name){
	clip = THREE.AnimationClip.findByName(clips, name);
	activeAction = mixer.clipAction(clip);
}


// Get raycaster rayEndPoint
function updateRaycaster() {
	
	setRaycasterFromController(raycaster, controller2);
	for(let i = 0; i < interactiveBalls.length; i++){
		const intersects = raycaster.intersectObject(interactiveBalls[i]);
		if(intersects.length > 0){
			interactiveBalls[i].material.color.set(0xff0000);
			grabBall(intersects[0].object, i)
		}
		else{
			interactiveBalls[i].material.color.set(0xCDDC51);
			if(interactiveBalls[i].parent !== group){
				group.attach(interactiveBalls[i]);
				interactiveBalls[i].velocity.set(0,0,0);
				interactiveBalls[i].isMoving = true;
			} 
		}
	}
}

function grabBall(ball, index){
	if(controller2.userData.isSelecting === true){
		if(ball.isMoving){
			ball.isMoving = false;
		}
		if(controller2.children.length < 2){
		controller2.attach(ball);	
		selectedObject = ball;
		}		
		let vel_dist = calculateBallVelocityAndDistance(selectedObject, index);
		selectedObject.velocity.copy(vel_dist[0]);
		selectedObject.distance = vel_dist[1];

	} else if (selectedObject && controller2.userData.isSelecting === false){
		group.attach(selectedObject);
		if(selectedObject.distance > 0.0001 || selectedObject.position.y > 1){
			selectedObject.isMoving = true;
		}
		selectedObject = null;		
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
	let bounceFactor = 0.5;
	let gravity = 0.003;
	for(let i = 0; i < interactiveBalls.length; i++){
		let ball = interactiveBalls[i];
		let lastPosition = ball.position.clone();
		if(ball.isMoving){
			ball.position.add(ball.velocity);			
			ball.velocity.y -= gravity;
			ball.velocity.multiplyScalar(0.995);
			ball.distance = lastPosition.distanceTo(ball.position);			
			if(ball.position.y < floorHeight ){
				ball.position.y = floorHeight;
				ball.velocity.y *= -bounceFactor;
				if(ball.velocity.y < 0.02) ball.velocity.y = 0;
			}
			if(ball.distance < 0.025 && ball.position.y === floorHeight){
				ball.isMoving = false;
		}
			interactiveBallBBs[i].setFromObject(ball);
			ball_walltouch(i);
		}
	}
}

function checkPlayerHit(){
	cageBB.setFromObject(cage);
	for(let i = 0; i < interactiveBallBBs.length; i++){
		if(interactiveBalls[i].isMoving && interactiveBallBBs[i].intersectsBox(cageBB)){
			cage.visible = true;
			playerHit = true;
			setTimeout(continueMovement, 3000);
		}
	}
}

function continueMovement(){
	playerHit = false;
	cage.visible = false;
}

function ball_walltouch(index){	
	if(interactiveBallBBs[index].intersectsBox(collisionBoxes[0]) || interactiveBallBBs[index].intersectsBox(collisionBoxes[2])){
		interactiveBalls[index].velocity.z *= -0.5;
	}
	if(interactiveBallBBs[index].intersectsBox(collisionBoxes[1]) || interactiveBallBBs[index].intersectsBox(collisionBoxes[3])){
		interactiveBalls[index].velocity.x *= -0.5;
	}
}

function setRaycasterFromController(raycaster, controller){
	controller.updateMatrixWorld();
	tempMatrix.identity().extractRotation( controller.matrixWorld );
	raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );
}

const createOtherPlayer = () => {
	// Create other Player in Scene
	// const oppMaterial = new THREE.MeshStandardMaterial( {color: 0xffff00} );
	let opponent = SkeletonUtils.clone(robot);
	const oppMixer = new THREE.AnimationMixer(opponent);
	scene.add(opponent);
	otherPlayers.push(opponent);
	let oppCage = cage.clone();
	scene.add(oppCage);
	otherPlayersCages.push(oppCage);
	clip = THREE.AnimationClip.findByName(clips, "idle");
	let actAction = oppMixer.clipAction(clip);
	let preAction = actAction;
	activeActions.push(actAction);
	prevActions.push(preAction);
	mixers.push(oppMixer);
	actAction.play();
}

function playWalkAnimation(name, index){
	
	prevActions[index] = activeActions[index];
	clip = THREE.AnimationClip.findByName(clips, name);
	activeActions[index] = mixers[index].clipAction(clip);

	if ( prevActions[index] !== activeActions[index] ) {
		prevActions[index].fadeOut( 0.3 );
		activeActions[index].reset();
		activeActions[index].fadeIn( 0.3 );
		}
	activeActions[index].play();
	
}

function updateMixers(deltaTime){
	if(mixer) mixer.update(deltaTime);
	for(let mixer of mixers){
		mixer.update(deltaTime);
	}
}