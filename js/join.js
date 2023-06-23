import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

//Three variables
let camera, dummyCam, scene, renderer;
let wall, wall2, wall3, wall4;
let redBase, blueBase;
let redBaseBB, blueBaseBB;
let redFlag, blueFlag;
let redFlagBB, blueFlagBB;
let enemy_flag_in_base = true;
let allied_flag_in_base = true;
let flag_in_possession = false;
let reset_flag = false;
let points = 0;
let gameOver = false;
const xBoundary_player = 28;
const zBoundary_player = 43;
let dolly;
let player = new THREE.Object3D();
let playerHit = false;
let teamColor;
let otherPlayers = [];
let otherPlayersCages = [];
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let tempMatrix = new THREE.Matrix4();
let grabRaycaster = new THREE.Raycaster();
let moveRaycasters = [];
const maxRayDistance = 1.5;
const radius = 0.3;
let cage;
let cageBB;
let interactiveBalls = [];
let interactiveBallBBs = [];
let lastBallPositions = [];
let selectedObject;
const floorHeight = 0.34;
const obstacles = [];
let boxPositions = [];
let obstacleBBs = [];
const groundWidth = 60;
const groundLength = 90;
let collisionBoxes = [];
let gamepad;
let robot = new THREE.Object3D();
let baseFlag = new THREE.Object3D();
const clock = new THREE.Clock();
let mixers = [];
let activeActions = []
let prevActions = [];
let mixer, clips, clip, grabClip, throwClip, activeAction, grabAction, throwAction, grabActionOther, throwActionOther;
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
	const robotData = await gltfLoader.loadAsync( '/models/robot_animations.glb');
	robot = robotData.scene;
	robot.rotation.y += Math.PI;
	player = SkeletonUtils.clone(robot);

	const flagData = await gltfLoader.loadAsync( '/models/base_flag.glb');
	baseFlag = flagData.scene;
	baseFlag.castShadow = true;
	
	const floorTexture = textureLoader.load('/textures/floor_tiles.jpg');
	floorTexture.wrapS = THREE.RepeatWrapping;
	floorTexture.wrapT = THREE.RepeatWrapping;
	floorTexture.repeat.set(2, 4);

	const wallTexture = textureLoader.load('/textures/wall_stones2.jpg');
	wallTexture.wrapS = THREE.RepeatWrapping;
	wallTexture.wrapT = THREE.RepeatWrapping;
	wallTexture.repeat.set(2, 1);

	mixer = new THREE.AnimationMixer(player);
	clips = robotData.animations;
	clip = THREE.AnimationClip.findByName(clips, "idle");
	activeAction = mixer.clipAction(clip);

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
	renderer.shadowMap.enabled = true;
	scene.add(group);

	scene.background = new THREE.Color( 0x505050 );
	const ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white directionalLight
	scene.add( ambientLight )
	let directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(-5, 15, -5);
	directionalLight.castShadow = true;
	scene.add(directionalLight);
	directionalLight.shadow.camera.top = 45;
	directionalLight.shadow.camera.bottom = -45;
	directionalLight.shadow.camera.left = -30;
	directionalLight.shadow.camera.right = 30;
	directionalLight.shadow.mapSize.width = 2048;
	directionalLight.shadow.mapSize.height = 2048;

	camera.position.set( 0, 1.6, 0 );

	// Add floor
	const ground = new THREE.Mesh(
		new THREE.BoxGeometry(groundWidth, 0.1, groundLength),
		new THREE.MeshStandardMaterial({ map: floorTexture }));
	ground.castShadow = false;
	ground.receiveShadow = true;

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
	scene.add( wall, wall2, wall3, wall4 );

	// Add bases
	redBase = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xff0000, opacity: 0.5, transparent: true, side: THREE.DoubleSide }));
	redBase.castShadow = false;
	redBase.position.set(0, 0.25, 40);
	redBaseBB = new THREE.Box3().setFromObject(redBase);
	scene.add(redBase);

	blueBase = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x0000ff, opacity: 0.5, transparent: true, side: THREE.DoubleSide }));
	blueBase.castShadow = false;
	blueBase.position.set(0, 0.25, -40);
	blueBaseBB = new THREE.Box3().setFromObject(blueBase);
	scene.add(blueBase);

	// Add base flags
	redFlag = baseFlag.clone();
	redFlag.children[0].material = new THREE.MeshStandardMaterial({color: 0xff0000})
	redFlag.rotation.y += Math.PI / 2;
	redFlagBB = new THREE.Box3();
	blueFlag = baseFlag.clone();
	blueFlag.children[0].material = new THREE.MeshStandardMaterial({color: 0x0000ff})
	blueFlag.rotation.y -= Math.PI / 2;
	blueFlagBB = new THREE.Box3();
	scene.add(redFlag)
	scene.add(blueFlag)
	
	// Cage for hit players
	cage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7), new THREE.MeshStandardMaterial({ color: 0xEA430A, opacity: 0.5, transparent: true, side: THREE.DoubleSide }));
	cage.castShadow = false;
	cage.visible = false;
	cage.position.set(camera.position.x, 0.94, camera.position.z);
	cageBB = new THREE.Box3().setFromObject(cage);

	
	// Balls the player can interact with
	for(let i = 0; i < 10; i++){
		let ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), new THREE.MeshStandardMaterial({color: 0xCDDC51}));
		ball.position.x = (i * 5 - 25);
		ball.position.z = 0;
		ball.position.y = floorHeight; 
		ball.isMoving = false;
		ball.isTraveling = false;
		ball.velocity = new THREE.Vector3();
		ball.distance = 0;
		ball.castShadow = true;
		interactiveBalls.push(ball);
		scene.add(ball);
		let ballBB = new THREE.Box3().setFromObject(ball);
		interactiveBallBBs.push(ballBB);
	}
	
	for(let ball of interactiveBalls){
		lastBallPositions.push(ball.position.clone());
	}

	grabRaycaster.far = maxRayDistance;
	

	// moveRaycasters
	function createMoveRaycasters() {
		for(let i = 0; i < 4; i++){
			let raycaster = new THREE.Raycaster();
			raycaster.far = 1;
			moveRaycasters.push(raycaster);
		}
	}

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
	
	createMoveRaycasters();
	
	
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
	const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1.5)]);

	return new THREE.Line(rayGeometry, rayMaterial);
}

