import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

//Three variables
let camera, dummyCam, scene, renderer;
let dolly;
let otherPlayers = [];
let otherPlayersWeapons = [];
let player;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let gamepad;

//Ammo variables
// let Ammo;

//Peer variables
let remotePeers = ["host"];
let conns = [];
let peer = new Peer("host");
let peerID;

const loader = new GLTFLoader();

window.addEventListener('DOMContentLoaded', () => {
	init();
	animate();
})


// Three.js Code
function init(){	

	//// Ammo.JS
	// this.collisionConfiguration_ = new Ammo.btDefaultCollisionConfiguration();
    // this.dispatcher_ = new Ammo.btCollisionDispatcher(this.collisionConfiguration_);
    // this.broadphase_ = new Ammo.btDbvtBroadphase();
    // this.solver_ = new Ammo.btSequentialImpulseConstraintSolver();
    // this.physicsWorld_ = new Ammo.btDiscreteDynamicsWorld(
    // this.dispatcher_, this.broadphase_, this.solver_, this.collisionConfiguration_);
    // this.physicsWorld_.setGravity(new Ammo.btVector3(0, -100, 0));

	//// GLTF Loader
	// loader.load( 'public/models/floor_no_mat.glb', function ( gltf ) {
	// 	const floor = gltf.scene;
	// 	floor.traverse((obj) => {
	// 		if(obj.isMesh){
	// 				obj.material = new THREE.MeshStandardMaterial({color: 0x0096FF})
	// 			}
	// 		}
	// 	)
	// 	scene.add( gltf.scene );
	// }, undefined, function ( error ) {
	// 	console.error( error );
	// } );


	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 500 );
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputEncoding = THREE.sRGBEncoding;
	document.body.appendChild( renderer.domElement );
	document.body.appendChild( VRButton.createButton( renderer ) );
	renderer.xr.enabled = true;

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.background = new THREE.Color( 0x505050 );
	scene.environment = pmremGenerator.fromScene( environment ).texture;

	camera.position.set( 0, 1.6, 0 );	

	// Player
	// const playerGeometry = new THREE.BoxGeometry( 0.5, 1.6, 0.5 );
	// const playerMaterial = new THREE.MeshStandardMaterial( {color: 0x00ff00} );
	// player = new THREE.Mesh( playerGeometry, playerMaterial );
	// player.position.set(0,1.6,0);

	// Add floor
	let ground = new THREE.Mesh(
		new THREE.PlaneGeometry(50, 50, 10, 10),
		new THREE.MeshPhongMaterial({ color: 0x00ff00, wireframe: true })
	);

	ground.rotation.x -= Math.PI / 2; // Rotate the floor 90 degrees
	ground.receiveShadow = true;
 	scene.add(ground);

	
	
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
		this.add( buildController() );
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
	// dolly.add(player);
    dolly.add(controller1);
    dolly.add(controller2);
    dolly.add(controllerGrip1);
    dolly.add(controllerGrip2);
}

function buildController() {

	let geometry, material;

	geometry = new THREE.BufferGeometry();
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

	material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

	return new THREE.Line( geometry, material );
}

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
	updateOrientation();
	sendPlayerData();
	renderer.render( scene, camera );
}


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
			// console.log(data[0], data[1]);
			otherPlayers[i].position.set(data[0].x, data[0].y, data[0].z);
			otherPlayersWeapons[i].position.set(data[1].x, data[1].y, data[1].z)
		});
	}
}


peer.on('error', function (err) {
	console.log(err);
	// alert('' + err);
});

//Send something to all current connections
const sendPlayerData = () => {
	if(conns.length > 0){
		let controllerPos = new THREE.Vector3();
		let cameraPos = new THREE.Vector3();
		controllerGrip2.getWorldPosition(controllerPos);
		dummyCam.getWorldPosition(cameraPos);
		let posQuatData = [cameraPos, controllerPos];
		// posQuatData.push(new THREE.Vector3(dolly.position));
		// posQuatData.push(new THREE.Vector3(dolly.quaternion));
		// posQuatData.push(new THREE.Vector3(controllerGrip2.position));
		// posQuatData.push(new THREE.Vector3(controllerGrip2.quaternion));

		for(let conn of conns){
			conn.send(posQuatData);
		}
	}
	
}

const createOtherPlayer = () => {
	//Create other Player in Scene
	const oppGeometry = new THREE.BoxGeometry( 0.5, 1.6, 0.5 );
	const oppMaterial = new THREE.MeshStandardMaterial( {color: 0xffff00} );
	let opponent = new THREE.Mesh( oppGeometry, oppMaterial );
	scene.add(opponent);
	otherPlayers.push(opponent);

	//Create other Player's weapon in Scene
	const oppWepGeometry = new THREE.BoxGeometry( 0.2, 0.2, 0.4 );
	const oppWepMaterial = new THREE.MeshStandardMaterial( {color: 0x00ffff} );
	let opponentsWeapon = new THREE.Mesh( oppWepGeometry, oppWepMaterial );
	scene.add(opponentsWeapon);
	otherPlayersWeapons.push(opponentsWeapon);
}
