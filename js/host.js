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
let playerWeapon;
let canShoot = true;
let otherPlayers = [];
let otherPlayersWeapons = [];
let otherPlayersBullets = [];
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let raycaster = new THREE.Raycaster();
let rayEndPoint = new THREE.Vector3();
let maxRayDistance = 200;
let objects = [];
let obstacles = [];
let collisionBoxes = [];
let bullet = null;
let gamepad;
let tank = new THREE.Object3D();
const clock = new THREE.Clock();

// Physics variables
const gravityConstant = - 9.81;
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
let physicsWorld;
let rigidBodies = [];

//Peer variables
let remotePeers = ["host"];
let conns = [];
let peer = new Peer("host");
let peerID;

const loader = new GLTFLoader();

window.addEventListener('DOMContentLoaded', async () => {
	Ammo().then((lib) => {
		Ammo = lib;
		init();		
	});
});

// Three.js Code
async function init(){

	initPhysics();

	// GLTF Loader
	const loadedData = await loader.loadAsync( 'public/models/tank.glb');

	tank = loadedData.scene;
	tank.traverse((obj) => {
		if(obj.isMesh){
				obj.material = new THREE.MeshStandardMaterial({color: 0x0096FF})					
			}
		}			
	)
	tank.position.set(0, .5, 0);
	player = tank.clone();	
	playerWeapon = player.children[1];

	
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 500 );
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	document.body.appendChild( renderer.domElement );
	document.body.appendChild( VRButton.createButton( renderer ) );
	renderer.xr.enabled = true;

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.background = new THREE.Color( 0x505050 );
	scene.environment = pmremGenerator.fromScene( environment ).texture;

	camera.position.set( 0, 1.6, 0 );	

	playerBB = new THREE.Box3().setFromObject(player);
	playerBBHelper = new THREE.Box3Helper( playerBB, 0xffff00 );
	scene.add( playerBBHelper );

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

	const rbGround = new RigidBody();
	rbGround.createBox(0, ground.position, ground.quaternion, new THREE.Vector3(100, 1, 100));
	physicsWorld.addRigidBody(rbGround.body);

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
	// obstacle = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x11ff11 }));
	// obstacle.position.set(-30, 5, -20);
	// obstacle.castShadow = true;
	// for(let i = 0; i < 10; i++){
	// 	const obs = obstacle.copy();
	// 	obstacles.push(obs);
	// 	scene.add(obs);
	// }

		
	// obstacleBB = new THREE.Box3().setFromObject(obstacle);
	// collisionBoxes.push(obstacleBB);
	
	// TestBox
	const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial({ color: 0x11ff11 }));
	box.position.set(0, 10, -20);
	box.castShadow = true;
	box.receiveShadow = true;
 	scene.add(box);

	const rbBox = new RigidBody();
	rbBox.createBox(1, box.position, box.quaternion, new THREE.Vector3(3, 3, 3));
	physicsWorld.addRigidBody(rbBox.body);
	
	rigidBodies.push({mesh: box, rigidBody: rbBox});
	
	// Raycaster maximum Distanz entspricht Größe der Karte
	raycaster.far = maxRayDistance;

	// controllers
	function onSelectStart() {
		this.userData.isSelecting = true;
	}

	function onSelectEnd() {
		this.userData.isSelecting = false;
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
		// this.add( raycaster );
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
	dolly.add(player);

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

// function buildRaycasterLine(){
// 	// Raycaster
// 	const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
// 	const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]);
// 	rayLine = new THREE.Line(rayGeometry, rayMaterial);

// 	return rayLine;
// }

function updateOrientation() {
	// Get joystick input		
	if(gamepad){
		let input;
		input = gamepad.axes;

		let x = input[2];
		let z = input[3];
	
		// Use joystick input to move camera
		const quaternion = dolly.quaternion.clone();
		dummyCam.getWorldQuaternion(dolly.quaternion);
		dolly.translateX(x * 0.05);
		dolly.translateZ(z * 0.05);
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
	updateRaycaster()
	shoot();
	sendPlayerData();
	updatePhysics(deltaTime);	
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
			otherPlayersWeapons[i].position.set(data[0].x, 1.12, data[0].z);
			// otherPlayersWeapons[i].quaternion.set(data[3]._x, data[3]._y, data[3]._z, data[3]._w);
			otherPlayersWeapons[i].lookAt(new THREE.Vector3(data[3].x, data[3].y, data[3].z));
			// otherPlayersWeapons[i].rotation.y += Math.PI;

			// bullets shot from other players
			if (data[4] === null) {
				if (otherPlayersBullets[i]) {
					scene.remove(otherPlayersBullets[i]);
					otherPlayersBullets[i] = null;
				}
			} else {
				if (!otherPlayersBullets[i]) {
					const geometry = new THREE.SphereGeometry(0.1, 8, 4);
					const material = new THREE.MeshStandardMaterial( { color: 0xffff00 } ); 
					let otherBullet = new THREE.Mesh( geometry, material );
					otherBullet.position.set(data[4].x, data[4].y, data[4].z);
					otherPlayersBullets[i] = otherBullet;
					scene.add(otherPlayersBullets[i]);
				} else {
				  	otherPlayersBullets[i].position.set(data[4].x, data[4].y, data[4].z);
				}
			}			
		});
	}
}