function updateOrientation() {
	// Get joystick input		
	if(gamepad){
		let input = gamepad.axes;
		let x = playerHit ? 0 : input[2];
		let z = playerHit ? 0 : input[3];
	
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
		moveCameraWithJoystick(x, z)
	}
}

function moveCameraWithJoystick(x, z) {
	setRaycastersFromPlayer();
	const newXZ = updateMoveRaycasters(x, z);
	const newX = newXZ[0];
	const newZ = newXZ[1];
	const quaternion = dolly.quaternion.clone();
	dummyCam.getWorldQuaternion(dolly.quaternion);
    dolly.translateX(newX * 0.05);
    dolly.translateZ(newZ * 0.05);
    if (dolly.position.x > xBoundary_player) dolly.position.x = xBoundary_player;
    if (dolly.position.x < -xBoundary_player) dolly.position.x = -xBoundary_player;
    if (dolly.position.z > zBoundary_player) dolly.position.z = zBoundary_player;
    if (dolly.position.z < -zBoundary_player) dolly.position.z = -zBoundary_player;
	dolly.position.y = 0;
	dolly.quaternion.copy(quaternion);
}

function animate() {		
	renderer.setAnimationLoop(render);
}

function render(){
	const deltaTime = clock.getDelta();
	updateOrientation();
	updateGrabRaycaster();
	moveBall();
	checkPlayerHit();
	sendPlayerData();
	updateMixers(deltaTime);
	floatingFlags();
	collectEnemyFlag();
	flagCaptured();
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
				remotePeers = data[0];
				boxPositions = data[1];
				createObstacles();
				decidePlayerPosition(data[2]);
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

function decidePlayerPosition(amountConnected) {
	if(amountConnected === 1) {
		dolly.position.set(25, 0, -40);
		teamColor = "blue"
		dolly.rotation.y += Math.PI;
	}
	else if(amountConnected === 2) {
		dolly.position.set(25, 0, 40);
		teamColor = "red"
	}
	else if(amountConnected === 3) {
		dolly.position.set(-25, 0, -40);
		teamColor = "blue"
		dolly.rotation.y += Math.PI;
	}
}

function receiveData() {
	for(let i = 0; i < conns.length; i++){
		
		conns[i].on('data', (data) => {	
			orientOtherPlayers(i, data[0], data[1]);
			playWalkAnimation(data[2], i);
			playOthersGrabAnimation(data[3], i)
			playOthersThrowAnimation(data[4], i)
			ballsMovedByOthers(data[5])
			showOthersCages(data[6], i, data[0])
			moveFlags(data[7]);
			resetFlags(data[8]);
		});
	}
}	

// Send player data to all current connections
function sendPlayerData() {
	let cameraPos = new THREE.Vector3();
	let cameraQuat = new THREE.Quaternion();
	let ballPosData = getBallPos();
	let flagData;	
	if(flag_in_possession) {
		flagData = getFlagPos();
	}
	dummyCam.getWorldPosition(cameraPos);
	dummyCam.getWorldQuaternion(cameraQuat);
	const euler = new THREE.Euler(0, 0, 0, 'YXZ');
	euler.setFromQuaternion(cameraQuat, 'YXZ');
	let playerData = [cameraPos, euler.y, activeAction._clip.name, taking, throwing, ballPosData, playerHit, flagData, reset_flag];
	taking = false;
	throwing = false;
	reset_flag = false;
	for(let conn of conns){
		conn.send(playerData);
	}
}

function orientOtherPlayers(index, posData, rotData){
	// other players current position and looking direction
	otherPlayers[index].position.set(posData.x, 0.04, posData.z);
	otherPlayers[index].rotation.y = rotData * -1;
}

function playOthersGrabAnimation(data, index){
	if(data){
		grabActionOther = mixers[index].clipAction(grabClip);
		grabActionOther.setLoop(THREE.LoopOnce);
		grabActionOther.setEffectiveTimeScale(1.5);
		grabActionOther.play();
		grabActionOther.reset();
	}	
}

function playOthersThrowAnimation(data, index){
	if(data){
		grabActionOther.stop();
		throwActionOther = mixers[index].clipAction(throwClip);
		throwActionOther.setLoop(THREE.LoopOnce);
		throwActionOther.setEffectiveTimeScale(1.3);
		throwActionOther.play();
		throwActionOther.reset();
	}
}

function ballsMovedByOthers(data){
	for(let ballData of data){
		interactiveBalls[ballData[0]].position.copy(ballData[1]);
		interactiveBalls[ballData[0]].isTraveling = ballData[2];
	}
	
}

function showOthersCages(data, index, othersPos){
	if(data){
		otherPlayersCages[index].position.set(othersPos.x, 0.94, othersPos.z);
		otherPlayersCages[index].visible = true;
	} else{
		otherPlayersCages[index].visible = false;
	}
}

function moveFlags(data){
	if(data){
		let flagData = data;
		if(flagData[0] === "blue" && teamColor === "blue"){
			allied_flag_in_base = false;
			blueFlag.position.copy(flagData[1]);
		}else if (flagData[0] === "blue" && teamColor === "red"){
			enemy_flag_in_base = false;
			blueFlag.position.copy(flagData[1]);
		}
		if(flagData[0] === "red" && teamColor === "red"){
			allied_flag_in_base = false;
			redFlag.position.copy(flagData[1]);
		} else if(flagData[0] === "red" && teamColor === "blue"){
			enemy_flag_in_base = false;
			redFlag.position.copy(flagData[1]);
		}
	}
}

function resetFlags(data){
	if(data === "blue" && teamColor === "blue"){
		allied_flag_in_base = true;
	}else if (data === "blue" && teamColor === "red"){
		enemy_flag_in_base = true;
	}
	if(data === "red" && teamColor === "red"){
		allied_flag_in_base = true;
	} else if(data === "blue" && teamColor === "blue"){
		enemy_flag_in_base = true;
	}
}

function createObstacles(){
	for(let i = 0; i < boxPositions.length; i++){
		const boxGeometry = new THREE.BoxGeometry(8, 10, 8);
		const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
		if(i < 6) boxMaterial.color.set(0x0000ff);
		const box = new THREE.Mesh(boxGeometry, boxMaterial);
		box.castShadow = true;
		box.receiveShadow = true;
		box.position.copy(boxPositions[i]);
		let boxBB = new THREE.Box3().setFromObject(box);
		obstacleBBs.push(boxBB);
		obstacles.push(box);
		scene.add(box);
	}
}

function getBallPos(){
	let ballPosData = [];
	for(let i = 0; i < interactiveBalls.length; i++){
		if(interactiveBalls[i].distance > 0.01){			
			let ballWorldPos = new THREE.Vector3();
			interactiveBalls[i].getWorldPosition(ballWorldPos);
			let data = [i, ballWorldPos, interactiveBalls[i].isTraveling];
			ballPosData.push(data);
		}		
	}
	return ballPosData;
}

function getFlagPos(){
	if(teamColor === "red"){
		let flagPos = new THREE.Vector3();
		let flagData = [];
		blueFlag.getWorldPosition(flagPos);
		flagData.push("blue");
		flagData.push(flagPos);
		
		return flagData;
	}
	
	if(teamColor === "blue"){
		let flagPos = new THREE.Vector3();
		let flagData = [];
		redFlag.getWorldPosition(flagPos);
		flagData.push("red");
		flagData.push(flagPos);

		return flagData;
	}
}

function playAnimation(name){
	clip = THREE.AnimationClip.findByName(clips, name);
	activeAction = mixer.clipAction(clip);
}

function floatingFlags(){
	if(enemy_flag_in_base && teamColor === "red"){
		const amplitude = 0.2;
		const frequency = 0.003;		
		blueFlag.position.set(0, (amplitude * Math.sin(frequency * Date.now()) + 1), -40);
		blueFlagBB.setFromObject(blueFlag);
	}
	if(enemy_flag_in_base && teamColor === "blue"){
		const amplitude = 0.2;
		const frequency = 0.003;
		redFlag.position.set(0, (amplitude * Math.sin(frequency * Date.now()) + 1), 40);
		redFlagBB.setFromObject(redFlag);
	}
	if(allied_flag_in_base && teamColor === "red"){
		const amplitude = 0.2;
		const frequency = 0.003;
		redFlag.position.set(0, (amplitude * Math.sin(frequency * Date.now()) + 1), 40);
		redFlagBB.setFromObject(redFlag);
	}
	if(allied_flag_in_base && teamColor === "blue"){
		const amplitude = 0.2;
		const frequency = 0.003;		
		blueFlag.position.set(0, (amplitude * Math.sin(frequency * Date.now()) + 1), -40);
		blueFlagBB.setFromObject(blueFlag);
	}
}

function collectEnemyFlag(){
	if(teamColor === "red" && enemy_flag_in_base === true && cageBB.intersectsBox(blueFlagBB)){
		flag_in_possession = true;
		enemy_flag_in_base = false;
		dolly.attach(blueFlag);
		blueFlag.position.set(0, 2, 0);
	}
	
	if(teamColor === "blue" && enemy_flag_in_base === true && cageBB.intersectsBox(redFlagBB)){
		flag_in_possession = true;
		enemy_flag_in_base = false;
		dolly.attach(redFlag);
		redFlag.position.set(0, 2, 0);
	}
}

function flagCaptured(){
	if(teamColor === "red" && flag_in_possession && cageBB.intersectsBox(redBaseBB)){
		flag_in_possession = false;
		enemy_flag_in_base = true;
		reset_flag = "blue";
		group.attach(blueFlag);
		points++;
		if(points === 3) gameOver = true;
		
		console.log(points);
	}
	if(teamColor === "blue" && flag_in_possession && cageBB.intersectsBox(blueBaseBB)){
		flag_in_possession = false;
		enemy_flag_in_base = true;
		reset_flag = "red";
		group.attach(redFlag);
		points++;
		if(points === 3) gameOver = true;
		
		console.log(points);
	}
}

function updateGrabRaycaster() {
	
	setRaycasterFromController(grabRaycaster, controller2);	
	for(let i = 0; i < interactiveBalls.length; i++){
		const intersects = grabRaycaster.intersectObject(interactiveBalls[i]);
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

function updateMoveRaycasters(x, z){
	let newX = x;
	let newZ = z;
	for(let obstacle of obstacles) {		
		const intersects1 = moveRaycasters[0].intersectObject(obstacle);
		const intersects2 = moveRaycasters[1].intersectObject(obstacle);
		const intersects3 = moveRaycasters[2].intersectObject(obstacle);
		const intersects4 = moveRaycasters[3].intersectObject(obstacle);
		if(intersects1.length > 0 && z < -0.5){
			newZ = 0;
		}
		if(intersects2.length > 0 && x > 0.5){
			newX = 0;
		}
		if(intersects3.length > 0 && z > 0.5){
			newZ = 0;
		}
		if(intersects4.length > 0 && x < -0.5){
			newX = 0;			
		}		
	}
	return [newX, newZ];
}

function grabBall(ball, index){
	if(!ball.isMoving){
		if(controller2.userData.isSelecting === true){
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
				selectedObject.isTraveling = true;
			}
			selectedObject = null;
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
				ball.isTraveling = false;
		}
			interactiveBallBBs[i].setFromObject(ball);
			ball_walltouch(i);
			ball_obstacletouch(i)
		}
	}
}

function checkPlayerHit(){
	cageBB.setFromObject(cage);
	for(let i = 0; i < interactiveBallBBs.length; i++){
		interactiveBallBBs[i].setFromObject(interactiveBalls[i]);
		if(!cage.visible && interactiveBalls[i].isTraveling && interactiveBallBBs[i].intersectsBox(cageBB)){
			cage.visible = true;
			playerHit = true;
			interactiveBalls[i].isTraveling = false;
			if(flag_in_possession) {
				enemy_flag_in_base = true;
				flag_in_possession = false;
				if(teamColor === "red"){
					group.attach(blueFlag);
					reset_flag ="blue";
				}	
				if(teamColor === "blue") {
					group.attach(redFlag);
					reset_flag = "red";
				}
			}
			setTimeout(continueMovementAfterHit, 3000);
		}
	}
}

function continueMovementAfterHit(){
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

function ball_obstacletouch(index){
	for(let i = 0; i < obstacles.length; i++){
		if(interactiveBallBBs[index].intersectsBox(obstacleBBs[i])){
			const boxCenter = obstacles[i].position.clone();
			const boxSize = 8;
			// Check which side gets hit by ball and change velocity accordingly
			if (interactiveBalls[index].position.x < boxCenter.x - boxSize / 2 || interactiveBalls[index].position.x > boxCenter.x + boxSize / 2) {
				interactiveBalls[index].velocity.x *= -0.5;
			}
			if (interactiveBalls[index].position.y < boxCenter.y - 10 / 2 || interactiveBalls[index].position.y > boxCenter.y + 10 / 2) {
				interactiveBalls[index].velocity.y *= -0.5; 
			}
			if (interactiveBalls[index].position.z < boxCenter.z - boxSize / 2 || interactiveBalls[index].position.z > boxCenter.z + boxSize / 2) {
				interactiveBalls[index].velocity.z *= -0.5; 
			}
			interactiveBalls[index].position.add(interactiveBalls[index].velocity);
		}
	}
}

function setRaycasterFromController(raycaster, controller){
	controller.updateMatrixWorld();
	tempMatrix.identity().extractRotation( controller.matrixWorld );
	raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );
}

function setRaycastersFromPlayer(){
	dummyCam.updateMatrixWorld();
	tempMatrix.identity().extractRotation( dummyCam.matrixWorld );
	moveRaycasters[0].ray.origin.setFromMatrixPosition( dummyCam.matrixWorld );
	moveRaycasters[0].ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );	
	moveRaycasters[1].ray.origin.setFromMatrixPosition( dummyCam.matrixWorld );
	moveRaycasters[1].ray.direction.set( 1, 0, 0 ).applyMatrix4( tempMatrix );
	moveRaycasters[2].ray.origin.setFromMatrixPosition( dummyCam.matrixWorld );
	moveRaycasters[2].ray.direction.set( 0, 0, 1 ).applyMatrix4( tempMatrix );
	moveRaycasters[3].ray.origin.setFromMatrixPosition( dummyCam.matrixWorld );
	moveRaycasters[3].ray.direction.set( -1, 0, 0 ).applyMatrix4( tempMatrix );
}

function createOtherPlayer() {
	// Create other Player in Scene
	// const oppMaterial = new THREE.MeshStandardMaterial( {color: 0xffff00} );
	let opponent = SkeletonUtils.clone(robot);
	let material = decideOthersTeamColor();
	opponent.traverse((obj) => {
		if(obj.isMesh){
				obj.material = material;
				obj.castShadow = true;		
			}
		}
	)	
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

function decideOthersTeamColor(){
	let material;
	if(otherPlayers.length === 0) {
		material = new THREE.MeshStandardMaterial({color: 0xD22B2B});		
	}else if(teamColor === "red"){
		material = new THREE.MeshStandardMaterial({color: 0x0096FF});	
	}else if(otherPlayers.length === 1){
		material = new THREE.MeshStandardMaterial({color: 0x0096FF});	
	}else if(otherPlayers.length === 2){
		material = new THREE.MeshStandardMaterial({color: 0xD22B2B});	
	}
	return material;
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