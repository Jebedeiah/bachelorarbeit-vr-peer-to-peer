import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Peer from 'peerjs';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

//Three variables
let camera, scene, renderer;
let player;
let controllerL, controllerR;
let controllerGripL, controllerGripR;

//Peer variables
let conns = [];
let peer = new Peer();
let peerID;
let remotePeerID;


init();
animate();

// Three.js Code
function init(){
	const loader = new GLTFLoader();

	loader.load( '/models/floor_no_mat.glb', function ( gltf ) {
		scene.add( gltf.scene );
	}, undefined, function ( error ) {
		console.error( error );
	} );

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 500 );
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

	camera.position.set( 0, 0, 0 );

	// controllers
	function onSelectStart() {
		this.userData.isSelecting = true;
	}

	function onSelectEnd() {
		this.userData.isSelecting = false;
	}

	controllerL = renderer.xr.getController( 0 );
	controllerL.addEventListener( 'selectstart', onSelectStart );
	controllerL.addEventListener( 'selectend', onSelectEnd );
	controllerL.addEventListener( 'connected', function ( event ) {

		this.add( buildController() );

	} );
	controllerL.addEventListener( 'disconnected', function () {

		this.remove( this.children[ 0 ] );

	} );
	scene.add( controllerL );

	controllerR = renderer.xr.getController( 1 );
	controllerR.addEventListener( 'selectstart', onSelectStart );
	controllerR.addEventListener( 'selectend', onSelectEnd );
	controllerR.addEventListener( 'connected', function ( event ) {

		this.add( buildController() );

	} );
	controllerR.addEventListener( 'disconnected', function () {

		this.remove( this.children[ 0 ] );

	} );
	scene.add( controllerR );

	const controllerModelFactory = new XRControllerModelFactory();

	controllerGripL = renderer.xr.getControllerGrip( 0 );
	controllerGripL.add( controllerModelFactory.createControllerModel( controllerGripL ) );
	scene.add( controllerGripL );

	controllerGripR = renderer.xr.getControllerGrip( 1 );
	controllerGripR.add( controllerModelFactory.createControllerModel( controllerGripR ) );
	scene.add( controllerGripR );

}

function buildController() {

	let geometry, material;

	geometry = new THREE.BufferGeometry();
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

	material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

	return new THREE.Line( geometry, material );
}

function animate() {
	renderer.setAnimationLoop(render);
}

function render(){

	

	renderer.render( scene, camera );
}
//Peer.js Code


peer.on('open', function(id) {
	peerID = id;
	console.log('My peer ID is: ' + peerID);

	// Always show current PeerID
	let peerIdText = document.createElement('div');
	peerIdText.style.position = 'absolute';
	peerIdText.style.backgroundColor = "black";
	peerIdText.style.color = "white";
	peerIdText.innerText = peerID;
	peerIdText.style.bottom = 0;
	peerIdText.style.right = 0;
	peerIdText.style.padding = 2 + 'px';
	document.body.appendChild(peerIdText);
});



const connect = () => {
    const conn = peer.connect(remotePeerID)
    conn.on('open', () => {
      conns.push(conn);
      console.log("Connection established with", conn.peer);

	  conn.on('data', (data) => {
		console.log(data);
	  });
  
	  // Send messages
	  conn.send('Hello!');
	});
}

peer.on('connection', (conn) => {
	conns.push(conn);
	conn.on('data', (data) => {		
	  // Will print 'hi!'
	  console.log(data);
	  conn.send('Hi!');
	});
});

const updateValue = (e) => {
	remotePeerID = e.target.value;
}

//Connect Button
let connectButton = document.createElement('button');
connectButton.style.position = 'absolute';
connectButton.textContent = 'Connect';
connectButton.style.left = 'calc(50% - 40px)';
connectButton.style.bottom = 80 + 'px';
connectButton.style.width = 80 + 'px';
document.body.appendChild(connectButton);
connectButton.addEventListener("click", connect);

//Textfield for remote ID
let textField = document.createElement("INPUT");
textField.setAttribute("type", "text");
textField.style.position = 'absolute';
textField.style.left = 'calc(50% - 150px)';
textField.style.bottom = 120 + 'px';
textField.style.width = 300 + 'px';
document.body.appendChild(textField);
textField.addEventListener("input", updateValue);