// Get raycaster rayEndPoint
function updateRaycaster() {
	
	for(let obj of objects){		
		let pos = new THREE.Vector3();
		let dir = new THREE.Vector3();
		controller2.getWorldPosition(pos);
		controller2.getWorldDirection(dir)
		dir.multiplyScalar(-1);
		raycaster.set(pos, dir);

		const intersects = raycaster.intersectObject(obj);
		if(intersects.length > 0){
			rayEndPoint = intersects[0].point;
		}
		else{
			rayEndPoint.addVectors(pos, dir.multiplyScalar(maxRayDistance) );
		}	
		if(playerWeapon){			
			playerWeapon.lookAt(rayEndPoint);
		}
	}
}

const shoot = () => {
	if ( controller2.userData.isSelecting === true ) {
		if(!bullet && canShoot){
			const geometry = new THREE.SphereGeometry(0.04, 8, 4);
			const material = new THREE.MeshStandardMaterial( { color: 0xffff00 } ); 
			bullet = new THREE.Mesh( geometry, material );
			bullet.castShadow = true;
			bullet.position.copy(playerWeapon.position);
			bullet.position.y += .61;
			bullet.quaternion.copy(playerWeapon.quaternion);
			console.log(bullet);
			bulletBB = new THREE.Box3().setFromObject(bullet);
			scene.add( bullet );
			removeBullet = setTimeout(() => {BulletTimeOut();}, 1500);

			canShoot = false;
			setTimeout(reload, 1500);
		}
	}
	moveBullet();
}

function reload(){
	console.log("here");
	canShoot = true;
}

const moveBullet = () => {
	if(bullet){
		bullet.translateZ(.3);
		bulletBB.setFromObject(bullet);
		for(let box of collisionBoxes){
			if(bulletBB.intersectsBox(box)){
				scene.remove(bullet);
				bullet = null;
				clearTimeout(removeBullet);
			}			
		}
	}
}

function BulletTimeOut() {
	if(bullet){
		scene.remove(bullet);
		bullet = null;
	}
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


// Ammo.js Code
function updatePhysics( deltaTime ) {
    // Step world
	physicsWorld.stepSimulation( deltaTime, 10 );

	// Update 
	for( let body of rigidBodies){
		let tmpTransform = new Ammo.btTransform();
		body.rigidBody.motionState.getWorldTransform(tmpTransform);
		const pos = tmpTransform.getOrigin();
		const quat = tmpTransform.getRotation();
		const pos3 = new THREE.Vector3(pos.x(), pos.y(), pos.z());
      	const quat3 = new THREE.Quaternion(quat.x(), quat.y(), quat.z(), quat.w());

      	body.mesh.position.copy(pos3);
      	body.mesh.quaternion.copy(quat3);
	}
}

function initPhysics(){
	collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    broadphase = new Ammo.btDbvtBroadphase();
    solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
	physicsWorld.setGravity( new Ammo.btVector3( 0, gravityConstant, 0 ) );
}